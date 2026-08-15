#!/usr/bin/env bash
# Start the full local development environment:
# PostgreSQL, Redis, FastAPI + Celery (containers) and the Next.js/Tauri frontend (host).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "[codesentinel] no .env found — using built-in defaults (see docs/environment.md)"
fi

echo "[codesentinel] starting backend containers (api on :8000, postgres :5432, redis :6379)"
docker compose up -d --build

echo "[codesentinel] starting frontend (dev server on :3000)"
npm run dev:desktop