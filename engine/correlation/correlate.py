"""Aggregate normalized findings into a correlation report."""

from __future__ import annotations

from dataclasses import dataclass, field

from engine.models.finding import Finding


@dataclass
class CorrelationReport:
    """Structural summary of findings across analyzers."""

    findings_count: int
    by_category: dict[str, int] = field(default_factory=dict)
    by_file: dict[str, int] = field(default_factory=dict)
    files_with_multiple_findings: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "findings_count": self.findings_count,
            "by_category": self.by_category,
            "by_file": self.by_file,
            "files_with_multiple_findings": self.files_with_multiple_findings,
        }


class FindingCorrelator:
    """Groups normalized findings by category and file."""

    def correlate(self, findings: list[Finding]) -> CorrelationReport:
        by_category: dict[str, int] = {}
        by_file: dict[str, int] = {}
        for finding in findings:
            by_category[finding.category.value] = by_category.get(finding.category.value, 0) + 1
            by_file[finding.file] = by_file.get(finding.file, 0) + 1
        multi = sum(1 for count in by_file.values() if count > 1)
        return CorrelationReport(
            findings_count=len(findings),
            by_category=by_category,
            by_file=by_file,
            files_with_multiple_findings=multi,
        )
