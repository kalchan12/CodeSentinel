#!/usr/bin/env bash
# One-time development setup: Python environment + npm workspaces.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e ".[dev]"
npm install

echo
echo "Setup complete."
echo "  Next:   (optional) create .env to override defaults — see docs/environment.md"
echo "  Then:   docker compose up -d --build   (or run ./scripts/dev.sh)"
echo "After that, open http://localhost:3000 and http://localhost:8000/api/health"