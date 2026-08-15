"""Execution context handed to analyzers by the orchestrator.

The context carries everything an analyzer may need: the resolved local
project path, source metadata, and a progress reporting callback used to
surface progress of long-running analyzers.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from engine.models.source import ProjectSource

#: (work_done, work_total) progress signal reported by an analyzer.
ProgressCallback = Callable[[int, int], None]


@dataclass
class AnalysisContext:
    """Immutable per-scan information shared with all analyzers."""

    project_id: int
    project_name: str
    source: ProjectSource
    project_path: Path
    languages: list[str] = field(default_factory=list)
    progress_callback: ProgressCallback | None = None

    def report_progress(self, done: int, total: int) -> None:
        """Report intra-analyzer progress if a callback is attached."""
        if self.progress_callback is not None:
            self.progress_callback(done, total)
