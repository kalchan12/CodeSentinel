"""Transparent, weight-based risk scoring.

Formula (version "codesentinel-risk-v1"):

    base = severity_weight * confidence_factor * exploitability * impact
    score = min(100, round(base * 10))          # base in [0, 10]

    level (per finding):  >= 75 critical, >= 50 high, >= 25 medium, else low

    scan score = round(0.6 * max_score + 0.4 * weighted_average_score)

All weights are configurable through ``RiskScoringConfig`` so a more
advanced algorithm (ML, CVSS integration, grouped/related findings) can
replace this module later. Every score ships with a human-readable
``rationale`` listing the exact factors used.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from engine.models.finding import Finding, FindingCategory, Severity
from engine.models.risk import (
    FindingRisk,
    PriorityItem,
    RiskBreakdown,
    RiskFactors,
    RiskLevel,
    ScanRiskAssessment,
)

SEVERITY_WEIGHTS_DEFAULT = {
    Severity.INFO: 1.0,
    Severity.LOW: 2.0,
    Severity.MEDIUM: 5.0,
    Severity.HIGH: 8.0,
    Severity.CRITICAL: 10.0,
}

CONFIDENCE_FACTORS_DEFAULT = {
    "low": 0.6,
    "medium": 0.8,
    "high": 1.0,
}

#: Category-level exploitability and impact defaults. Analyzers may
#: override these per finding via ``metadata["exploitability"]`` /
#: ``metadata["impact"]`` (values must be in [0, 1] range… values in (1, 2]
#: are clamped to 1.0 to keep base <= 10).
CATEGORY_EXPLOITABILITY_DEFAULT = {
    FindingCategory.SECRETS: 0.9,
    FindingCategory.VULNERABILITY: 0.8,
    FindingCategory.DEPENDENCY: 0.8,
    FindingCategory.CONFIGURATION: 0.7,
    FindingCategory.CODE_QUALITY: 0.4,
    FindingCategory.REPOSITORY: 0.5,
    FindingCategory.AI_INSIGHT: 0.6,
}

CATEGORY_IMPACT_DEFAULT = {
    FindingCategory.SECRETS: 0.9,
    FindingCategory.VULNERABILITY: 0.9,
    FindingCategory.DEPENDENCY: 0.8,
    FindingCategory.CONFIGURATION: 0.6,
    FindingCategory.CODE_QUALITY: 0.3,
    FindingCategory.REPOSITORY: 0.5,
    FindingCategory.AI_INSIGHT: 0.5,
}

#: Number of top findings surfaced as actionable priorities.
TOP_PRIORITIES_LIMIT = 5

#: Scan-level blend: how much the worst finding dominates the scan score.
WORST_FINDING_WEIGHT = 0.6


class RiskScoringConfig(BaseModel):
    """All knobs of the v1 scoring model."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    severity_weights: dict[str, float] = {k.value: v for k, v in SEVERITY_WEIGHTS_DEFAULT.items()}
    confidence_factors: dict[str, float] = dict(CONFIDENCE_FACTORS_DEFAULT)
    category_exploitability: dict[str, float] = {
        k.value: v for k, v in CATEGORY_EXPLOITABILITY_DEFAULT.items()
    }
    category_impact: dict[str, float] = {k.value: v for k, v in CATEGORY_IMPACT_DEFAULT.items()}

    @classmethod
    def defaults(cls) -> RiskScoringConfig:
        return cls()

    def severity_weight(self, severity: Severity) -> float:
        return self.severity_weights[severity.value]

    def category_factor(self, table: dict[str, float], category: FindingCategory) -> float:
        return table.get(category.value, 0.5)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _score_to_level(score: float) -> RiskLevel:
    if score >= 75:
        return RiskLevel.CRITICAL
    if score >= 50:
        return RiskLevel.HIGH
    if score >= 25:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


