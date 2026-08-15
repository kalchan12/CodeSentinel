# CodeSentinel backend image.
# The same image runs both the FastAPI HTTP service and the Celery worker
# (see entrypoint.sh and docker-compose.yml).

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CODESENTINEL_DATA_DIR=/data

# git is required to clone GitHub repositories into the local workspace.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY engine/ ./engine/
COPY apps/ ./apps/
COPY docker/entrypoint.sh /entrypoint.sh

RUN pip install --no-cache-dir -e . \
    && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]