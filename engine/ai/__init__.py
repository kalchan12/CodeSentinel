"""Optional AI-assisted analysis layer.

Design goals:
- AI is *one* analyzer among many: it implements the same Analyzer
  contract, so it can be enabled/disabled like any other provider.
- The default provider is a no-op; a real OpenAI-compatible provider is
  activated by setting ``CODESENTINEL_AI_API_KEY`` (+ optional
  ``CODESENTINEL_AI_BASE_URL`` / ``CODESENTINEL_AI_MODEL``).
- Only *targeted, contextual* information is sent to a provider — never
  the whole repository. ``build_ai_request`` extracts bounded snippets
  around existing findings, dependency summaries and a shallow project
  structure overview.
"""

from __future__ import annotations

from collections.abc import Mapping

from engine.ai.provider import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AIProvider,
    CodeSnippet,
    NoopAIProvider,
    OpenAICompatAIProvider,
)


def build_provider(env: Mapping[str, str] | None = None) -> AIProvider:
    """Pick the active AI provider from the environment.

    With ``CODESENTINEL_AI_API_KEY`` set, an OpenAI-compatible provider
    (OpenAI, LM Studio, Ollama, vLLM, ...) is used; otherwise the no-op
    provider keeps scans fully functional with zero AI.
    """
    env = env or {}
    if env.get("CODESENTINEL_AI_API_KEY"):
        return OpenAICompatAIProvider(env=env)
    return NoopAIProvider()


__all__ = [
    "AIAnalysisRequest",
    "AIAnalysisResponse",
    "AIProvider",
    "CodeSnippet",
    "NoopAIProvider",
    "OpenAICompatAIProvider",
    "build_provider",
]
