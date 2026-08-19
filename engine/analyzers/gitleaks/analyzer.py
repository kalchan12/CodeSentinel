"""Gitleaks analyzer: secrets detection via the gitleaks CLI.

Runs ``gitleaks detect --no-git`` over the project directory and maps
reported leaks onto Finding objects with category ``secrets``. The
``--redact`` flag ensures the actual secret value never leaves the tool
into evidence, keeping results safe to store.

Requires the gitleaks binary (https://github.com/gitleaks/gitleaks);
point at a custom path via ``CODESENTINEL_GITLEAKS_PATH``.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import tempfile
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerError, AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S = 120
MAX_REPORT_FINDINGS = 500


class GitleaksAnalyzer(Analyzer):
    name = "gitleaks"
    description = "Gitleaks secrets detection (redacted output)"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}
        self.binary = self.env.get("CODESENTINEL_GITLEAKS_PATH", "gitleaks")
        self.timeout_s = int(self.env.get("CODESENTINEL_GITLEAKS_TIMEOUT", DEFAULT_TIMEOUT_S))

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        binary = shutil.which(self.binary)
        if binary is None:
            raise AnalyzerNotAvailableError(
                f"gitleaks binary {self.binary!r} not found on PATH; "
                "install it (e.g. scripts/install_gitleaks.sh) or set "
                "CODESENTINEL_GITLEAKS_PATH"
            )

        with tempfile.TemporaryDirectory(prefix="codesentinel-gitleaks-") as tmp:
            report = Path(tmp) / "report.json"
            cmd = [
                binary,
                "detect",
                "--source",
                str(context.project_path),
                "--report-format",
                "json",
                "--report-path",
                str(report),
                "--no-git",
                "--redact",
                "--no-banner",
            ]
            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_s,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                raise AnalyzerError(f"gitleaks scan exceeded {self.timeout_s}s") from None
            except OSError as exc:
                raise AnalyzerError(f"could not launch gitleaks: {exc}") from exc

            # Exit codes: 0 = clean, 1 = leaks found, 2 = error.
            if proc.returncode == 2:
                tail = "\n".join(proc.stderr.splitlines()[-5:])
                raise AnalyzerError(f"gitleaks failed with exit code 2: {tail or 'no stderr'}")
            if not report.exists():
                return []

            try:
                leaks = json.loads(report.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise AnalyzerError(f"gitleaks report is not valid JSON: {exc}") from exc

        findings = []
        for leak in leaks[:MAX_REPORT_FINDINGS]:
            finding = _to_finding(leak)
            if finding.file:
                try:
                    finding.file = str(
                        Path(finding.file).resolve().relative_to(context.project_path.resolve())
                    )
                except ValueError:
                    pass
            findings.append(finding)
        if len(leaks) > MAX_REPORT_FINDINGS:
            logger.warning(
                "gitleaks found %d leaks; reporting first %d", len(leaks), MAX_REPORT_FINDINGS
            )
        return findings


def _to_finding(leak: Mapping[str, object]) -> Finding:
    file = str(leak.get("File", ""))
    rule_id = str(leak.get("RuleID", "gitleaks-rule"))
    severity = _severity(rule_id)
    description = str(
        leak.get("Description", "") or f"gitleaks rule {rule_id} matched a secret-like value"
    )
    snippet = str(leak.get("Match", "") or "").strip()

    return Finding(
        analyzer="gitleaks",
        category=FindingCategory.SECRETS,
        title=_title(rule_id),
        description=description,
        severity=severity,
        confidence=Confidence.MEDIUM,
        file=file,
        line_start=leak.get("StartLine") if isinstance(leak.get("StartLine"), int) else None,
        line_end=leak.get("EndLine") if isinstance(leak.get("EndLine"), int) else None,
        code_snippet=snippet or None,
        rule_id=rule_id,
        evidence={
            "leak_type": rule_id,
            "redacted": True,
            "commit": str(leak.get("Commit", "")) if leak.get("Commit") else None,
        },
        remediation=(
            "Rotate the exposed credential immediately, remove it from the "
            "repository and rewrite history if it was ever pushed."
        ),
        metadata={"rule": rule_id},
    )


def _title(rule_id: str) -> str:
    return (rule_id.replace("_", " ").replace("-", " ").title() or "Exposed secret") + " (gitleaks)"


def _severity(rule_id: str) -> Severity:
    lowered = rule_id.lower()
    if "generic" in lowered or "api" in lowered:
        return Severity.MEDIUM
    return Severity.HIGH


AnalyzerRegistry.register(GitleaksAnalyzer)
