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

## Analyzer-specific variables

Honored by the analyzers in `engine/analyzers/`:

| Variable | Default | Used by |
| --- | --- | --- |
| `CODESENTINEL_SEMGREP_PATH` | `semgrep` | semgrep analyzer: binary name/path |
| `CODESENTINEL_SEMGREP_CONFIG` | bundled `rules/` dir | semgrep analyzer: rules file or directory |
| `CODESENTINEL_SEMGREP_TIMEOUT` | `60` | semgrep analyzer: scan timeout (seconds) |
| `CODESENTINEL_GITLEAKS_PATH` | `gitleaks` | gitleaks analyzer: binary name/path |
| `CODESENTINEL_GITLEAKS_TIMEOUT` | `120` | gitleaks analyzer: scan timeout (seconds) |
| `CODESENTINEL_GIT_PATH` | `git` | git analyzer: binary name/path |
| `CODESENTINEL_GIT_TIMEOUT` | `30` | git analyzer: command timeout (seconds) |
| `CODESENTINEL_AI_API_KEY` | *(empty)* | ai analyzer: provider API key; when unset AI stays a no-op |
| `CODESENTINEL_AI_BASE_URL` | `https://api.openai.com/v1` | ai analyzer: OpenAI-compatible endpoint (LM Studio, Ollama, vLLM, ...) |
| `CODESENTINEL_AI_MODEL` | `gpt-4o-mini` | ai analyzer: model name |
| `CODESENTINEL_AI_TIMEOUT` | `120` | ai analyzer: request timeout (seconds) |

## Installing analyzer tooling

- semgrep + tree-sitter grammars: `pip install -e ".[analyzers]"` inside the
  venv (one-time ~75 MB download).
- gitleaks: `scripts/install_gitleaks.sh` (downloads the release binary to
  `~/.local/bin`; override with `GITLEAKS_DEST` / `GITLEAKS_VERSION`).
- `dependencies` needs network access to `api.osv.dev` at scan time; when
  offline it degrades to a single info finding instead of failing the scan.