class RiskEngine:
    """Computes per-finding and scan-level risk from normalized findings."""

    def __init__(self, config: RiskScoringConfig | None = None) -> None:
        self.config = config or RiskScoringConfig.defaults()

    def grade_finding(self, finding: Finding) -> FindingRisk:
        severity_weight = self.config.severity_weight(finding.severity)
        confidence_factor = self.config.confidence_factors.get(finding.confidence.value, 0.8)

        exploitability = self._factor(finding, "exploitability", finding.category)
        impact = self._factor(finding, "impact", finding.category)

        base = severity_weight * confidence_factor * exploitability * impact
        score = min(100.0, round(base * 10, 2))

        rationale = (
            f"severity={finding.severity.value} (w={severity_weight:g}) "
            f"x confidence={finding.confidence.value} (f={confidence_factor:g}) "
            f"x exploitability={exploitability:g} x impact={impact:g} "
            f"= base {base:.2f} -> score {score:g}"
        )
        return FindingRisk(
            finding_id=finding.id,
            score=score,
            level=_score_to_level(score),
            factors=RiskFactors(
                severity_weight=severity_weight,
                confidence_factor=confidence_factor,
                exploitability=exploitability,
                impact=impact,
            ),
            rationale=rationale,
        )

    def _factor(self, finding: Finding, key: str, category: FindingCategory) -> float:
        value = finding.metadata.get(key) or finding.metadata.get(f"{key}_score")
        if value is not None:
            try:
                return _clamp(float(value))
            except (TypeError, ValueError):
                pass
        table = (
            self.config.category_exploitability
            if key == "exploitability"
            else self.config.category_impact
        )
        return self.config.category_factor(table, category)

    def assess(self, findings: list[Finding]) -> ScanRiskAssessment:
        """Score ``findings`` and produce the full scan assessment."""
        finding_risks = [self.grade_finding(f) for f in findings]

        severity_counts: dict[str, int] = {s.value: 0 for s in Severity}
        for finding in findings:
            severity_counts[finding.severity.value] += 1

        if finding_risks:
            worst = max(fr.score for fr in finding_risks)
            weighted_sum = sum(
                fr.score * self.config.severity_weight(Severity(f.severity.value))
                for f, fr in _pairs(findings, finding_risks)
            )
            weight_total = sum(
                self.config.severity_weight(Severity(f.severity.value)) for f in findings
            )
            weighted_average = weighted_sum / weight_total if weight_total else 0.0
            scan_score = min(
                100.0,
                round(
                    WORST_FINDING_WEIGHT * worst + (1 - WORST_FINDING_WEIGHT) * weighted_average,
                    2,
                ),
            )
        else:
            worst = weighted_average = 0.0
            scan_score = 0.0

        priorities = sorted(
            (
                PriorityItem(
                    finding_id=fr.finding_id,
                    title=f.title,
                    file=f.file,
                    severity=f.severity.value,
                    score=fr.score,
                    remediation=f.remediation,
                )
                for f, fr in _pairs(findings, finding_risks)
            ),
            key=lambda item: item.score,
            reverse=True,
        )[:TOP_PRIORITIES_LIMIT]

        level = _score_to_level(scan_score)
        if finding_risks:
            rationale = (
                f"0.6 * worst({worst:g}) + 0.4 * weighted_avg({weighted_average:.2f})"
                f" = {scan_score:g}"
            )
        else:
            rationale = "no findings, score 0"

        return ScanRiskAssessment(
            score=scan_score,
            level=level,
            finding_risks=finding_risks,
            breakdown=RiskBreakdown(
                finding_count=len(findings),
                severity_counts=severity_counts,
                max_score=worst,
                weighted_average_score=round(weighted_average, 2),
            ),
            top_priorities=priorities,
            rationale=rationale,
        )


def _pairs(findings: list[Finding], risks: list[FindingRisk]) -> list[tuple[Finding, FindingRisk]]:
    """Zip findings with their risks via the finding id (order-safe)."""
    by_id: dict[UUID, FindingRisk] = {r.finding_id: r for r in risks}
    return [(f, by_id[f.id]) for f in findings]
