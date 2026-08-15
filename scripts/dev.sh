#!/usr/bin/env bash
# Start the full local development environment:
# PostgreSQL, Redis, FastAPI + Celery (containers) and the Next.js/Tauri frontend (host).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

set -a
source .env
set +a

echo "[codesentinel] starting backend containers (api on :8000, postgres :5432, redis :6379)"
docker compose up -d --build

echo "[codesentinel] starting frontend (dev server on :3000)"
npm run dev:desktop