"""Redis-based scan events (progress status channel).

The frontend currently polls the API; this channel is already published
so a future SSE/live view can subscribe without backend changes.
"""

from __future__ import annotations

import json

import redis

from app.config import settings


def publish_scan_event(scan_id: int, payload: dict) -> None:
    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2)
        client.publish(f"codesentinel:scan:{scan_id}", json.dumps(payload))
        client.close()
    except redis.RedisError:
        # Events are best-effort; polling remains the source of truth.
        pass
