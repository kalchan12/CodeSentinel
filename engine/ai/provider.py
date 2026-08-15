"""AI provider protocol and the default no-op provider."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from engine.models.finding import Finding
from engine.models.risk import DependencySummary


class CodeSnippet(BaseModel):
    """A small, targeted source excerpt sent to a provider."""

    model_config = ConfigDict(extra="forbid")

    file: str
    line_start: int | None = None
    line_end: int | None = None
    code: str


class AIAnalysisRequest(BaseModel):
    """Everything a provider may need — bounded and contextual by design."""

    model_config = ConfigDict(extra="forbid")

    project_name: str
    project_structure: list[str] = Field(default_factory=list)
    snippets: list[CodeSnippet] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    dependencies: list[DependencySummary] = Field(default_factory=list)
    security_rules: list[str] = Field(default_factory=list)


class AIAnalysisResponse(BaseModel):
    """Structured insight returned by a provider."""

    model_config = ConfigDict(extra="forbid")

    insights: list[Finding]
    model: str
    provider: str
    raw_output: dict[str, Any] | None = None


class AIProvider(ABC):
    """Interface for AI analysis backends (OpenCode, Ollama, APIs, ...)."""

    name: str = ""

    @abstractmethod
    def available(self) -> bool:
        """Whether this provider can run right now (model configured?)."""

    @abstractmethod
    def analyze(self, request: AIAnalysisRequest) -> AIAnalysisResponse:
        """Run the model over the contextual request and return insights."""


class NoopAIProvider(AIProvider):
    """Default provider: AI analysis disabled until a provider is configured."""

    name = "none"

    def available(self) -> bool:
        return False

    def analyze(self, request: AIAnalysisRequest) -> AIAnalysisResponse:
        raise RuntimeError("no AI provider configured; NoopAIProvider cannot analyze")
