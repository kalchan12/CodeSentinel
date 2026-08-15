"""Risk engine: transparency, factor behavior and aggregation."""

from __future__ import annotations

from engine.models.finding import Confidence, Finding, FindingCategory, Severity
from engine.risk.scoring import RiskEngine


def _finding(
    severity: Severity,
    category: FindingCategory,
    confidence: Confidence = Confidence.MEDIUM,
    **metadata,
) -> Finding:
    return Finding(
        analyzer="mock",
        category=category,
        title="t",
        description="d",
        severity=severity,
        confidence=confidence,
        file="a.py",
        metadata=metadata,
    )


def test_severity_monotonic() -> None:
    engine = RiskEngine()
    scores = {
        s.value: engine.grade_finding(_finding(s, FindingCategory.VULNERABILITY)).score
        for s in Severity
    }
    assert scores["info"] < scores["low"] < scores["medium"] < scores["high"] < scores["critical"]


def test_confidence_raises_score() -> None:
    engine = RiskEngine()
    low = engine.grade_finding(_finding(Severity.HIGH, FindingCategory.SECRETS, Confidence.LOW))
    high = engine.grade_finding(_finding(Severity.HIGH, FindingCategory.SECRETS, Confidence.HIGH))
    assert high.score > low.score


def test_metadata_override_exploitability() -> None:
    engine = RiskEngine()
    default = engine.grade_finding(_finding(Severity.HIGH, FindingCategory.CODE_QUALITY))
    boosted = engine.grade_finding(
        _finding(Severity.HIGH, FindingCategory.CODE_QUALITY, exploitability=1.0, impact=1.0)
    )
    assert boosted.score > default.score


def test_level_thresholds() -> None:
    engine = RiskEngine()
    critical = _finding(Severity.CRITICAL, FindingCategory.SECRETS, Confidence.HIGH)
    high = _finding(Severity.HIGH, FindingCategory.SECRETS, Confidence.HIGH)
    low = _finding(Severity.INFO, FindingCategory.REPOSITORY, Confidence.LOW)
    assert engine.grade_finding(critical).level.value == "critical"
    assert engine.grade_finding(high).level.value == "high"
    assert engine.grade_finding(low).level.value != "critical"


def test_score_capped_at_100() -> None:
    engine = RiskEngine()
    f = _finding(
        Severity.CRITICAL,
        FindingCategory.CONFIGURATION,
        Confidence.HIGH,
        exploitability=1.0,
        impact=1.0,
    )
    assert engine.grade_finding(f).score <= 100.0


def test_rationale_is_human_readable() -> None:
    engine = RiskEngine()
    rationale = engine.grade_finding(_finding(Severity.HIGH, FindingCategory.SECRETS)).rationale
    assert "severity=high" in rationale
    assert "confidence=medium" in rationale


def test_empty_scan_is_low_risk() -> None:
    assessment = RiskEngine().assess([])
    assert assessment.score == 0.0
    assert assessment.level.value == "low"
    assert assessment.breakdown.severity_counts == {
        "info": 0,
        "low": 0,
        "medium": 0,
        "high": 0,
        "critical": 0,
    }


def test_scan_assessment_aggregates_and_prioritizes() -> None:
    findings = [
        _finding(Severity.CRITICAL, FindingCategory.SECRETS, Confidence.HIGH),
        _finding(Severity.MEDIUM, FindingCategory.CODE_QUALITY),
        _finding(Severity.INFO, FindingCategory.REPOSITORY),
    ]
    assessment = RiskEngine().assess(findings)

    assert assessment.breakdown.finding_count == 3
    assert assessment.breakdown.severity_counts["critical"] == 1
    assert assessment.breakdown.severity_counts["medium"] == 1
    assert len(assessment.finding_risks) == 3
    assert len(assessment.top_priorities) == 3
    # The critical finding dominates the scan score.
    assert assessment.score > 50
    # Priorities are sorted by score, best-to-worst findings first.
    scores = [p.score for p in assessment.top_priorities]
    assert scores == sorted(scores, reverse=True)


def test_top_priorities_capped() -> None:
    engine = RiskEngine()
    many = [_finding(Severity.HIGH, FindingCategory.VULNERABILITY) for _ in range(12)]
    assessment = engine.assess(many)
    assert len(assessment.top_priorities) == 5
