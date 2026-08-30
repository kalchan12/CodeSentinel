"""Project CRUD via the HTTP API."""

from __future__ import annotations

from pathlib import Path

from httpx import AsyncClient

from tests.conftest import requires_infrastructure


async def _create_local_project(client: AsyncClient, path: str, name: str = "Local") -> dict:
    response = await client.post(
        "/api/projects",
        json={
            "name": name,
            "source_type": "local",
            "local_path": path,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@requires_infrastructure
async def test_create_and_list(client: AsyncClient, sample_project_dir: Path, clean_db) -> None:
    created = await _create_local_project(client, str(sample_project_dir))
    assert created["source_type"] == "local"
    assert created["scan_count"] == 0

    github = await client.post(
        "/api/projects",
        json={
            "name": "Remote",
            "source_type": "github",
            "repo_url": "https://github.com/acme/example",
        },
    )
    assert github.status_code == 201
    assert github.json()["repo_url"].startswith("https://")

    listing = await client.get("/api/projects")
    assert listing.status_code == 200
    assert len(listing.json()) == 2


@requires_infrastructure
async def test_missing_local_path_rejected(client: AsyncClient, clean_db) -> None:
    response = await client.post(
        "/api/projects",
        json={"name": "Broken", "source_type": "local", "local_path": "/no/such/path"},
    )
    assert response.status_code == 422


@requires_infrastructure
async def test_local_path_must_be_directory(
    client: AsyncClient, sample_project_dir: Path, clean_db
) -> None:
    response = await client.post(
        "/api/projects",
        json={
            "name": "File",
            "source_type": "local",
            "local_path": str(sample_project_dir / "app.py"),
        },
    )
    assert response.status_code == 422


@requires_infrastructure
async def test_bad_url_scheme_rejected(client: AsyncClient, clean_db) -> None:
    response = await client.post(
        "/api/projects",
        json={"name": "Evil", "source_type": "github", "repo_url": "file:///etc/passwd"},
    )
    assert response.status_code == 422


@requires_infrastructure
async def test_get_and_delete(client: AsyncClient, sample_project_dir: Path, clean_db) -> None:
    created = await _create_local_project(client, str(sample_project_dir))

    fetched = await client.get(f"/api/projects/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Local"

    deleted = await client.delete(f"/api/projects/{created['id']}")
    assert deleted.status_code == 204

    gone = await client.get(f"/api/projects/{created['id']}")
    assert gone.status_code == 404

@requires_infrastructure
async def test_create_project_rejects_control_chars(client: AsyncClient, clean_db) -> None:
    # Test local path with newline
    resp1 = await client.post(
        "/api/projects",
        json={
            "name": "Bad Path",
            "source_type": "local",
            "local_path": "/valid/path\n/injection",
        },
    )
    assert resp1.status_code == 422
    assert "invalid characters" in resp1.text.lower()

    # Test repo url with newline
    resp2 = await client.post(
        "/api/projects",
        json={
            "name": "Bad URL",
            "source_type": "github",
            "repo_url": "https://github.com/foo/bar\n--upload-pack",
        },
    )
    assert resp2.status_code == 422
    assert "invalid characters" in resp2.text.lower()

    # Test repo url with space
    resp3 = await client.post(
        "/api/projects",
        json={
            "name": "Bad URL Space",
            "source_type": "github",
            "repo_url": "https://github.com/foo/bar --upload-pack",
        },
    )
    assert resp3.status_code == 422
    assert "invalid characters" in resp3.text.lower()
