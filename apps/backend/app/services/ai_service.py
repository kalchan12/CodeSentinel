"""AI CLI Service: orchestrates OpenCode and Antigravity CLI for codebase assessments."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from engine.models.finding import FindingCategory, Severity
from app.models.finding import Finding as FindingModel
from app.models.scan import Scan as ScanModel
from app.services import project_service, scan_service

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


async def run_ai_codebase_assessment(
    db: Session,
    project_id: int,
    provider: str = "opencode",
    custom_prompt: Optional[str] = None,
) -> dict[str, Any]:
    """Run an automated security evaluation using OpenCode or Antigravity CLI."""
    project = project_service.get_project(db, project_id)
    if not project:
        raise ValueError(f"Project #{project_id} not found")

    target_dir = project.local_path
    if not target_dir or not os.path.isdir(target_dir):
        target_dir = os.getcwd()

    binary = find_cli_binary(provider)
    if not binary:
        raise RuntimeError(f"AI CLI binary '{provider}' is not installed or not in PATH")

    # Construct headless audit command
    if provider == "opencode":
        prompt = (
            custom_prompt
            or "Perform a security assessment of this project. Identify any vulnerabilities, "
            "exposed secrets, or insecure dependencies. Return a JSON array of findings with: "
            "title, severity (critical, high, medium, low), category, file, line_start, description, remediation."
        )
        cmd = [binary, "run", "--auto", prompt]
    else:  # agy
        prompt = (
            custom_prompt
            or "Perform a code security analysis of this workspace. Identify critical security vulnerabilities, "
            "injection points, and secrets. Return JSON findings with: "
            "title, severity, file, line, description, and remediation."
        )
        cmd = [binary, "-p", prompt, "--output-format", "json"]

    logger.info("Executing %s assessment in %s", provider, target_dir)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=target_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=180.0)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise RuntimeError(f"{provider} security assessment timed out after 180 seconds")
    except Exception as exc:
        raise RuntimeError(f"Failed to execute {provider}: {exc}") from exc

    raw_output = stdout.decode(errors="replace")
    logger.info("AI CLI finished with code %d, output length %d", proc.returncode, len(raw_output))

    # Parse findings from AI output
    findings_list = parse_ai_findings(raw_output, provider)

    # Get or create active scan for storing findings
    latest_scan_id = project.last_scan_id
    if not latest_scan_id:
        scan = scan_service.create_scan(db, project.id)
        latest_scan_id = scan.id

    saved_findings = []
    for item in findings_list:
        try:
            finding_id = uuid.uuid4()
            severity_str = str(item.get("severity", "medium")).lower()
            if severity_str not in ["critical", "high", "medium", "low", "info"]:
                severity_str = "medium"

            sev_rank_map = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
            rank = sev_rank_map.get(severity_str, 2)

            f_model = FindingModel(
                id=finding_id,
                scan_id=latest_scan_id,
                analyzer=f"ai-{provider}",
                category=item.get("category", "ai_insight"),
                severity=severity_str,
                severity_rank=rank,
                confidence="high",
                title=item.get("title", f"AI Identified Security Insight ({provider})"),
                description=item.get("description", ""),
                file=item.get("file", "project"),
                line_start=item.get("line_start") or item.get("line"),
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
            logger.warning("Error creating finding from AI output: %s", err)

    db.commit()

    return {
        "provider": provider,
        "raw_output": raw_output[:2000],
        "findings_count": len(saved_findings),
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
            for f in saved_findings
        ],
    }


def parse_ai_findings(text: str, provider: str) -> list[dict[str, Any]]:
    """Extract JSON findings array or parse Markdown sections from AI CLI output."""
    # 1. Try finding JSON array block
    json_match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    # 2. Try parsing markdown bullets or paragraphs
    results = []
    lines = text.split("\n")
    current_item: dict[str, Any] = {}

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        if line_clean.startswith("###") or line_clean.startswith("- **"):
            if current_item.get("title"):
                results.append(current_item)
                current_item = {}

            # Extract title
            title_clean = re.sub(r"^[#\-\*\s]+", "", line_clean)
            current_item["title"] = title_clean[:128]
            current_item["severity"] = "high" if "critical" in line_clean.lower() or "high" in line_clean.lower() else "medium"
            current_item["category"] = "vulnerability"
        elif "file:" in line_clean.lower():
            current_item["file"] = line_clean.split(":", 1)[1].strip()
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

    if not results and text.strip():
        # Fallback single finding summarizing the AI assessment
        results.append({
            "title": f"{provider.capitalize()} Security Assessment Overview",
            "severity": "info",
            "category": "ai_insight",
            "file": "README.md",
            "description": text[:1000],
            "remediation": "Review the full AI session trace in the embedded terminal for detailed remediation steps.",
        })

    return results
