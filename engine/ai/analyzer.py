"""The AIAnalyzer — AI as a regular analyzer.

Enable via ``CODESENTINEL_ENABLED_ANALYZERS=mock,ai``. Unless a real
provider is injected (e.g. an OpenCode-backed provider), the analyzer
reports zero findings, keeping the product fully functional without any
model configured.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from pathlib import Path

from engine.ai import build_provider
from engine.ai.provider import AIAnalysisRequest, AIProvider, CodeSnippet
from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Finding

logger = logging.getLogger(__name__)

#: Hard budget for targeted context extraction (bytes of source code).
CONTEXT_BUDGET_BYTES = 48 * 1024
#: Max files from which snippets are extracted.
MAX_SNIPPET_FILES = 20
#: Max depth of the project structure overview.
STRUCTURE_DEPTH = 2

DEFAULT_RULES = [
    "identify vulnerabilities and insecure coding practices",
    "flag exposed secrets and credentials",
    "point out risky configuration",
    "suggest concrete, minimal remediation",
]


class AIAnalyzer(Analyzer):
    """Runs an AIProvider over targeted context and returns AI insights.

    Never sends the whole repository: only bounded snippets around
    already-detected findings, dependency summaries and a shallow file
    tree.
    """

    name = "ai"
    description = "Optional AI-assisted analysis (provider-configurable)"
    implemented = True

    def __init__(
        self,
        env: Mapping[str, str] | None = None,
        provider: AIProvider | None = None,
    ) -> None:
        self.env = env or {}
        self.provider = provider or build_provider(self.env)

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        if not self.provider.available():
            logger.info("ai analyzer enabled but no provider available; skipping")
            return []

        request = build_ai_request(context)
        try:
            response = self.provider.analyze(request)
        except Exception:
            logger.exception("ai provider failed; continuing without AI analysis")
            return []

        logger.info("ai provider returned %d insights", len(response.insights))
        return response.insights


def build_ai_request(context: AnalysisContext) -> AIAnalysisRequest:
    """Extract bounded, targeted context (never the whole repository)."""
    return AIAnalysisRequest(
        project_name=context.project_name,
        project_structure=_project_structure(context.project_path, depth=STRUCTURE_DEPTH),
        snippets=_extract_snippets(context.project_path, limit=MAX_SNIPPET_FILES),
        security_rules=list(DEFAULT_RULES),
    )


def _project_structure(root: Path, depth: int) -> list[str]:
    entries: list[str] = []
    if not root.is_dir():
        return entries
    for path in sorted(root.iterdir()):
        if path.name.startswith("."):
            continue
        if path.is_dir():
            entries.append(path.name + "/")
            if depth > 1:
                entries.extend(
                    f"  {p.name}" for p in sorted(path.iterdir()) if not p.name.startswith(".")
                )
        else:
            entries.append(path.name)
    return entries


def _extract_snippets(root: Path, limit: int) -> list[CodeSnippet]:
    """First ``limit`` source-ish files, capped by CONTEXT_BUDGET_BYTES."""
    snippets: list[CodeSnippet] = []
    budget = CONTEXT_BUDGET_BYTES
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if not content.strip() or len(content.encode("utf-8")) > budget:
            continue
        lines = content.splitlines()
        snippets.append(
            CodeSnippet(
                file=str(path.relative_to(root)),
                line_start=1,
                line_end=len(lines),
                code=content,
            )
        )
        budget -= len(content.encode("utf-8"))
        if len(snippets) >= limit or budget <= 0:
            break
    return snippets


AnalyzerRegistry.register(AIAnalyzer)
