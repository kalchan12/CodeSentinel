# Environment Configuration

All backend settings are read from environment variables prefixed with
`CODESENTINEL_`. A `.env` file in the repository root is loaded
automatically (pydantic-settings). Every variable has a safe default, so a
`.env` file is optional. This document is the reference for all of them.

## Full reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `CODESENTINEL_ENVIRONMENT` | `development` | environment label |
| `CODESENTINEL_LOG_LEVEL` | `INFO` | backend logging level |
| `CODESENTINEL_DATABASE_URL` | `postgresql+psycopg://codesentinel:codesentinel@localhost:5432/codesentinel` | SQLAlchemy DSN (psycopg3) |
| `CODESENTINEL_REDIS_URL` | `redis://localhost:6379/0` | Redis DSN; Celery broker/result backend + scan events |
| `CODESENTINEL_DATA_DIR` | `~/.codesentinel` (host) / `/data` (container) | workspace for clones (`<dir>/workspace/`) and local data |
| `CODESENTINEL_ENABLED_ANALYZERS` | `mock` | comma-separated analyzer names running in scans |
| `CODESENTINEL_CORS_ORIGINS` | `http://localhost:3000,http://localhost:1420,tauri://localhost` | comma-separated allowed UI origins |

## How it is applied

- `apps/backend/app/config.py` (pydantic-settings) reads the variables once
  on import; `settings` is the shared singleton.
- `apps/backend/alembic/env.py` reads `CODESENTINEL_DATABASE_URL` for
  migrations.
- `docker-compose.yml` maps the environment for the `backend` and `worker`
  services, reading host defaults through `${VAR:-default}`.
- The test suite forces its own URLs (`CODESENTINEL_TEST_DATABASE_URL`,
  `CODESENTINEL_TEST_REDIS_URL`) and never uses the development database.

## URLs used in development

| Service | URL |
| --- | --- |
| API (FastAPI) | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Frontend (Next.js) | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Analyzer-specific variables (planned analyzers)

When the corresponding analyzer (see `engine/analyzers/`) is implemented it
will honor these:

| Variable | Default | Used by |
| --- | --- | --- |
| `CODESENTINEL_SEMGREP_PATH` | `semgrep` | semgrep analyzer |
| `CODESENTINEL_GITLEAKS_PATH` | `gitleaks` | gitleaks analyzer |
| `CODESENTINEL_*_MODEL`/provider keys | — | ai analyzer (e.g. `CODESENTINEL_AI_PROVIDER`, `CODESENTINEL_AI_MODEL`) |