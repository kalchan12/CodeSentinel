"""The vertical slice: project -> scan job -> worker -> findings -> risk."""

from __future__ import annotations

from pathlib import Path

from httpx import AsyncClient

from tests.conftest import requires_infrastructure


@requires_infrastructure
async def test_full_scan_flow(
    client: AsyncClient,
    sample_project_dir: Path,
    clean_db,
) -> None:
    project = (
        await client.post(
            "/api/projects",
            json={"name": "Slice", "source_type": "local", "local_path": str(sample_project_dir)},
        )
    ).json()

    created = await client.post(f"/api/projects/{project['id']}/scans", json={})
    assert created.status_code == 201, created.text
    scan = created.json()
    assert scan["status"] == "pending"
    scan_id = scan["id"]

    # Run the worker's task synchronously (no broker needed in tests).
    from app.tasks import run_scan

    run_scan.run(scan_id)

    status = (await client.get(f"/api/scans/{scan_id}")).json()
    assert status["status"] == "completed", status
    assert status["progress"] == 100.0
    assert status["findings_count"] > 0

    findings = (await client.get(f"/api/scans/{scan_id}/findings")).json()
    assert findings["total"] == status["findings_count"]
    assert findings["items"]

    # Severity filter reflects the mock findings.
    filtered = (await client.get(f"/api/scans/{scan_id}/findings?severity=high")).json()
    assert filtered["total"] > 0
    assert all(item["severity"] == "high" for item in filtered["items"])

    wrong_category = (await client.get(f"/api/scans/{scan_id}/findings?category=secretss")).json()
    secrets_category = (await client.get(f"/api/scans/{scan_id}/findings?category=secrets")).json()
    assert wrong_category["total"] == 0
    assert secrets_category["total"] > 0

    assessment = (await client.get(f"/api/scans/{scan_id}/assessment")).json()
    assert assessment["overall_score"] > 0
    assert assessment["overall_level"] in {"low", "medium", "high", "critical"}
    assert assessment["top_priorities"]
    assert assessment["rationale"]

    # Scan history on the project.
    scans = (await client.get(f"/api/projects/{project['id']}/scans")).json()
    assert len(scans) == 1
    assert scans[0]["id"] == scan_id


@requires_infrastructure
async def test_scan_failure_is_reported(
    client: AsyncClient,
    tmp_path: Path,
    clean_db,
) -> None:
    project_dir = tmp_path / "vanishing"
    project_dir.mkdir()
    project = (
        await client.post(
            "/api/projects",
            json={"name": "Vanishing", "source_type": "local", "local_path": str(project_dir)},
        )
    ).json()

    project_dir.rmdir()  # source disappears before analysis

    scan = (await client.post(f"/api/projects/{project['id']}/scans", json={})).json()

    from app.tasks import run_scan

    run_scan.run(scan["id"])  # synchronous execution; failure is expected

    status = (await client.get(f"/api/scans/{scan['id']}")).json()
    assert status["status"] == "failed"
    assert status["error_message"]


@requires_infrastructure
async def test_assessment_missing_while_running(
    client: AsyncClient, sample_project_dir: Path, clean_db
) -> None:
    project = (
        await client.post(
            "/api/projects",
            json={"name": "P", "source_type": "local", "local_path": str(sample_project_dir)},
        )
    ).json()
    scan = (await client.post(f"/api/projects/{project['id']}/scans", json={})).json()
    before = await client.get(f"/api/scans/{scan['id']}/assessment")
    assert before.status_code == 404
