"""Project: a named source (local path or GitHub URL) that gets scanned."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    #: "local" | "github" (SourceKind)
    source_type: Mapped[str] = mapped_column(String(32))
    local_path: Mapped[str | None] = mapped_column(Text, default=None)
    repo_url: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    scans: Mapped[list[Scan]] = relationship(  # noqa: F821
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Scan.id.desc()",
    )
