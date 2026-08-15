"""Result of one orchestrated analysis run."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from engine.correlation.correlate import CorrelationReport
from engine.models.finding import Finding
from engine.models.risk import DependencySummary, ScanRiskAssessment


@dataclass
class OrchestrationResult:
    """Everything produced by ``AnalysisOrchestrator.run``.

    The caller (backend scan task) is responsible for persisting these
    objects. The engine itself never touches the database.
    """

    findings: list[Finding]
    assessment: ScanRiskAssessment
    dependencies: list[DependencySummary] = field(default_factory=list)
    correlation: CorrelationReport | None = None
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
