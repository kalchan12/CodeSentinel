# CodeSentinel

**Local-first secure source code analysis & risk assessment platform**

CodeSentinel is a desktop application that analyzes GitHub repositories or
local source-code projects and identifies security risks: source-code
vulnerabilities, insecure coding practices, exposed secrets and credentials,
vulnerable dependencies, security-related configuration issues, and
repository/project risks.

Analysis is an **orchestrated pipeline**: multiple analysis providers
produce normalized findings, findings are correlated, and an explainable
risk engine produces a prioritized risk assessment. AI-assisted analysis is
supported as an optional, provider-configurable layer — the product is fully
functional without any AI model.

```
Repository / local directory
          │
          ▼
  Analysis Orchestrator (Celery worker)
          │
          ▼
  Analyzers (mock today; Semgrep, Gitleaks, tree-sitter, OSV, ... planned)
          │
          ▼
  Finding normalization ──► Finding correlation
          │
          ▼
  Risk assessment (explainable scoring)
          │
          ▼
  PostgreSQL ──► UI dashboard (status, findings, severity, priorities)
```

**Local-first:** source code stays on your machine. GitHub URLs are cloned
into a managed workspace before analysis. All non-AI functionality works
offline. Nothing is uploaded unless you explicitly enable an AI provider.

---

## Repository layout

```
apps/
  desktop/          Tauri desktop shell + Next.js (React, TS, Tailwind, shadcn/ui)
  backend/          FastAPI app (+ Celery app, SQLAlchemy models, Alembic migrations)
engine/
  core/             Analyzer interface, source resolver, orchestrator, registry
  analyzers/        Analysis providers (mock implemented; semgrep/gitleaks/tree_sitter/... planned)
  normalization/    Validation + deduplication of findings
  correlation/      Aggregation across analyzers
  risk/             Transparent risk scoring engine
  ai/               Optional AI provider layer (no-op by default)
  models/           Domain models (Finding, source, risk, results)
packages/shared/
  typescript/       TS types mirroring the API contract (@codesentinel/shared)
tests/
  unit/             Engine unit tests (no infrastructure required)
  integration/      API + full vertical slice (needs PostgreSQL + Redis)
  security/         Input validation and abuse tests
docker/             Image, entrypoint, postgres init
docs/               Architecture, analyzer, environment and API docs
scripts/            setup.sh, dev.sh, test.sh, gen_icons.py
```

---

## Architecture in one screen

- The **desktop app** (Tauri webview) renders the Next.js UI, which talks to the
  **FastAPI backend** over HTTP on `localhost:8000`.
- The backend **never runs analysis inline**: creating a scan enqueues a
  **Celery task** (Redis broker) that runs the analysis pipeline in the worker.
- The **engine** is database-agnostic: it consumes a source descriptor and
  returns domain models. Only the worker's persistence step touches
  PostgreSQL.
- Every analyzer implements the `Analyzer` interface and returns normalized
  `Finding` objects; the **risk engine** only sees normalized findings.

See [docs/architecture/overview.md](docs/architecture/overview.md) for the
full picture and the reasoning behind each decision.

---

## Prerequisites

