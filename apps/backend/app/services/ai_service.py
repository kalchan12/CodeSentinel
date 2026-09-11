"""AI CLI Service: orchestrates OpenCode and Antigravity CLI for codebase assessments."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import re
import shutil
import subprocess
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.enums import ScanStatus
from app.models.finding import Finding as FindingModel
from app.models.risk_assessment import RiskAssessment
from app.models.scan import Scan as ScanModel
from app.services import differential_service, project_service, scan_service
from engine.models.finding import FindingCategory, Severity

logger = logging.getLogger(__name__)


def find_cli_binary(name: str) -> Optional[str]:
    """Find absolute path for opencode or agy."""
    resolved = shutil.which(name)
    if resolved:
        return resolved

    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, ".opencode", "bin", name),
        os.path.join(home, ".local", "bin", name),
        f"/usr/local/bin/{name}",
        f"/usr/bin/{name}",
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None


def get_ai_status() -> dict[str, Any]:
    """Check availability of OpenCode and Antigravity CLIs."""
    opencode_path = find_cli_binary("opencode")
    agy_path = find_cli_binary("agy")

    opencode_version = None
    if opencode_path:
        try:
            res = subprocess.run(
                [opencode_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            opencode_version = res.stdout.strip() or res.stderr.strip()
        except Exception:
            opencode_version = "available"

    agy_version = None
    if agy_path:
        try:
            res = subprocess.run(
                [agy_path, "--help"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            agy_version = "available" if res.returncode == 0 else "unknown"
        except Exception:
            agy_version = "available"

    return {
        "opencode": {
            "available": bool(opencode_path),
            "path": opencode_path,
            "version": opencode_version,
            "description": "OpenCode AI Coding Agent (supports Claude, GPT, Gemini, Ollama)",
        },
        "agy": {
            "available": bool(agy_path),
            "path": agy_path,
            "version": agy_version,
            "description": "Google Antigravity CLI (deep codebase reasoning & multi-file agents)",
        },
    }



IGNORE_DIRS = {
    ".git", ".venv", "venv", "env", "node_modules", "__pycache__",
    ".next", "dist", "build", ".idea", ".vscode", "target", "vendor",
    ".pytest_cache", ".mypy_cache", ".cargo", "site-packages",
    "coverage", "out", ".turbo", ".gradle", "bin", "obj",
}

SOURCE_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".java", ".php",
    ".rb", ".c", ".cpp", ".h", ".cs", ".rs", ".html", ".sql",
    ".sh", ".env", ".yml", ".yaml", ".json", ".toml", ".conf",
}

IGNORE_FILES = {
    "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock", "composer.lock",
}


def discover_project_source_files(target_dir: str, max_files: int = 30) -> list[str]:
    """Discover actual project source code files, ignoring vendor, cache, and virtual environment directories."""
    discovered: list[str] = []
    if not os.path.isdir(target_dir):
        return discovered

    # First pass: check root directory files
    try:
        root_entries = sorted(os.listdir(target_dir))
        for entry in root_entries:
            full_p = os.path.join(target_dir, entry)
            if os.path.isfile(full_p):
                ext = os.path.splitext(entry)[1].lower()
                name = os.path.basename(entry)
                if (ext in SOURCE_EXTS or name.startswith(".env")) and name not in IGNORE_FILES:
                    discovered.append(entry)
    except Exception as exc:
        logger.warning("Error reading root entries in %s: %s", target_dir, exc)

    # Second pass: walk subdirectories
    for root, dirs, files in os.walk(target_dir):
        # Modify dirs in-place to prune ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith(".")]
        
        rel_root = os.path.relpath(root, target_dir)
        if rel_root == ".":
            continue
            
        for file in sorted(files):
            if len(discovered) >= max_files:
                break
            ext = os.path.splitext(file)[1].lower()
            name = os.path.basename(file)
            if (ext in SOURCE_EXTS or name.startswith(".env")) and name not in IGNORE_FILES:
                rel_file = os.path.normpath(os.path.join(rel_root, file))
                if rel_file not in discovered:
                    discovered.append(rel_file)
        if len(discovered) >= max_files:
            break

    return discovered[:max_files]


def extract_code_snippet(
    target_dir: str,
    file_path: str,
    line: int | None,
    context_lines: int = 3,
) -> str | None:
    """Extract code context around line_start from project file for visual inspection."""
    if not file_path:
        return None
    clean_p = file_path.strip().lstrip("./").lstrip("/")
    full_path = os.path.join(target_dir, clean_p)
    if not os.path.isfile(full_path):
        if os.path.isabs(file_path) and os.path.isfile(file_path):
            full_path = file_path
        else:
            return None
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        if not lines:
            return None
        if line is None or line < 1 or line > len(lines):
            return "".join(lines[:12])
        start = max(0, line - 1 - context_lines)
        end = min(len(lines), line + context_lines)
        return "".join(lines[start:end])
    except Exception:
        return None


async def run_ai_scan_background(
    scan_id: int,
    provider: str = "opencode",
    custom_prompt: Optional[str] = None,
) -> None:
    """Execute an automated AI security evaluation in the background with real-time telemetry."""
    logger.info("Starting background AI scan %d via %s", scan_id, provider)

    with SessionLocal() as db:
        scan = db.get(ScanModel, scan_id)
        if not scan:
            logger.error("Scan #%d not found", scan_id)
            return

        project = project_service.get_project(db, scan.project_id)
        if not project:
            scan.status = ScanStatus.FAILED.value
            scan.error_message = f"Project #{scan.project_id} not found"
            db.commit()
            return

        target_dir = project.local_path
        if not target_dir or not os.path.isdir(target_dir):
            target_dir = os.getcwd()

        binary = find_cli_binary(provider)
        if not binary:
            scan.status = ScanStatus.FAILED.value
            scan.error_message = f"AI CLI binary '{provider}' is not installed or not in PATH"
            db.commit()
            return

        # Discover genuine project source files
        discovered_files = discover_project_source_files(target_dir, max_files=25)
        file_list_summary = ", ".join(discovered_files[:8]) if discovered_files else "all workspace files"

        # Initialize running scan metadata
        scan.status = ScanStatus.RUNNING.value
        scan.started_at = datetime.now(timezone.utc)
        scan.progress = 10.0

        correlation = dict(scan.correlation or {})
        correlation["scan_type"] = "ai"
        correlation["provider"] = provider
        correlation["status_phase"] = "Ingesting workspace and budgeting context"
        correlation["discovered_files"] = discovered_files
        correlation["target_files_count"] = len(discovered_files)
        correlation["live_logs"] = [
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Phase 1/5] Initializing local AI security scan...",
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Target workspace: {target_dir}",
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Discovered {len(discovered_files)} source files for audit: {file_list_summary}{'...' if len(discovered_files) > 8 else ''}",
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Selected local AI agent: {provider} ({binary})",
        ]
        scan.correlation = correlation
        db.commit()

    # Construct file-specific CLI command and prompt
    file_list_str = ", ".join(discovered_files[:15]) if discovered_files else "the project files"
    if provider == "opencode":
        prompt = (
            custom_prompt
            or f"Perform a comprehensive code security assessment of the source files in this workspace: {file_list_str}. "
            "Inspect the source code directly for vulnerabilities, injection points, exposed secrets, and insecure configurations. "
            "Return your findings strictly as a JSON array of objects with: "
            "title, severity (critical, high, medium, low), category, file, line_start, description, remediation."
        )
        cmd = [binary, "run", "--auto", prompt]
    else:  # agy
        prompt = (
            custom_prompt
            or f"Audit the security of the source files in this workspace: {file_list_str}. "
            "Inspect the code directly for vulnerabilities, injection points, hardcoded secrets, and insecure configurations. "
            "Return your findings strictly as a JSON array of objects with: "
            "title, severity (critical, high, medium, low), category, file, line_start, description, remediation."
        )
        cmd = [binary, "-p", prompt, "--dangerously-skip-permissions", "--output-format", "json"]

    # Phase 2: Launch subprocess
    with SessionLocal() as db:
        scan = db.get(ScanModel, scan_id)
        if scan:
            corr = dict(scan.correlation or {})
            corr["status_phase"] = f"Spawning local {provider} agent process"
            corr["live_logs"].append(
                f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Phase 2/5] Spawning {provider} subprocess..."
            )
            scan.progress = 25.0
            scan.correlation = corr
            db.commit()

    proc = None
    raw_output = ""
    error_output = ""

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=target_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        with SessionLocal() as db:
            scan = db.get(ScanModel, scan_id)
            if scan:
                corr = dict(scan.correlation or {})
                corr["status_phase"] = f"{provider.capitalize()} deep reasoning in progress"
                corr["live_logs"].append(
                    f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Phase 3/5] AI Agent reasoning on codebase (PID {proc.pid})..."
                )
                scan.progress = 45.0
                scan.correlation = corr
                db.commit()

        # Stream / await output with 300s timeout
        stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=300.0)
        raw_output = stdout_bytes.decode(errors="replace")
        error_output = stderr_bytes.decode(errors="replace")

        logger.info("AI CLI %s finished with code %d, stdout %d bytes", provider, proc.returncode, len(raw_output))

    except asyncio.TimeoutError:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        with SessionLocal() as db:
            scan = db.get(ScanModel, scan_id)
            if scan:
                scan.status = ScanStatus.FAILED.value
                scan.error_message = f"{provider.capitalize()} security evaluation timed out after 300 seconds. Check network or model responsiveness."
                corr = dict(scan.correlation or {})
                corr["live_logs"].append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Timeout] Subprocess killed after 300s.")
                scan.correlation = corr
                db.commit()
        return

    except Exception as exc:
        logger.exception("Failed executing AI CLI: %s", exc)
        with SessionLocal() as db:
            scan = db.get(ScanModel, scan_id)
            if scan:
                scan.status = ScanStatus.FAILED.value
                scan.error_message = f"Execution error in {provider}: {exc}"
                corr = dict(scan.correlation or {})
                corr["live_logs"].append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Error] {exc}")
                scan.correlation = corr
                db.commit()
        return

    # Phase 4: Parse findings and persist
    with SessionLocal() as db:
        scan = db.get(ScanModel, scan_id)
        if not scan:
            return

        corr = dict(scan.correlation or {})
        corr["status_phase"] = "Normalizing findings into canonical schema"
        corr["live_logs"].append(
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Phase 4/5] Normalizing AI response into canonical findings..."
        )
        scan.progress = 80.0
        scan.correlation = corr
        db.commit()

        findings_list = parse_ai_findings(raw_output, provider)
        saved_findings: list[FindingModel] = []

        for item in findings_list:
            try:
                finding_id = uuid.uuid4()
                severity_str = str(item.get("severity", "medium")).lower()
                if severity_str not in ["critical", "high", "medium", "low", "info"]:
                    severity_str = "medium"

                sev_rank_map = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
                rank = sev_rank_map.get(severity_str, 2)

                file_path = str(item.get("file", "project")).strip().replace("`", "")
                line_val = item.get("line_start") or item.get("line")
                try:
                    line_start = int(line_val) if line_val is not None else None
                except (ValueError, TypeError):
                    line_start = None

                code_snippet = extract_code_snippet(target_dir, file_path, line_start)

                f_model = FindingModel(
                    id=finding_id,
                    scan_id=scan.id,
                    analyzer=f"ai-{provider}",
                    category=item.get("category", "vulnerability"),
                    severity=severity_str,
                    severity_rank=rank,
                    confidence="high",
                    title=item.get("title", f"AI Security Finding ({provider})"),
                    description=item.get("description", ""),
                    file=file_path,
                    line_start=line_start,
                    code_snippet=code_snippet,
                    remediation=item.get("remediation"),
                    risk_score=float(rank * 25.0),
                    finding_metadata={
                        "provider": provider,
                        "ai_summary": item.get("description", ""),
                        "remediation_example": item.get("remediation", ""),
                        "root_cause": f"Identified by local {provider} security agent",
                    },
                )
                db.add(f_model)
                saved_findings.append(f_model)
            except Exception as err:
                logger.warning("Error creating finding model from AI output: %s", err)


        db.commit()

        # Create RiskAssessment record
        overall_score = max([f.risk_score or 0.0 for f in saved_findings], default=15.0)
        overall_level = "critical" if overall_score >= 75 else "high" if overall_score >= 50 else "medium" if overall_score >= 25 else "low"
        assessment = RiskAssessment(
            scan_id=scan.id,
            overall_score=overall_score,
            overall_level=overall_level,
            algorithm="codesentinel-risk-v1-ai",
            rationale=f"Synthesized from {len(saved_findings)} findings identified by {provider} agent.",
            breakdown={"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            top_priorities=[],
            finding_risks=[],
        )
        db.add(assessment)
        db.commit()

        # Phase 5: Differential comparison vs baseline static scan
        corr["status_phase"] = "Computing differential benchmark vs static scan"
        corr["live_logs"].append(
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Phase 5/5] Correlating findings against baseline static scan..."
        )
        scan.progress = 95.0
        scan.correlation = corr
        db.commit()

        # Find latest completed static scan for this project
        static_scan = (
            db.query(ScanModel)
            .filter(
                ScanModel.project_id == scan.project_id,
                ScanModel.id != scan.id,
                ScanModel.status == ScanStatus.COMPLETED.value,
            )
            .order_by(ScanModel.id.desc())
            .first()
        )

        static_findings = []
        if static_scan:
            static_findings = (
                db.query(FindingModel)
                .filter(FindingModel.scan_id == static_scan.id)
                .all()
            )

        # Run differential analysis
        differential = differential_service.compute_scan_differential(
            static_findings=static_findings,
            ai_findings=saved_findings,
            static_scan_id=static_scan.id if static_scan else None,
            ai_scan_id=scan.id,
        )

        # Mark scan completed
        scan.status = ScanStatus.COMPLETED.value
        scan.progress = 100.0
        scan.findings_count = len(saved_findings)
        scan.completed_at = datetime.now(timezone.utc)

        corr["status_phase"] = "Scan completed successfully"
        corr["comparison"] = differential
        corr["live_logs"].append(
            f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] [Complete] Identified {len(saved_findings)} AI vulnerabilities. Comparison computed against Scan #{static_scan.id if static_scan else 'none'}."
        )
        scan.correlation = corr
        db.commit()

        logger.info("AI Scan #%d completed successfully with %d findings", scan_id, len(saved_findings))


def parse_ai_findings(text: str, provider: str) -> list[dict[str, Any]]:
    """Extract structured findings from AI CLI output, unwrapping JSON envelopes if present."""
    clean_text = text.strip()
    if not clean_text:
        return []

    # 1. If output is a JSON envelope (e.g. agy response or object wrapper), unwrap it
    try:
        data = json.loads(clean_text)
        if isinstance(data, dict):
            if "findings" in data and isinstance(data["findings"], list):
                return _normalize_findings_list(data["findings"], provider)
            if "response" in data and isinstance(data["response"], str):
                clean_text = data["response"].strip()
            elif "result" in data and isinstance(data["result"], str):
                clean_text = data["result"].strip()
            elif "output" in data and isinstance(data["output"], str):
                clean_text = data["output"].strip()
        elif isinstance(data, list):
            return _normalize_findings_list(data, provider)
    except Exception:
        pass

    # 2. Strip markdown code fences if present (```json ... ```)
    clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text, flags=re.MULTILINE)
    clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.MULTILINE)

    # 3. Try finding outer bracket range [...] for JSON array
    start_idx = clean_text.find("[")
    end_idx = clean_text.rfind("]")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        bracket_content = clean_text[start_idx : end_idx + 1]
        try:
            parsed = json.loads(bracket_content)
            if isinstance(parsed, list) and len(parsed) > 0:
                return _normalize_findings_list(parsed, provider)
        except Exception:
            # Trailing commas or formatting cleanup
            try:
                sanitized = re.sub(r",\s*([\]}])", r"\1", bracket_content)
                parsed = json.loads(sanitized)
                if isinstance(parsed, list) and len(parsed) > 0:
                    return _normalize_findings_list(parsed, provider)
            except Exception:
                pass

    # 4. Try parsing structured markdown sections
    results: list[dict[str, Any]] = []
    lines = clean_text.split("\n")
    current_item: dict[str, Any] = {}

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        if line_clean.startswith("###") or line_clean.startswith("- **") or re.match(r"^\d+\.\s+\*\*", line_clean):
            if current_item.get("title"):
                results.append(current_item)
                current_item = {}

            title_clean = re.sub(r"^[#\-\*\d\.\s]+", "", line_clean).replace("**", "").strip()
            current_item["title"] = title_clean[:128]
            lower_title = title_clean.lower()
            current_item["severity"] = "critical" if "critical" in lower_title else "high" if "high" in lower_title else "medium"
            current_item["category"] = "vulnerability"
        elif "severity:" in line_clean.lower():
            sev_candidate = line_clean.split(":", 1)[1].strip().lower().replace("*", "")
            for s in ["critical", "high", "medium", "low", "info"]:
                if s in sev_candidate:
                    current_item["severity"] = s
                    break
        elif "file:" in line_clean.lower():
            current_item["file"] = line_clean.split(":", 1)[1].strip().replace("`", "")
        elif "line:" in line_clean.lower():
            match = re.search(r"\d+", line_clean)
            if match:
                current_item["line_start"] = int(match.group(0))
        elif "remediation:" in line_clean.lower() or "fix:" in line_clean.lower():
            current_item["remediation"] = line_clean.split(":", 1)[1].strip()
        else:
            current_desc = current_item.get("description", "")
            current_item["description"] = f"{current_desc} {line_clean}".strip()

    if current_item.get("title"):
        results.append(current_item)

    if results:
        return _normalize_findings_list(results, provider)

    if clean_text:
        # Fallback overview finding
        return [{
            "title": f"{provider.capitalize()} Security Assessment Overview",
            "severity": "info",
            "category": "vulnerability",
            "file": "README.md",
            "line_start": 1,
            "description": clean_text[:1200],
            "remediation": "Review the full AI output in the embedded terminal for detailed remediation steps.",
        }]

    return []


def _normalize_findings_list(items: list[Any], provider: str) -> list[dict[str, Any]]:
    """Normalize a list of raw finding dictionaries."""
    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("name") or f"AI Security Finding ({provider})"
        sev = str(item.get("severity", "medium")).lower()
        if sev not in ["critical", "high", "medium", "low", "info"]:
            sev = "medium"
        file_path = str(item.get("file") or item.get("filename") or item.get("path") or "project").strip().replace("`", "")
        line_val = item.get("line_start") or item.get("line") or item.get("line_number")
        try:
            line_start = int(line_val) if line_val is not None else None
        except (ValueError, TypeError):
            line_start = None

        normalized.append({
            "title": str(title)[:256],
            "severity": sev,
            "category": str(item.get("category", "vulnerability")),
            "file": file_path,
            "line_start": line_start,
            "description": str(item.get("description") or item.get("summary") or ""),
            "remediation": str(item.get("remediation") or item.get("fix") or item.get("recommendation") or ""),
        })
    return normalized



async def run_ai_codebase_assessment(
    db: Session,
    project_id: int,
    provider: str = "opencode",
    custom_prompt: Optional[str] = None,
) -> dict[str, Any]:
    """Synchronous compatibility wrapper for automated CLI codebase assessments."""
    scan = scan_service.create_scan(db, project_id)
    await run_ai_scan_background(scan.id, provider, custom_prompt)
    db.refresh(scan)
    return {
        "scan_id": scan.id,
        "project_id": project_id,
        "provider": provider,
        "total_findings": scan.findings_count,
        "findings": [
            {
                "id": str(f.id),
                "title": f.title,
                "severity": f.severity,
                "file": f.file,
                "line": f.line_start,
                "description": f.description,
                "remediation": f.remediation,
            }
            for f in scan.findings
        ],
        "raw_summary": scan.error_message or "AI Scan completed",
        "command": f"{provider} run",
    }
