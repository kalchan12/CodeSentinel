"""Finding model contract tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from engine.models.finding import Confidence, Finding, FindingCategory, Severity


def test_defaults() -> None:
    finding = Finding(
        analyzer="mock",
        category=FindingCategory.SECRETS,
        title="t",
        description="d",
        severity=Severity.HIGH,
        confidence=Confidence.MEDIUM,
        file="src/a.py",
        line_start=3,
    )
    assert isinstance(str(finding.id), str)
    assert finding.metadata == {}
    assert finding.rule_id is None


def test_extra_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        Finding(
            analyzer="mock",
            category=FindingCategory.SECRETS,
            title="t",
            description="d",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            file="x",
            unexpected="boom",
        )


def test_severity_rank_ordering() -> None:
    assert Severity.INFO.rank < Severity.LOW.rank < Severity.MEDIUM.rank
    assert Severity.MEDIUM.rank < Severity.HIGH.rank < Severity.CRITICAL.rank
    assert Severity.CRITICAL.rank == 4


def test_missing_required_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        Finding(analyzer="mock", title="t")  # missing required fields
