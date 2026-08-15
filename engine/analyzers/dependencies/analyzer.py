"""Registered-but-not-implemented dependency analyzer.

Planned: parse lockfiles/manifest files (requirements.txt, package.json,
go.mod, Cargo.lock, ...), then query the OSV API (or a local OSV mirror)
for known vulnerabilities and emit Finding objects with category
``dependency`` plus DependencySummary entries.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class DependencyAnalyzer(Analyzer):
    name = "dependencies"
    description = "OSV-based dependency vulnerability analysis (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "dependencies analyzer is registered but not implemented yet "
            "(planned: lockfile parsing + OSV vulnerability lookup)"
        )


AnalyzerRegistry.register(DependencyAnalyzer)
