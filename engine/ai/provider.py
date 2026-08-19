"""AI provider protocol and the default no-op provider."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from engine.models.finding import Confidence, Finding, FindingCategory, Severity
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


class OpenAICompatAIProvider(AIProvider):
    """AI provider for OpenAI-compatible chat-completions endpoints.

    Works with OpenAI, LM Studio, Ollama, vLLM and local proxies: the
    endpoint is configurable through ``CODESENTINEL_AI_BASE_URL``. The
    model is asked for a strict JSON answer which is validated into
    ``AIAnalysisResponse``; unparseable output is returned as raw output
    with zero insights instead of failing the scan.
    """

    name = "openai-compatible"

    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "gpt-4o-mini"

    SYSTEM_PROMPT = (
        "You are a security code reviewer. Analyze the provided project "
        "context and findings. Respond with STRICT JSON only, no prose, "
        "with the shape: "
        '{"insights": [{"title": str, "description": str, "severity": '
        '"info"|"low"|"medium"|"high"|"critical", "confidence": '
        '"low"|"medium"|"high", "file": str, "line": int|null, '
        '"remediation": str}]}. Only report insights you are confident '
        "about; empty list is a valid answer."
    )

    def __init__(
        self,
        env: Mapping[str, str] | None = None,
        client: Any | None = None,
    ) -> None:
        self.env = env or {}
        self.base_url = self.env.get("CODESENTINEL_AI_BASE_URL", self.DEFAULT_BASE_URL).rstrip("/")
        self.api_key = self.env.get("CODESENTINEL_AI_API_KEY", "")
        self.model = self.env.get("CODESENTINEL_AI_MODEL", self.DEFAULT_MODEL)
        self.timeout_s = float(self.env.get("CODESENTINEL_AI_TIMEOUT", 120))
        if client is not None:
            self._client = client
        else:
            import httpx

            self._client = httpx.Client(timeout=self.timeout_s)

    def available(self) -> bool:
        return bool(self.api_key and self.model)

    def analyze(self, request: AIAnalysisRequest) -> AIAnalysisResponse:
        if not self.available():
            raise RuntimeError("OpenAI-compatible provider not configured (missing API key)")

        payload = {
            "model": self.model,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": _user_content(request)},
            ],
        }
        response = self._client.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
            timeout=self.timeout_s,
        )
        response.raise_for_status()
        body = response.json()

        content = (
            body.get("choices", [{}])[0].get("message", {}).get("content", "")
            if isinstance(body, dict)
            else ""
        )
        insights, raw = _parse_insights(content, body)
        return AIAnalysisResponse(
            insights=insights,
            model=self.model,
            provider=self.name,
            raw_output=raw,
        )


def _user_content(request: AIAnalysisRequest) -> str:
    sections: list[str] = [
        f"Project: {request.project_name}",
        f"Project structure:\n{chr(10).join(request.project_structure[:80])}",
    ]
    if request.dependencies:
        sections.append(
            "Dependencies:\n"
            + "\n".join(f"- {d.name} {d.version}" for d in request.dependencies[:50])
        )
    if request.findings:
        sections.append(
            "Existing findings:\n"
            + "\n".join(
                f"- [{f.severity}] {f.title} ({f.file}:{f.line_start or '?'})"
                for f in request.findings[:50]
            )
        )
    if request.snippets:
        sections.append(
            "Code snippets:\n"
            + "\n\n".join(
                f"--- {s.file} ({s.line_start}-{s.line_end}) ---\n{s.code[:4000]}"
                for s in request.snippets[:8]
            )
        )
    return "\n\n".join(sections)


def _parse_insights(content: str, raw_body: dict[str, Any]) -> tuple[list[Finding], dict[str, Any]]:
    import json as _json

    raw: dict[str, Any] = {"api_response": raw_body}
    insights: list[Finding] = []
    if not content:
        return insights, raw

    try:
        parsed = _json.loads(content)
    except (TypeError, _json.JSONDecodeError):
        raw["model_content"] = content[:4000]
        return insights, raw

    entries = parsed.get("insights", []) if isinstance(parsed, dict) else []
    if not isinstance(entries, list):
        entries = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        try:
            insights.append(_to_finding(entry))
        except (ValueError, TypeError):
            continue
    return insights, raw


def _to_finding(entry: dict[str, Any]) -> Finding:
    severity = _enum(Severity, entry.get("severity", "info"))
    confidence = _enum(Confidence, entry.get("confidence", "low"))
    line = entry.get("line")
    return Finding(
        analyzer="ai",
        category=FindingCategory.AI_INSIGHT,
        title=str(entry.get("title", "AI insight"))[:200],
        description=str(entry.get("description", ""))[:2000],
        severity=severity,
        confidence=confidence,
        file=str(entry.get("file", ""))[:500],
        line_start=line if isinstance(line, int) else None,
        line_end=line if isinstance(line, int) else None,
        rule_id="ai-insight",
        remediation=str(entry.get("remediation", ""))[:1000] or None,
        metadata={"provider": "openai-compatible"},
    )


def _enum(enum_cls: type[Any], value: Any) -> Any:
    try:
        return enum_cls(str(value))
    except ValueError:
        return enum_cls("info") if enum_cls is Severity else enum_cls("low")
