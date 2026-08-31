#!/usr/bin/env bash
# Start the full local development environment:
# FastAPI backend (background) and the Next.js/Tauri frontend (foreground).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "[codesentinel] no .env found — using built-in defaults (see docs/environment.md)"
fi

echo "[codesentinel] cleaning up orphaned ports..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

echo "[codesentinel] starting backend (FastAPI on :8000)"
cd apps/backend
PYTHONPATH=. ../../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd ../..

trap "kill $BACKEND_PID" EXIT

echo "[codesentinel] starting frontend (Tauri desktop app)"
npm run tauri dev -w @codesentinel/desktop
