"""OpenAI-compatible AI provider behavior."""

from __future__ import annotations

import json
from pathlib import Path

from engine.ai import build_provider
from engine.ai.analyzer import AIAnalyzer
from engine.ai.provider import (
    AIAnalysisRequest,
    CodeSnippet,
    NoopAIProvider,
    OpenAICompatAIProvider,
)
from engine.core.context import AnalysisContext
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType


class _FakeResponse:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def json(self) -> object:
        return self.payload

    def raise_for_status(self) -> None:
        return None


class _FakeClient:
    def __init__(self, content: str) -> None:
        self.content = content
        self.last_payload: dict[str, object] | None = None

    def post(
        self, url: str, headers: dict[str, str], json: dict[str, object], timeout: float
    ) -> _FakeResponse:
        self.last_payload = json
        body = {
            "choices": [{"message": {"content": self.content}}],
            "usage": {"total_tokens": 42},
        }
        return _FakeResponse(body)


_ENV = {
    "CODESENTINEL_AI_API_KEY": "sk-test",
    "CODESENTINEL_AI_BASE_URL": "https://local.test/v1",
    "CODESENTINEL_AI_MODEL": "test-model",
}


def test_build_provider_noop_without_key() -> None:
    provider = build_provider({})
    assert isinstance(provider, NoopAIProvider)
    assert provider.available() is False


def test_build_provider_openai_compat_with_key() -> None:
    provider = build_provider(_ENV)
    assert isinstance(provider, OpenAICompatAIProvider)
    assert provider.available() is True
    assert provider.model == "test-model"
    assert provider.base_url == "https://local.test/v1"


def test_ai_analyzer_skips_without_provider(tmp_path: Path) -> None:
    root = tmp_path
    context = AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )
    analyzer = AIAnalyzer(env={})
    assert analyzer.analyze(context) == []


def test_provider_parses_insights() -> None:
    content = json.dumps(
        {
            "insights": [
                {
                    "title": "Hardcoded password in app.py",
                    "description": "A password is hardcoded.",
                    "severity": "high",
                    "confidence": "medium",
                    "file": "app.py",
                    "line": 12,
                    "remediation": "Use an env var.",
                }
            ]
        }
    )
    provider = OpenAICompatAIProvider(env=_ENV, client=_FakeClient(content))
    request = AIAnalysisRequest(
        project_name="demo",
        project_structure=["app.py"],
        snippets=[CodeSnippet(file="app.py", code="x = 1")],
    )
    response = provider.analyze(request)
    assert len(response.insights) == 1
    insight = response.insights[0]
    assert insight.analyzer == "ai"
    assert insight.category is FindingCategory.AI_INSIGHT
    assert insight.severity is Severity.HIGH
    assert insight.file == "app.py"
    assert insight.line_start == 12
    assert response.model == "test-model"
    assert insight.rule_id == "ai-insight"


def test_provider_handles_invalid_severity() -> None:
    content = json.dumps(
        {
            "insights": [
                {
                    "title": "x",
                    "description": "y",
                    "severity": "ultra-severe",
                    "file": "a.py",
                }
            ]
        }
    )
    provider = OpenAICompatAIProvider(env=_ENV, client=_FakeClient(content))
    response = provider.analyze(AIAnalysisRequest(project_name="demo"))
    assert response.insights[0].severity is Severity.INFO


def test_provider_handles_non_json_output() -> None:
    provider = OpenAICompatAIProvider(env=_ENV, client=_FakeClient("sorry, no json"))
    response = provider.analyze(AIAnalysisRequest(project_name="demo"))
    assert response.insights == []
    assert response.raw_output is not None


def test_provider_analyzer_roundtrip(tmp_path: Path) -> None:
    content = json.dumps(
        {"insights": [{"title": "t", "description": "d", "severity": "low", "file": "a.py"}]}
    )
    provider = OpenAICompatAIProvider(env=_ENV, client=_FakeClient(content))
    analyzer = AIAnalyzer(env=_ENV, provider=provider)
    context = AnalysisContext(
        project_id=1,
        project_name="demo",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(tmp_path)),
        project_path=tmp_path,
    )
    (tmp_path / "a.py").write_text("x = 1\n")
    findings = analyzer.analyze(context)
    assert len(findings) == 1
    assert findings[0].category is FindingCategory.AI_INSIGHT
