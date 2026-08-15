"""Shared enum values persisted as strings."""

from __future__ import annotations

from enum import StrEnum


class ScanStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

    @property
    def is_terminal(self) -> bool:
        return self in (ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELED)


class SourceKind(StrEnum):
    LOCAL = "local"
    GITHUB = "github"
