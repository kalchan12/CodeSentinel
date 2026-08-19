"""Gitleaks analyzer: CLI wrapping and leak mapping."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from engine.analyzers.gitleaks.analyzer import GitleaksAnalyzer, _to_finding
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType

GITLEAKS_AVAILABLE = shutil.which("gitleaks") is not None


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


def test_requires_binary() -> None:
    analyzer = GitleaksAnalyzer(env={"CODESENTINEL_GITLEAKS_PATH": "/nonexistent/gitleaks"})
    with pytest.raises(AnalyzerNotAvailableError):
        analyzer.analyze(_context(Path("/tmp")))


@pytest.mark.skipif(not GITLEAKS_AVAILABLE, reason="gitleaks not installed")
def test_detects_hardcoded_secret(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text('API_KEY = "sk-live-a1b2c3d4e5f6g7h8i9j0"\n')
    findings = GitleaksAnalyzer().analyze(_context(tmp_path))
    assert findings, "gitleaks should flag the hardcoded API key"
    finding = findings[0]
    assert finding.category is FindingCategory.SECRETS
    assert finding.severity is Severity.HIGH or finding.severity is Severity.MEDIUM
    assert finding.file == "app.py"
    assert finding.line_start == 1
    assert finding.evidence.get("redacted") is True
    assert finding.code_snippet is None or "sk-live-" not in finding.code_snippet


@pytest.mark.skipif(not GITLEAKS_AVAILABLE, reason="gitleaks not installed")
def test_clean_tree_no_findings(tmp_path: Path) -> None:
    (tmp_path / "ok.py").write_text("x = 1\n")
    assert GitleaksAnalyzer().analyze(_context(tmp_path)) == []


def test_maps_leak_shape() -> None:
    leak = {
        "RuleID": "generic-api-key",
        "Description": "Detected a Generic API Key",
        "StartLine": 4,
        "EndLine": 4,
        "File": "secrets.py",
        "Match": 'GENERIC_KEY = "redacted-by-gitleaks"',
        "Secret": "redacted-by-gitleaks",
        "Commit": "",
    }
    finding = _to_finding(leak)
    assert finding.analyzer == "gitleaks"
    assert finding.category is FindingCategory.SECRETS
    assert finding.rule_id == "generic-api-key"
    assert finding.file == "secrets.py"
    assert finding.line_start == 4
    assert finding.severity is Severity.MEDIUM
    assert finding.evidence["redacted"] is True
