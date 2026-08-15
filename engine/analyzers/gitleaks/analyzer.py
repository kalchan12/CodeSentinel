"""Registered-but-not-implemented Gitleaks analyzer (secrets detection).

Planned: run ``gitleaks detect --source <path> --report-format json`` and
map leaks (file, start/end line, rule, secret) onto Finding objects with
category ``secrets``.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class GitleaksAnalyzer(Analyzer):
    name = "gitleaks"
    description = "Gitleaks secrets detection (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}
        self.binary = self.env.get("CODESENTINEL_GITLEAKS_PATH", "gitleaks")

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "gitleaks analyzer is registered but not implemented yet "
            "(planned: wrap `gitleaks detect --report-format json`)"
        )


AnalyzerRegistry.register(GitleaksAnalyzer)
