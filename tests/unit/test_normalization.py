"""Normalization: validation and deduplication tests."""

from __future__ import annotations

from engine.models.finding import Confidence, Finding, FindingCategory, Severity
from engine.normalization.normalize import FindingNormalizer


def _finding(title: str, rule: str, file: str, line: int, severity: Severity) -> Finding:
    return Finding(
        analyzer="mock",
        category=FindingCategory.CODE_QUALITY,
        title=title,
        description="d",
        severity=severity,
        confidence=Confidence.HIGH,
        file=file,
        line_start=line,
        rule_id=rule,
    )


def test_dedupes_by_rule_and_location() -> None:
    dupes = [
        _finding("a", "r1", "x.py", 3, Severity.LOW),
        _finding("a", "r1", "x.py", 3, Severity.MEDIUM),
        _finding("b", "r2", "x.py", 9, Severity.LOW),
    ]
    result = FindingNormalizer().normalize(dupes)
    assert len(result) == 2
    # The more severe duplicate survives.
    assert result[0].severity == Severity.MEDIUM


def test_dedupe_keeps_different_locations() -> None:
    findings = [
        _finding("a", "r1", "x.py", 3, Severity.LOW),
        _finding("a", "r1", "x.py", 9, Severity.LOW),
    ]
    assert len(FindingNormalizer().normalize(findings)) == 2


def test_invalid_findings_dropped() -> None:
    good = _finding("g", "r1", "x.py", 1, Severity.LOW)
    bad = _finding("no-file", "r2", "", 1, Severity.LOW)
    result = FindingNormalizer().normalize([good, bad])
    assert result == [good]


def test_backslash_paths_collapsed() -> None:
    a = _finding("a", "r1", "src\\x.py", 3, Severity.LOW)
    b = _finding("a", "r1", "src/x.py", 3, Severity.LOW)
    assert len(FindingNormalizer().normalize([a, b])) == 1
