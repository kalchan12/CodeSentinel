"""Orchestration pipeline end-to-end (no infra required)."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.core.registry import AnalyzerRegistry, AnalyzerRegistryError, build_orchestrator
from engine.models.source import ProjectSource, SourceType


@pytest.fixture
def orchestrator():
    return build_orchestrator(["mock"], workspace_root=Path("/tmp/codesentinel-workspace-test"))


def test_full_pipeline(sample_project_dir: Path, orchestrator) -> None:
    progress_calls: list[tuple[int, int]] = []

    result = orchestrator.run(
        ProjectSource(type=SourceType.LOCAL, local_path=str(sample_project_dir)),
        project_id=1,
        project_name="sample",
        progress_callback=lambda done, total: progress_calls.append((done, total)),
    )

    assert result.findings
    assert progress_calls == [(1, 1)]
    assert result.assessment.breakdown.finding_count == len(result.findings)
    assert result.correlation is not None
    assert result.correlation.findings_count == len(result.findings)
    assert result.completed_at is not None
    # Every finding got a risk score.
    assert len(result.assessment.finding_risks) == len(result.findings)
    assert all(0 <= fr.score <= 100 for fr in result.assessment.finding_risks)


def test_registry_lists_planned_and_implemented() -> None:
    available = AnalyzerRegistry.available()
    assert available["mock"]["implemented"] is True
    assert available["semgrep"]["implemented"] is False
    assert "gitleaks" in available
    assert "ai" in available


def test_registry_rejects_unprovided_analyzer() -> None:
    with pytest.raises(AnalyzerRegistryError):
        build_orchestrator(["nonexistent"], workspace_root=Path("/tmp/ws"))


def test_registry_rejects_unimplemented_analyzer() -> None:
    with pytest.raises(AnalyzerRegistryError):
        build_orchestrator(["semgrep"], workspace_root=Path("/tmp/ws"))


def test_orchestrator_build_supports_custom_risk_config() -> None:
    from engine.risk.scoring import RiskScoringConfig

    custom = RiskScoringConfig(
        severity_weights={"info": 0.5, "low": 1.0, "medium": 2.0, "high": 3.0, "critical": 4.0}
    )
    orch = build_orchestrator(["mock"], workspace_root=Path("/tmp/ws"), risk_config=custom)
    assert orch.risk_engine is not None
