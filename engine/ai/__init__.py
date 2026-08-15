"""Optional AI-assisted analysis layer.

Design goals:
- AI is *one* analyzer among many: it implements the same Analyzer
  contract, so it can be enabled/disabled like any other provider.
- The default provider is a no-op; real providers (OpenCode, local
  models like Ollama/LM Studio, or external APIs) plug in later without
  touching the rest of the system.
- Only *targeted, contextual* information is sent to a provider — never
  the whole repository. ``build_ai_request`` extracts bounded snippets
  around existing findings, dependency summaries and a shallow project
  structure overview.
"""
