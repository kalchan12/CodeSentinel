"""Analyzer registry: name -> analyzer class, plus environment-driven builds."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.orchestrator import AnalysisOrchestrator
from engine.core.source import ProjectSourceResolver
from engine.correlation.correlate import FindingCorrelator
from engine.normalization.normalize import FindingNormalizer
from engine.risk.scoring import RiskEngine, RiskScoringConfig

#: name -> analyzer class. Analyzers register themselves at import time.
_REGISTRY: dict[str, type[Analyzer]] = {}


class AnalyzerRegistryError(RuntimeError):
    pass


class AnalyzerRegistry:
    """Discoverable registry of all analyzers (implemented and planned)."""

    @classmethod
    def register(cls, analyzer_cls: type[Analyzer]) -> type[Analyzer]:
        if not analyzer_cls.name:
            raise AnalyzerRegistryError(f"{analyzer_cls.__name__} has empty analyzer name")
        _REGISTRY[analyzer_cls.name] = analyzer_cls
        return analyzer_cls

    @classmethod
    def available(cls) -> dict[str, dict[str, str | bool]]:
        return {
            name: {"description": cls.description, "implemented": cls.implemented}
            for name, cls in sorted(_REGISTRY.items())
        }

    @classmethod
    def build(
        cls,
        names: list[str],
        env: Mapping[str, str] | None = None,
    ) -> list[Analyzer]:
        """Instantiate the analyzers listed in ``names``.

        Raises AnalyzerRegistryError for unknown or unimplemented analyzers,
        so a misconfigured ``CODESENTINEL_ENABLED_ANALYZERS`` fails loudly.
        """
        env = env or {}
        analyzers: list[Analyzer] = []
        for raw in names:
            name = raw.strip()
            if not name:
                continue
            analyzer_cls = _REGISTRY.get(name)
            if analyzer_cls is None:
                raise AnalyzerRegistryError(
                    f"unknown analyzer {name!r}; available: {sorted(_REGISTRY)}"
                )
            if not analyzer_cls.implemented:
                raise AnalyzerRegistryError(
                    f"analyzer {name!r} is registered but not implemented yet"
                )
            analyzers.append(analyzer_cls(env=env))
        return analyzers


def build_orchestrator(
    enabled_analyzers: list[str],
    workspace_root: Path,
    risk_config: RiskScoringConfig | None = None,
    env: Mapping[str, str] | None = None,
) -> AnalysisOrchestrator:
    """Convenience factory for the default orchestration pipeline."""
    analyzers = AnalyzerRegistry.build(enabled_analyzers, env=env)
    return AnalysisOrchestrator(
        analyzers=analyzers,
        resolver=ProjectSourceResolver(workspace_root),
        normalizer=FindingNormalizer(),
        correlator=FindingCorrelator(),
        risk_engine=RiskEngine(risk_config),
    )
