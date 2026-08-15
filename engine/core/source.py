"""Resolves a ProjectSource into a local directory ready for analysis.

Local-first guarantee: GitHub URLs are cloned once into the managed
workspace (``<data_dir>/workspace/<project_id>``) and afterwards analysed
exactly like local projects. Nothing is ever uploaded; only targeted,
contextual content is sent to AI providers when explicitly enabled.
"""

from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from engine.core.errors import SourceNotFoundError, SourceResolutionError, UnsupportedSourceError
from engine.models.source import ProjectSource

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedProjectSource:
    """A successfully resolved, locally-available source tree."""

    path: Path
    source: ProjectSource
    is_git_repo: bool = False


class ProjectSourceResolver:
    """Turns a ProjectSource descriptor into a local directory."""

    GIT_URL_PATTERNS = (re.compile(r"^https?://"),)

    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root

    def resolve(self, source: ProjectSource, project_id: int) -> ResolvedProjectSource:
        if source.type.value == "local":
            return self._resolve_local(source)
        return self._resolve_remote(source, project_id)

    def _resolve_local(self, source: ProjectSource) -> ResolvedProjectSource:
        assert source.local_path is not None  # guaranteed by the model validator
        path = Path(source.local_path).expanduser().resolve()
        if not path.exists():
            raise SourceNotFoundError(f"path does not exist: {source.local_path}")
        if not path.is_dir():
            raise UnsupportedSourceError(f"path is not a directory: {source.local_path}")
        is_git = (path / ".git").exists()
        logger.info("resolved local source %s (git=%s)", path, is_git)
        return ResolvedProjectSource(path=path, source=source, is_git_repo=is_git)

    def _resolve_remote(self, source: ProjectSource, project_id: int) -> ResolvedProjectSource:
        assert source.repo_url is not None
        url = source.repo_url.strip()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise UnsupportedSourceError(
                f"only http(s) repository URLs are supported, got scheme {parsed.scheme!r}"
            )
        dest = self.workspace_root / str(project_id)
        if (dest / ".git").exists():
            logger.info("repository already cloned at %s", dest)
            return ResolvedProjectSource(path=dest, source=source, is_git_repo=True)

        self.workspace_root.mkdir(parents=True, exist_ok=True)
        logger.info("cloning %s into %s (shallow)", url, dest)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", url, str(dest)],
                check=True,
                capture_output=True,
                timeout=300,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise SourceResolutionError(f"failed to clone {url}: {exc}") from exc
        return ResolvedProjectSource(path=dest, source=source, is_git_repo=True)
