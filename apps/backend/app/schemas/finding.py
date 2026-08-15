"""Finding schemas (mirror of engine.models.finding.Finding + risk fields)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.finding import Finding


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: int
    analyzer: str
    category: str
    severity: str
    confidence: str
    title: str
    description: str
    file: str
    line_start: int | None
    line_end: int | None
    code_snippet: str | None
    rule_id: str | None
    evidence: dict[str, Any] | None
    remediation: str | None
    metadata: dict[str, Any]
    risk_score: float | None
    risk_level: str | None
    created_at: datetime

    @classmethod
    def from_model(cls, finding: Finding) -> FindingRead:
        return cls(
            id=finding.id,
            scan_id=finding.scan_id,
            analyzer=finding.analyzer,
            category=finding.category,
            severity=finding.severity,
            confidence=finding.confidence,
            title=finding.title,
            description=finding.description,
            file=finding.file,
            line_start=finding.line_start,
            line_end=finding.line_end,
            code_snippet=finding.code_snippet,
            rule_id=finding.rule_id,
            evidence=finding.evidence,
            remediation=finding.remediation,
            metadata=finding.finding_metadata or {},
            risk_score=finding.risk_score,
            risk_level=finding.risk_level,
            created_at=finding.created_at,
        )


class FindingsPage(BaseModel):
    total: int
    items: list[FindingRead]
