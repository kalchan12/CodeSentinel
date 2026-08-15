"""Scan: one analysis run of a project (also serves as scan history).

The scan row carries the runtime bookkeeping of its Celery job:
``status``, ``progress``, ``celery_task_id`` and error details.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ScanStatus


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    #: ScanStatus value
    status: Mapped[str] = mapped_column(String(32), default=ScanStatus.PENDING.value, index=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    celery_task_id: Mapped[str | None] = mapped_column(String(64), index=True)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    correlation: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="scans")  # noqa: F821
    findings: Mapped[list[Finding]] = relationship(  # noqa: F821
        back_populates="scan",
        cascade="all, delete-orphan",
        order_by="Finding.severity_rank.desc(), Finding.id",
    )
    assessment: Mapped[RiskAssessment | None] = relationship(  # noqa: F821
        back_populates="scan", cascade="all, delete-orphan", uselist=False
    )
    dependencies: Mapped[list[Dependency]] = relationship(  # noqa: F821
        back_populates="scan", cascade="all, delete-orphan"
    )
