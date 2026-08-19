"""Semgrep analyzer: runs the semgrep CLI over bundled local rules.

Local-first by design: rules ship inside this package (``rules/``) so a
scan never needs to download the registry. Override the rule set with
``CODESENTINEL_SEMGREP_CONFIG`` (path to a rules file or directory).

Output is mapped from ``semgrep scan --json`` onto the Finding contract:
semgrep severity ERROR -> high, WARNING -> medium, INFO -> low; the rule
metadata ``category`` refines the Finding category (secrets stays
secrets, anything else is a vulnerability).
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerError, AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

logger = logging.getLogger(__name__)

RULES_DIR = Path(__file__).parent / "rules"

#: semgrep severity -> normalized severity
_SEVERITY_MAP = {
    "ERROR": Severity.HIGH,
    "WARNING": Severity.MEDIUM,
    "INFO": Severity.LOW,
}

#: semgrep metadata.category -> Finding category (unsafe defaults to vulnerability).
_CATEGORY_MAP = {
    "secrets": FindingCategory.SECRETS,
    "security": FindingCategory.VULNERABILITY,
    "correctness": FindingCategory.CODE_QUALITY,
    "best-practice": FindingCategory.CODE_QUALITY,
}

#: hard limits so a scan stays bounded on large trees.
DEFAULT_TIMEOUT_S = 60
MAX_RULE_FILES = 50


class SemgrepAnalyzer(Analyzer):
    name = "semgrep"
    description = "Semgrep static analysis over bundled local rules"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}
        self.binary = self.env.get("CODESENTINEL_SEMGREP_PATH", "semgrep")
        config = self.env.get("CODESENTINEL_SEMGREP_CONFIG", "")
        self.config = Path(config) if config else RULES_DIR
        self.timeout_s = int(self.env.get("CODESENTINEL_SEMGREP_TIMEOUT", DEFAULT_TIMEOUT_S))

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        binary = shutil.which(self.binary)
        if binary is None:
            raise AnalyzerNotAvailableError(
                f"semgrep binary {self.binary!r} not found on PATH; "
                "install it with `pip install semgrep` or set CODESENTINEL_SEMGREP_PATH"
            )
        if not self.config.exists():
            raise AnalyzerNotAvailableError(
                f"semgrep rules config {self.config} does not exist; "
                "set CODESENTINEL_SEMGREP_CONFIG to a rules file or directory"
            )

        cmd = [
            binary,
            "scan",
            "--json",
            "--quiet",
            "--disable-version-check",
            "--config",
            str(self.config),
            "--timeout",
            "20",
            "--jobs",
            "2",
            str(context.project_path),
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
            raise AnalyzerError(f"semgrep scan exceeded {self.timeout_s}s") from None
        except OSError as exc:
            raise AnalyzerError(f"could not launch semgrep: {exc}") from exc

        # semgrep exits 0 (no findings) or 1 (findings found) on success.
        if proc.returncode not in (0, 1):
            tail = "\n".join(proc.stderr.splitlines()[-5:])
            raise AnalyzerError(
                f"semgrep failed with exit code {proc.returncode}: {tail or 'no stderr'}"
            )

        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise AnalyzerError(f"semgrep produced invalid JSON: {exc}") from exc

        return [_to_finding(result) for result in payload.get("results", [])]


def _to_finding(result: Mapping[str, object]) -> Finding:
    extra = result.get("extra", {}) or {}
    metadata = extra.get("metadata", {}) or {}
    severity = _SEVERITY_MAP.get(str(extra.get("severity", "WARNING")).upper(), Severity.MEDIUM)
    category = _CATEGORY_MAP.get(
        str(metadata.get("category", "")).lower(), FindingCategory.VULNERABILITY
    )
    check_id = str(result.get("check_id", "semgrep-rule"))
    path = str(result.get("path", ""))
    start = result.get("start", {}) or {}
    end = result.get("end", {}) or {}
    line_start = start.get("line") if isinstance(start, Mapping) else None
    line_end = end.get("line") if isinstance(end, Mapping) else None
    snippet = str(extra.get("lines", "") or "").strip()
    message = str(extra.get("message", "")).strip() or check_id

    return Finding(
        analyzer="semgrep",
        category=category,
        title=_title_from_rule(check_id),
        description=message,
        severity=severity,
        confidence=Confidence.HIGH,
        file=path,
        line_start=line_start,
        line_end=line_end,
        code_snippet=snippet or None,
        rule_id=check_id,
        evidence={
            "semgrep_severity": str(extra.get("severity", "")),
            "rule_category": str(metadata.get("category", "")),
        },
        remediation=_remediation_from_metadata(metadata),
        metadata={"rule": check_id},
    )


def _title_from_rule(check_id: str) -> str:
    short = check_id.rsplit(".", 1)[-1]
    return short.replace("-", " ").replace("_", " ").title()


def _remediation_from_metadata(metadata: Mapping[str, object]) -> str | None:
    for key in ("fix", "remediation", "message"):
        value = metadata.get(key)
        if value:
            return str(value)
    return None


AnalyzerRegistry.register(SemgrepAnalyzer)