- Python 3.11+ (tested with 3.12)
- Node.js 20+
- Docker + Docker Compose (for PostgreSQL, Redis, API and worker containers)
- For the Tauri shell: Rust toolchain plus Linux webkit2gtk-4.1 (see
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Quick start (Docker)

```bash
# 1) one-time setup
./scripts/setup.sh
cp .env.example .env

# 2) start the backend stack
docker compose up -d --build
#    - PostgreSQL on :5432
#    - Redis on :6379
#    - FastAPI on :8000  (http://localhost:8000/api/health)
#    - Celery worker (processes scan jobs)

# 3) start the frontend
npm run dev:desktop        # http://localhost:3000
```

Or everything in one go: `./scripts/dev.sh`.

### Try it now

1. Open http://localhost:3000 → **New project**.
2. Pick **Local project** and point it at any source tree on this machine
   (e.g. the `engine/` directory itself).
3. **Run new scan** → the worker runs the mock analyzer, computes risk, and
   the dashboard shows status, findings, severity distribution and top
   priorities.
4. For a GitHub URL, enter `https://github.com/<owner>/<repo>` — it is cloned
   into the local workspace first.

> The **mock analyzer** is the only enabled provider in this vertical slice.
> It scans source files for hardcoded secrets, `eval`/`exec` calls and debug
> configuration. It is deterministic and needs no external tools.

## Running without Docker

The Python parts can run directly:

```bash
# 1) PostgreSQL + Redis (any local install), then:
./scripts/setup.sh
cp .env.example .env

# 2) apply migrations (path A — host psql)
CODESENTINEL_DATABASE_URL=postgresql+psycopg://..."

# 3) run API + worker in separate terminals
.venv/bin/uvicorn app.main:app --reload --app-dir apps/backend --reload-dir engine
.venv/bin/celery -A app.celery_app:celery_app worker --app-dir apps/backend --loglevel=info
```

Migrations are applied automatically by the backend container entrypoint; on
a host you run `alembic -c apps/backend/alembic.ini upgrade head`.

## Tests

```bash
# engine unit tests + security tests (no infrastructure required)
.venv/bin/pytest tests/unit tests/security

# everything incl. integration tests (docker compose up -d --build postgres redis)
./scripts/test.sh

# frontend
npm run typecheck && npm run lint && npm run build

# optional end-to-end (see apps/desktop/playwright.config.ts)
npx playwright install chromium
npm run e2e
```

CI (`.github/workflows/ci.yml`) runs ruff, alembic checks, pytest against
PostgreSQL/Redis service containers, and the frontend typecheck/lint/build.

## Configuration

All backend settings are environment variables prefixed `CODESENTINEL_`
(sourced from `.env`). Full reference: [docs/environment.md](docs/environment.md).

| Variable | Purpose |
| --- | --- |
| `CODESENTINEL_DATABASE_URL` | PostgreSQL DSN |
| `CODESENTINEL_REDIS_URL` | Redis DSN (Celery broker + events) |
| `CODESENTINEL_DATA_DIR` | Workspace for clones and local data |
| `CODESENTINEL_ENABLED_ANALYZERS` | Comma-separated analyzer names (`mock`) |
| `CODESENTINEL_CORS_ORIGINS` | Allowed UI origins |

## Desktop shell (Tauri)

```bash
cd apps/desktop
npm run tauri dev       # dev (uses the Next dev server on :3000)
npm run tauri build     # release (bundles the static Next export in out/)
```

The Tauri shell is intentionally thin: the webview UI talks to the local API
over HTTP. Native Tauri commands (e.g. a directory picker) can be added later
without changing the frontend/backend data flow. Note that building Tauri
requires the platform webview libraries (webkit2gtk-4.1 on Linux).

## Roadmap / planned analyzers

Registered but not implemented (opt-in, fail loudly if enabled):

- `semgrep` — Semgrep CLI static analysis
- `gitleaks` — infrastructure-level secrets detection
- `tree_sitter` — AST-based source analysis
- `dependencies` — OSV-based dependency vulnerability analysis
- `configuration` — security-relevant configuration checks
- `git` — repository hygiene / history exposure analysis
- `ai` — optional AI-assisted analysis (OpenCode / local models) via a
  pluggable `AIProvider`

Follow the "Adding an analyzer" guide in
[docs/architecture/analyzer-architecture.md](docs/architecture/analyzer-architecture.md).

## Docs

- Architecture & data flow — [docs/architecture/overview.md](docs/architecture/overview.md)
- Analyzer architecture & adding analyzers — [docs/architecture/analyzer-architecture.md](docs/architecture/analyzer-architecture.md)
- Environment variables — [docs/environment.md](docs/environment.md)
- API endpoints — [docs/api/endpoints.md](docs/api/endpoints.md)
- Capstone research notes — [docs/research/README.md](docs/research/README.md)

## License

Academic capstone project. No production support implied.