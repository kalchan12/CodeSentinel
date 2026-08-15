"""The normalized Finding model: the single contract every analyzer returns.

The risk engine, correlation module, database persistence and the UI all
consume this shape. Stable categories and severities are enforced through
enums so downstream consumers can switch/aggregate reliably.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class Severity(StrEnum):
    """Impact of a finding. ``rank`` is used for stable ordering."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    @property
    def rank(self) -> int:
        return {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}[self.value]


class Confidence(StrEnum):
    """How sure the analyzer is that the finding is real."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FindingCategory(StrEnum):
    """Stable finding categories used by correlation, risk and the UI."""

    SECRETS = "secrets"
    VULNERABILITY = "vulnerability"
    DEPENDENCY = "dependency"
    CONFIGURATION = "configuration"
    CODE_QUALITY = "code_quality"
    REPOSITORY = "repository"
    AI_INSIGHT = "ai_insight"


class Finding(BaseModel):
    """A single normalized analysis finding.

    ``metadata`` is a free-form bag reserved for analyzer-specific facts
    (e.g. the exact matched secret, CVSS vector, matched rule) and for
    risk factors such as ``exploitability`` overrides.
    """

    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    analyzer: str
    category: FindingCategory
    title: str
    description: str
    severity: Severity
    confidence: Confidence
    file: str
    line_start: int | None = None
    line_end: int | None = None
    code_snippet: str | None = None
    rule_id: str | None = None
    evidence: dict[str, Any] | None = None
    remediation: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
