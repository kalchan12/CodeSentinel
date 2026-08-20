#!/bin/sh
# Entrypoint shared by the backend and worker containers.
# Waits for PostgreSQL, then either runs the worker or applies migrations
# and starts the API.
set -e

echo "[codesentinel] waiting for PostgreSQL..."
python - <<'PY'
import os
import time

import psycopg

url = os.environ["CODESENTINEL_DATABASE_URL"]
# psycopg cannot parse the SQLAlchemy "+psycopg" driver suffix.
url = url.replace("postgresql+psycopg://", "postgresql://", 1)
for _ in range(60):
    try:
        with psycopg.connect(url, connect_timeout=2):
            break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL did not become ready in time")
PY

# The `app` package and alembic scripts live under apps/backend.
cd /app/apps/backend
export PYTHONPATH="/app/apps/backend${PYTHONPATH:+:$PYTHONPATH}"

if [ "$1" = "worker" ]; then
    shift
    echo "[codesentinel] starting Celery worker"
    exec celery -A app.celery_app:celery_app worker "$@"
fi

echo "[codesentinel] applying database migrations"
alembic -c alembic.ini upgrade head

echo "[codesentinel] starting API server"
exec "$@"