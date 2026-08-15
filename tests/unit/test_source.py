"""Source resolution rules."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.core.errors import SourceNotFoundError, UnsupportedSourceError
from engine.core.source import ProjectSourceResolver
from engine.models.source import ProjectSource, SourceType


@pytest.fixture
def resolver(tmp_path: Path) -> ProjectSourceResolver:
    return ProjectSourceResolver(tmp_path / "workspace")


def test_local_missing_path(resolver: ProjectSourceResolver) -> None:
    source = ProjectSource(type=SourceType.LOCAL, local_path="/does/not/exist/xyz")
    with pytest.raises(SourceNotFoundError):
        resolver.resolve(source, project_id=1)


def test_local_file_is_not_directory(resolver: ProjectSourceResolver, tmp_path: Path) -> None:
    file_path = tmp_path / "file.txt"
    file_path.write_text("hi")
    source = ProjectSource(type=SourceType.LOCAL, local_path=str(file_path))
    with pytest.raises(UnsupportedSourceError):
        resolver.resolve(source, project_id=1)


def test_local_directory_ok(resolver: ProjectSourceResolver, tmp_path: Path) -> None:
    source = ProjectSource(type=SourceType.LOCAL, local_path=str(tmp_path))
    resolved = resolver.resolve(source, project_id=1)
    assert resolved.path == tmp_path.resolve()


def test_github_requires_url() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ProjectSource(type=SourceType.GITHUB, repo_url=None)


def test_file_url_rejected(resolver: ProjectSourceResolver) -> None:
    source = ProjectSource(type=SourceType.GITHUB, repo_url="file:///etc/passwd")
    with pytest.raises(UnsupportedSourceError):
        resolver.resolve(source, project_id=1)


def test_git_ssh_scheme_rejected(resolver: ProjectSourceResolver) -> None:
    source = ProjectSource(type=SourceType.GITHUB, repo_url="git@github.com:org/repo.git")
    with pytest.raises(UnsupportedSourceError):
        resolver.resolve(source, project_id=1)
