"""Project schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import SourceKind


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    source_type: SourceKind
    local_path: str | None = None
    repo_url: str | None = None

    @model_validator(mode="after")
    def _validate_source(self) -> ProjectCreate:
        if self.source_type is SourceKind.LOCAL and (
            not self.local_path or not self.local_path.strip()
        ):
            raise ValueError("local projects require a non-empty local_path")
        if self.source_type is SourceKind.GITHUB and (
            not self.repo_url or not self.repo_url.strip()
        ):
            raise ValueError("github projects require a repo_url")
        return self


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    source_type: str
    local_path: str | None
    repo_url: str | None
    scan_count: int = 0
    last_scan_status: str | None = None
    last_scan_id: int | None = None
    last_scan_score: float | None = None
    last_scan_findings_count: int | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, project, scan_count: int = 0, last_scan=None) -> ProjectRead:
        return cls(
            id=project.id,
            name=project.name,
            description=project.description,
            source_type=project.source_type,
            local_path=project.local_path,
            repo_url=project.repo_url,
            scan_count=scan_count,
            last_scan_status=last_scan.status if last_scan else None,
            last_scan_id=last_scan.id if last_scan else None,
            last_scan_score=last_scan.risk_score if last_scan else None,
            last_scan_findings_count=last_scan.findings_count if last_scan else None,
            created_at=project.created_at,
        )
