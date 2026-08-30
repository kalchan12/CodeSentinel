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

        from engine.normalization.semgrep import normalize_semgrep_finding
        return [normalize_semgrep_finding(result) for result in payload.get("results", [])]




AnalyzerRegistry.register(SemgrepAnalyzer)
