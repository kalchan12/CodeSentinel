"""Mock analyzer behavior and determinism."""

from __future__ import annotations

from pathlib import Path

from engine.analyzers.mock.analyzer import MockAnalyzer
from engine.core.context import AnalysisContext
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


def test_detects_known_issues(sample_project_dir: Path) -> None:
    findings = MockAnalyzer().analyze(_context(sample_project_dir))
    rules = {f.rule_id for f in findings}
    assert "mock-secret-in-code" in rules
    assert "mock-dynamic-code-exec" in rules
    assert "mock-debug-enabled" in rules

    secret = next(f for f in findings if f.rule_id == "mock-secret-in-code")
    assert secret.severity is Severity.HIGH
    assert secret.category is FindingCategory.SECRETS
    assert secret.file == "app.py"
    assert "evidence" in secret.evidence or secret.evidence is not None


def test_clean_repo_reports_info(tmp_path: Path) -> None:
    (tmp_path / "clean.py").write_text("def f():\n    return 1\n")
    findings = MockAnalyzer().analyze(_context(tmp_path))
    assert len(findings) == 1
    assert findings[0].severity is Severity.INFO
    assert findings[0].rule_id == "mock-clean"


def test_skips_dependency_directories(tmp_path: Path) -> None:
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "bad.js").write_text('const key = "leaky-secret-123"\n')
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.js").write_text("export const x = 1\n")
    findings = MockAnalyzer().analyze(_context(tmp_path))
    assert all("node_modules" not in f.file for f in findings)
    # still finds nothing bad -> info finding
    assert findings and findings[0].severity is Severity.INFO


def test_deterministic_rule_set(sample_project_dir: Path) -> None:
    first = MockAnalyzer().analyze(_context(sample_project_dir))
    second = MockAnalyzer().analyze(_context(sample_project_dir))
    assert [f.rule_id for f in first] == [f.rule_id for f in second]
