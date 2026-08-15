"""RiskAssessment: the explainable risk result attached to one scan."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True
    )
    overall_score: Mapped[float] = mapped_column(Float)
    overall_level: Mapped[str] = mapped_column(String(16))
    algorithm: Mapped[str | None] = mapped_column(String(64), default=None)
    rationale: Mapped[str | None] = mapped_column(Text, default=None)
    breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    top_priorities: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    finding_risks: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan: Mapped[Scan] = relationship(back_populates="assessment")  # noqa: F821
