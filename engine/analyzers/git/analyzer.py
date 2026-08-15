"""Registered-but-not-implemented git/repository analyzer.

Planned: repository hygiene and exposure checks — default branch state,
dirty working tree, large/committed secret-like history patterns, missing
signing, contributor metadata when running against the local clone.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class GitAnalyzer(Analyzer):
    name = "git"
    description = "Git / repository metadata analysis (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "git analyzer is registered but not implemented yet "
            "(planned: repository hygiene checks)"
        )


AnalyzerRegistry.register(GitAnalyzer)
