"""Risk assessment domain models produced by the risk engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskFactors(BaseModel):
    """The concrete factor values used to compute one finding risk score."""

    model_config = ConfigDict(extra="forbid")

    severity_weight: float
    confidence_factor: float
    exploitability: float
    impact: float


class FindingRisk(BaseModel):
    """Per-finding risk score with the factors that produced it."""

    model_config = ConfigDict(extra="forbid")

    finding_id: UUID
    score: float
    level: RiskLevel
    factors: RiskFactors
    rationale: str


class RiskBreakdown(BaseModel):
    """Aggregate statistics over all findings of a scan."""

    model_config = ConfigDict(extra="forbid")

    finding_count: int
    severity_counts: dict[str, int]
    max_score: float
    weighted_average_score: float


class PriorityItem(BaseModel):
    """One actionable item the developer should look at first."""

    model_config = ConfigDict(extra="forbid")

    finding_id: UUID
    title: str
    file: str
    severity: str
    score: float
    remediation: str | None = None


class ScanRiskAssessment(BaseModel):
    """Overall risk posture of one scan, fully explainable."""

    model_config = ConfigDict(extra="forbid")

    score: float
    level: RiskLevel
    finding_risks: list[FindingRisk] = field(default_factory=list)
    breakdown: RiskBreakdown
    top_priorities: list[PriorityItem] = field(default_factory=list)
    algorithm: str = "codesentinel-risk-v1"
    rationale: str


@dataclass
class DependencySummary:
    """Placeholder structure for dependency analysis output (OSV feed later)."""

    name: str
    version: str
    ecosystem: str
    status: str  # "ok" | "vulnerable" | "unknown"
    advisory_ids: list[str] = field(default_factory=list)
