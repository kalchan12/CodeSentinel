"""Validation + deduplication of analyzer output."""

from __future__ import annotations

import logging

from pydantic import ValidationError

from engine.models.finding import Finding

logger = logging.getLogger(__name__)


class FindingNormalizer:
    """Validates and deduplicates findings before they reach correlation/risk."""

    def normalize(self, findings: list[Finding]) -> list[Finding]:
        valid = self.validate_all(findings)
        return self.deduplicate(valid)

    def validate_all(self, findings: list[Finding]) -> list[Finding]:
        """Return findings that are structurally valid and complete."""
        valid: list[Finding] = []
        for finding in findings:
            try:
                Finding.model_validate(finding)
            except ValidationError as exc:
                logger.warning(
                    "dropping invalid finding from analyzer %s: %s",
                    getattr(finding, "analyzer", "<unknown>"),
                    exc.errors()[0]["msg"] if exc.errors() else exc,
                )
                continue
            if not finding.title or not finding.file:
                logger.warning(
                    "dropping finding from %s: title and file are required",
                    finding.analyzer,
                )
                continue
            valid.append(finding)
        return valid

    def deduplicate(self, findings: list[Finding]) -> list[Finding]:
        """Collapse findings that point at the same rule/location.

        Key: (rule_id or title, normalized file path, line_start).
        When duplicates disagree on severity, the most severe wins.
        """
        best: dict[tuple[str, str, int | None], Finding] = {}
        for finding in findings:
            key = (
                finding.rule_id or finding.title,
                finding.file.replace("\\", "/"),
                finding.line_start,
            )
            existing = best.get(key)
            if existing is None or finding.severity.rank > existing.severity.rank:
                best[key] = finding
        deduped = list(best.values())
        if len(deduped) < len(findings):
            logger.info("deduplicated %d findings to %d", len(findings), len(deduped))
        return deduped
