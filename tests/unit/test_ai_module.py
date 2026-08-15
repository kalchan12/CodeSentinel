"""AI layer: no-op provider keeps the pipeline functional without a model."""

from __future__ import annotations

from pathlib import Path

from engine.ai.analyzer import AIAnalyzer, build_ai_request
from engine.ai.provider import NoopAIProvider
from engine.core.context import AnalysisContext
from engine.models.source import ProjectSource, SourceType


def test_noop_provider_not_available() -> None:
    assert NoopAIProvider().available() is False


def test_ai_analyzer_noop_returns_empty() -> None:
    analyzer = AIAnalyzer(provider=NoopAIProvider())
    context = AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path="."),
        project_path=Path("."),
    )
    assert analyzer.analyze(context) == []


def test_context_budget_limits_snippets(tmp_path: Path) -> None:
    for i in range(50):
        (tmp_path / f"file_{i}.py").write_text("# " + "x" * 4000)
    request = build_ai_request(
        AnalysisContext(
            project_id=1,
            project_name="big",
            source=ProjectSource(type=SourceType.LOCAL, local_path=str(tmp_path)),
            project_path=tmp_path,
        )
    )
    total_bytes = sum(len(s.code.encode("utf-8")) for s in request.snippets)
    assert total_bytes <= 48 * 1024 + 4096  # per-file cap tolerance
    assert 0 < len(request.snippets) < 50
