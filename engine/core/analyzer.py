"""The Analyzer plugin interface.

Every analysis tool (Semgrep, Gitleaks, tree-sitter rules, dependency
checks, configuration checks, git/repository analysis, AI-assisted
analysis) implements this interface and returns normalized
``engine.models.finding.Finding`` objects. The orchestrator and the risk
engine only depend on this interface, never on concrete tools.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from engine.core.context import AnalysisContext
from engine.models.finding import Finding


class Analyzer(ABC):
    """A single analysis provider in the engine.

    Implementations must:
    - expose a unique ``name`` (used for registry lookup and provenance)
    - return findings that are already normalized to the Finding model
    - be deterministic where possible (repeatable scans)
    """

    #: unique registry name, e.g. "semgrep", "mock"
    name: str = ""
    #: human-readable description shown in tooling/UI metadata
    description: str = ""
    #: False for registered analyzers that are not implemented yet
    implemented: bool = True

    @abstractmethod
    def analyze(self, context: AnalysisContext) -> list[Finding]:
        """Analyze the project described by ``context`` and return findings.

        Raises:
            engine.core.errors.AnalyzerError: when the analyzer cannot run
                (missing tooling, unimplemented stage, unexpected failure).
        """
        raise NotImplementedError
