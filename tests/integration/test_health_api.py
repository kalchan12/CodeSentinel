"""Health endpoint."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import requires_infrastructure


@requires_infrastructure
async def test_health(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
