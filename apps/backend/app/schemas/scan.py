"""Scan schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ScanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    status: str
    progress: float
    celery_task_id: str | None
    error_message: str | None
    findings_count: int
    correlation: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    risk_score: float | None = None
    risk_level: str | None = None

    @classmethod
    def from_model(cls, scan, assessment=None) -> ScanRead:
        data = {
            "id": scan.id,
            "project_id": scan.project_id,
            "status": scan.status,
            "progress": scan.progress,
            "celery_task_id": scan.celery_task_id,
            "error_message": scan.error_message,
            "findings_count": scan.findings_count,
            "correlation": scan.correlation,
            "started_at": scan.started_at,
            "completed_at": scan.completed_at,
            "created_at": scan.created_at,
        }
        if assessment is None and getattr(scan, "assessment", None) is not None:
            assessment = scan.assessment
        if assessment is not None:
            data["risk_score"] = assessment.overall_score
            data["risk_level"] = assessment.overall_level
        return cls(**data)
