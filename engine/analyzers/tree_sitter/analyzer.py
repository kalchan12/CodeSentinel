"""Registered-but-not-implemented tree-sitter analyzer.

Planned: parse source files with tree-sitter language grammars and run
AST-level pattern rules (taint-style checks, unsafe API usage, input
validation) that complement regex/CLI based analyzers.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class TreeSitterAnalyzer(Analyzer):
    name = "tree_sitter"
    description = "Tree-sitter AST-based source analysis (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "tree_sitter analyzer is registered but not implemented yet "
            "(planned: AST pattern rules over tree-sitter parses)"
        )


AnalyzerRegistry.register(TreeSitterAnalyzer)
