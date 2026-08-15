"""Registered-but-not-implemented configuration analyzer.

Planned: checks security-relevant settings in config files
(.env, application.yml, docker-compose.yml, CI workflows): missing
authentication, open CORS, debug mode in production, insecure TLS
settings, weak password policies.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding


class ConfigurationAnalyzer(Analyzer):
    name = "configuration"
    description = "Security configuration analysis (planned)"
    implemented = False

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        raise AnalyzerNotAvailableError(
            "configuration analyzer is registered but not implemented yet "
            "(planned: security-relevant configuration checks)"
        )


AnalyzerRegistry.register(ConfigurationAnalyzer)
