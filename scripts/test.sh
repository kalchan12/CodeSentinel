#!/usr/bin/env bash
# Run the Python test suite (unit + integration + security).
# Integration tests require PostgreSQL and Redis; use docker compose up first,
# or set CODESENTINEL_DATABASE_URL / CODESENTINEL_REDIS_URL to non-container instances.
set -euo pipefail
cd "$(dirname "$0")/.."

.venv/bin/pytest "$@"