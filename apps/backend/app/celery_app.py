"""Celery application: broker = Redis, tasks auto-discovered in ``app``."""

from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "codesentinel",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    timezone="UTC",
    broker_connection_retry_on_startup=True,
    task_default_queue="codesentinel",
)

celery_app.autodiscover_tasks(["app"])
