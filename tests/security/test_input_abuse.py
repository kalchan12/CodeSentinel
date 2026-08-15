"""Security: input abuse and path handling (no infra needed)."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.core.source import ProjectSourceResolver
from engine.models.source import ProjectSource, SourceType


@pytest.mark.parametrize(
    ("malicious", "reason"),
    [
        ("file:///etc/passwd", "local file scheme"),
        ("git@github.com:org/repo.git", "ssh scheme instead of https"),
        ("javascript://host/path", "javascript scheme"),
    ],
)
def test_repository_url_schemes_rejected(malicious: str, reason: str) -> None:
    resolver = ProjectSourceResolver(Path("/tmp/codesentinel-workspace-test"))
    source = ProjectSource(type=SourceType.GITHUB, repo_url=malicious)
    with pytest.raises(Exception) as exc_info:
        resolver.resolve(source, project_id=1)
    assert "only http(s)" in str(exc_info.value) or "repo_url" in str(exc_info.value)


def test_traversal_into_missing_path_rejected() -> None:
    resolver = ProjectSourceResolver(Path("/tmp/codesentinel-workspace-test"))
    source = ProjectSource(
        type=SourceType.LOCAL, local_path="/tmp/./../nonexistent-codesentinel-dir"
    )
    from engine.core.errors import SourceNotFoundError

    with pytest.raises(SourceNotFoundError):
        resolver.resolve(source, project_id=1)


def test_symlink_dir_resolves_to_target(tmp_path: Path) -> None:
    target = tmp_path / "real"
    target.mkdir()
    link = tmp_path / "link"
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks not supported on this platform")
    resolved = ProjectSourceResolver(Path("/tmp/ws")).resolve(
        ProjectSource(type=SourceType.LOCAL, local_path=str(link)), project_id=1
    )
    assert resolved.path == target.resolve()
