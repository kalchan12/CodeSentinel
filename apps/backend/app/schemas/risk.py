"""Risk assessment schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class RiskAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_id: int
    overall_score: float
    overall_level: str
    algorithm: str | None
    rationale: str | None
    breakdown: dict[str, Any] | None
    top_priorities: list[dict[str, Any]] | None
    finding_risks: list[dict[str, Any]] | None
    created_at: datetime

    @classmethod
    def from_model(cls, assessment) -> RiskAssessmentRead:
        return cls(
            id=assessment.id,
            scan_id=assessment.scan_id,
            overall_score=assessment.overall_score,
            overall_level=assessment.overall_level,
            algorithm=assessment.algorithm,
            rationale=assessment.rationale,
            breakdown=assessment.breakdown,
            top_priorities=assessment.top_priorities,
            finding_risks=assessment.finding_risks,
            created_at=assessment.created_at,
        )
