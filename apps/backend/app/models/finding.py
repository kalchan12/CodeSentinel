"""Finding: one normalized analysis result persisted from the engine model."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    analyzer: Mapped[str] = mapped_column(String(64))
    #: FindingCategory value
    category: Mapped[str] = mapped_column(String(32), index=True)
    #: Severity value
    severity: Mapped[str] = mapped_column(String(16), index=True)
    severity_rank: Mapped[int] = mapped_column(Integer, default=0)
    #: Confidence value
    confidence: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(Text, default="")
    file: Mapped[str] = mapped_column(Text, default="", index=True)
    line_start: Mapped[int | None] = mapped_column(Integer, default=None)
    line_end: Mapped[int | None] = mapped_column(Integer, default=None)
    code_snippet: Mapped[str | None] = mapped_column(Text, default=None)
    rule_id: Mapped[str | None] = mapped_column(String(128), default=None)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    remediation: Mapped[str | None] = mapped_column(Text, default=None)
    #: column named "metadata" (reserved attr name in SQLAlchemy)
    finding_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    risk_score: Mapped[float | None] = mapped_column(Float, default=None)
    risk_level: Mapped[str | None] = mapped_column(String(16), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan: Mapped[Scan] = relationship(back_populates="findings")  # noqa: F821
