# CodeSentinel Architecture Overview

This document describes the overall architecture, the data flow of a scan,
and the reasoning behind the major design decisions.

## 1. High-level components

```
┌────────────────────────────── HOST ──────────────────────────────┐
│                                                                  │
│  apps/desktop  ── (Tauri webview) ── Next.js UI (localhost:3000) │
│                     │                                            │
│                     │  HTTP / JSON (localhost:8000, CORS)        │
│                     ▼                                            │
│  apps/backend   FastAPI ── creates scan rows, enqueues Celery    │
│                tasks, serves scan/finding/assessment APIs        │
└──────────────────────────────────────────────────────────────────┘
        │ (Redis broker & progress events)
        ▼
  Celery worker  ── engine.AnalysisOrchestrator ── persists to PostgreSQL
                       │
                       ├─ resolver  (local path | git clone into workspace)
                       ├─ analyzers (plugin interface)
                       ├─ normalization (validate + dedupe)
                       ├─ correlation (group/aggregate)
                       └─ risk engine (explainable scoring)
```

Runtime pieces:

| Component | Where | Role |
| --- | --- | --- |
| Next.js UI | host (webview / browser) | project & scan management, results dashboard |
| FastAPI | container (`:8000`) | API layer; never runs analysis inline |
| Celery worker | container | executes the analysis pipeline per scan |
| PostgreSQL | container | source of truth for projects/scans/findings/assessments |
| Redis | container | Celery broker + scan progress event channel |

The repo is a **single Python distribution**: installing the root
`pyproject.toml` installs the `engine` package *and* the `app` backend
package into one environment. This keeps the worker and the API on the same
code (one image, two commands) which is the simplest local-first setup and
requires no IPC/networking between analysis code and persistence code.

## 2. Scan lifecycle (the vertical slice)

```
POST /api/projects/{id}/scans
  1. A Scan row is created (status=pending) and committed.
  2. Celery task `scans.run_scan` is enqueued on Redis.
  3. The worker:
       a. resolves the source:
            local  -> must exist and be a directory
            github -> cloned (shallow) into <data>/workspace/<project_id>
       b. builds the pipeline from the enabled analyzers (env)
       c. runs each analyzer; findings accumulated
       d. normalization (validation + dedup)
       e. correlation report
       f. risk engine -> per-finding scores + scan assessment
       g. persists findings, risk assessment, updates scan row
  4. The UI polls GET /api/scans/{id} every ~2s while running.
```

Long-running scans never block HTTP requests: the API only creates the job
and returns its id; execution is asynchronous in the worker.

## 3. Why these decisions?

### 3.1 Engine is database-agnostic
`engine/` only works with Pydantic domain models and returns an
`OrchestrationResult`. Persistence lives in the backend's `scan_service`.
Consequences: the engine is trivially unit-testable, analyzers never touch
SQL, and a future headless CLI or CI runner can reuse the engine unchanged.

Explanation: this keeps separation of concerns clean ("Separate the backend
API from the analysis engine") without paying for a separate service.

### 3.2 Analyzer plugin interface
All analysis providers implement `engine.core.analyzer.Analyzer`:

```python
class Analyzer(ABC):
    name: str
    description: str

    def analyze(context: AnalysisContext) -> list[Finding]: ...
```

The orchestrator, normalization, correlation and risk engine only depend on
this interface and on the `Finding` model — never on Semgrep/Gitleaks/...
Adding an analyzer = adding a module + registering its class. Adding a tool
never modifies orchestration logic or the database (findings are stored
normally).

### 3.3 Risk engine operates on normalized findings only
`engine/risk/scoring.py` implements `codesentinel-risk-v1`, a transparent
weighted formula:

```
score = min(100, severity_weight × confidence_factor × exploitability × impact × 10)
scan   = 0.6 × worst + 0.4 × severity-weighted average
```

Every score carries a human-readable `rationale` and the concrete `factors`
used, so results are explainable. Weights are fully configurable
(`RiskScoringConfig`), making the module cheap to replace with a more
advanced algorithm (CVSS integration, ML, cross-finding correlation).

### 3.4 Local-first source handling
- GitHub URLs are cloned into the managed workspace on the user's machine and
  analysed exactly like local dirs.
- Nothing is uploaded by default. The AI layer (when enabled) only sends
  *bounded, targeted context* (snippets, finding summaries, project
  structure, dependency list) — never the whole repository.

### 3.5 UI polls the API; Redis is already wired for push
Polling (`usePolling`, 2s) is the simplest robust progress mechanism. The
worker also publishes JSON events to `codesentinel:scan:{id}` on Redis —
ready for a future SSE/live view without backend changes.

### 3.6 AI as a configureable provider
`engine/ai/provider.py` defines the `AIProvider` protocol; the default is a
no-op (`NoopAIProvider`). The `ai` analyzer implements the same `Analyzer`
contract, so enabling it is just adding it to
`CODESENTINEL_ENABLED_ANALYZERS`. Real providers (OpenCode, Ollama/LM
Studio, external APIs) can plug in later without redesigning anything.

### 3.7 API design
REST, JSON, `api/` prefix. Enums/domain types come from the engine models so
the UI and the engine share one vocabulary. No authentication in v1 (local
desktop, single user). CORS is limited to the known UI origins.

## 4. Data model

```
projects 1───* scans 1───* findings
                │
                ├──1 risk_assessments
                ├──* dependencies        (OSV analyzer, schema reserved)
                ├──* ai_analyses         (AI layer, schema reserved)
```

`scans` doubles as scan history (each row is one recorded analysis). See
`apps/backend/app/models/` and migration `0001_initial.py`.

## 5. Failure handling

- A scan that fails (bad source, analyzer exception, unexpected error) is
  marked `failed` with an `error_message`; the UI surfaces it.
- Validating frameworks fail loudly: an unknown or unimplemented analyzer in
  `CODESENTINEL_ENABLED_ANALYZERS` raises at orchestrator build time.
- If Redis (the broker) is unreachable when creating a scan, the API returns
  503 but the pending scan row persists.

## 6. What is intentionally deferred

- Real analyzers (Semgrep, Gitleaks, tree-sitter, OSV, configuration, git)
- Authentication, multi-user, cloud deployment
- Real AI providers, custom security rulesets, SSE live updates
- Native Tauri commands (directory picker, tray integration, notifications)

## 7. Adding future stages

The pipeline stages are dependency-injected into `AnalysisOrchestrator`
(resolver, normalizer, correlator, risk engine). Replacing or adding a stage
is a constructor change at `engine/core/registry.py:build_orchestrator` — no
core module knows or cares about the concrete implementations.