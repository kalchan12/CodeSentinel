"""Registered-but-not-implemented Semgrep analyzer.

The class below documents the intended contract; the next iteration will
run ``semgrep scan --json`` on the project path and map matches
(rule, severity, path, start/end line, code snippet) onto Finding.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class SemgrepAnalyzer(Analyzer):
    name = "semgrep"
    description = "Semgrep static analysis (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}
        self.binary = self.env.get("CODESENTINEL_SEMGREP_PATH", "semgrep")

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "semgrep analyzer is registered but not implemented yet "
            "(planned: wrap `semgrep scan --json` and normalize matches)"
        )


AnalyzerRegistry.register(SemgrepAnalyzer)
