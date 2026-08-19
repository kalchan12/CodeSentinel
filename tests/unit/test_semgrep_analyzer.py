"""Semgrep analyzer: CLI wrapping and JSON mapping."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from engine.analyzers.semgrep.analyzer import SemgrepAnalyzer, _to_finding
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType

SEMGREP_AVAILABLE = shutil.which("semgrep") is not None


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


def test_requires_binary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CODESENTINEL_SEMGREP_PATH", "/nonexistent/semgrep")
    analyzer = SemgrepAnalyzer(env={"CODESENTINEL_SEMGREP_PATH": "/nonexistent/semgrep"})
    with pytest.raises(AnalyzerNotAvailableError):
        analyzer.analyze(_context(Path("/tmp")))


def test_requires_rules_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    if not SEMGREP_AVAILABLE:
        pytest.skip("semgrep not installed")
    (tmp_path / "a.py").write_text("x = 1\n")
    analyzer = SemgrepAnalyzer(env={"CODESENTINEL_SEMGREP_CONFIG": str(tmp_path / "missing")})
    with pytest.raises(AnalyzerNotAvailableError):
        analyzer.analyze(_context(tmp_path))


@pytest.mark.skipif(not SEMGREP_AVAILABLE, reason="semgrep not installed")
def test_finds_vulnerable_code(tmp_path: Path) -> None:
    (tmp_path / "vuln.py").write_text(
        "import hashlib\n"
        "import pickle\n"
        "def load(data):\n"
        "    return pickle.loads(data)\n"
        'hashlib.md5(b"x")\n'
    )
    findings = SemgrepAnalyzer().analyze(_context(tmp_path))
    rules = {f.rule_id for f in findings}
    assert "py-insecure-deserialization" in rules
    assert "py-weak-crypto" in rules

    deser = next(f for f in findings if f.rule_id == "py-insecure-deserialization")
    assert deser.category is FindingCategory.VULNERABILITY
    assert deser.severity is Severity.MEDIUM
    assert deser.file == "vuln.py"
    assert deser.line_start is not None
    assert deser.code_snippet


@pytest.mark.skipif(not SEMGREP_AVAILABLE, reason="semgrep not installed")
def test_clean_file_no_findings(tmp_path: Path) -> None:
    (tmp_path / "ok.js").write_text("export const answer = 42;\n")
    findings = SemgrepAnalyzer().analyze(_context(tmp_path))
    assert findings == []


def test_maps_result_shape() -> None:
    result = {
        "check_id": "rules.lang.py-weak-hash",
        "path": "src/hash.py",
        "start": {"line": 3},
        "end": {"line": 3},
        "extra": {
            "message": "MD5 is broken.",
            "severity": "WARNING",
            "lines": "hashlib.md5(x)",
            "metadata": {"category": "security", "cwe": ["CWE-327"]},
        },
    }
    finding = _to_finding(result)
    assert finding.analyzer == "semgrep"
    assert finding.rule_id == "rules.lang.py-weak-hash"
    assert finding.category is FindingCategory.VULNERABILITY
    assert finding.severity is Severity.MEDIUM
    assert finding.file == "src/hash.py"
    assert finding.line_start == 3
    assert finding.evidence["semgrep_severity"] == "WARNING"


def test_maps_secrets_category_and_high_severity() -> None:
    result = {
        "check_id": "p.secrets",
        "path": "a.py",
        "start": {"line": 1},
        "end": {"line": 1},
        "extra": {
            "message": "hardcoded credential",
            "severity": "ERROR",
            "lines": "x",
            "metadata": {"category": "secrets"},
        },
    }
    finding = _to_finding(result)
    assert finding.category is FindingCategory.SECRETS
    assert finding.severity is Severity.HIGH
