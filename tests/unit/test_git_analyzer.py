"""Git analyzer: repository hygiene checks against a real git repo."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from engine.analyzers.git.analyzer import GitAnalyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType

GIT_AVAILABLE = shutil.which("git") is not None


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    if not GIT_AVAILABLE:
        pytest.skip("git not installed")
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    subprocess.run(
        ["git", "-C", str(tmp_path), "config", "user.email", "t@example.com"], check=True
    )
    subprocess.run(["git", "-C", str(tmp_path), "config", "user.name", "T"], check=True)
    (tmp_path / "ok.py").write_text("x = 1\n")
    subprocess.run(["git", "-C", str(tmp_path), "add", "."], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "commit", "-qm", "init"], check=True)
    return tmp_path


def test_requires_git_repo(tmp_path: Path) -> None:
    (tmp_path / "x.py").write_text("x = 1\n")
    with pytest.raises(AnalyzerNotAvailableError):
        GitAnalyzer().analyze(_context(tmp_path))


def test_clean_repo_reports_nothing(repo: Path) -> None:
    (repo / ".gitignore").write_text("__pycache__/\n")
    subprocess.run(["git", "-C", str(repo), "add", ".gitignore"], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "commit", "-qm", "gitignore"], check=True
    )
    assert GitAnalyzer().analyze(_context(repo)) == []


def test_tracked_secret_file_flagged(repo: Path) -> None:
    (repo / ".env").write_text("SECRET=value\n")
    subprocess.run(["git", "-C", str(repo), "add", ".env"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "add env"], check=True)
    findings = GitAnalyzer().analyze(_context(repo))
    secret = next(f for f in findings if f.rule_id == "tracked-sensitive-files")
    assert secret.category is FindingCategory.SECRETS
    assert secret.severity is Severity.HIGH
    assert secret.file == ".env"
    assert ".env" in secret.evidence["files"]


def test_missing_gitignore_flagged(repo: Path) -> None:
    findings = GitAnalyzer().analyze(_context(repo))
    assert any(f.rule_id == "missing-gitignore" for f in findings)


def test_gitignore_present_not_flagged(repo: Path) -> None:
    (repo / ".gitignore").write_text("__pycache__/\n")
    subprocess.run(["git", "-C", str(repo), "add", ".gitignore"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "gitignore"], check=True)
    findings = GitAnalyzer().analyze(_context(repo))
    assert all(f.rule_id != "missing-gitignore" for f in findings)


def test_dirty_working_tree_flagged(repo: Path) -> None:
    (repo / "uncommitted.py").write_text("x = 2\n")
    findings = GitAnalyzer().analyze(_context(repo))
    dirty = next(f for f in findings if f.rule_id == "dirty-working-tree")
    assert dirty.severity is Severity.INFO
    assert dirty.evidence["changed_entries"] == 1


def test_large_tracked_file_flagged(repo: Path) -> None:
    big = repo / "big.bin"
    big.write_bytes(b"0" * (6 * 1024 * 1024))
    subprocess.run(["git", "-C", str(repo), "add", "big.bin"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "big file"], check=True)
    findings = GitAnalyzer().analyze(_context(repo))
    large = next(f for f in findings if f.rule_id == "large-tracked-files")
    assert "big.bin" in large.evidence["files"]
