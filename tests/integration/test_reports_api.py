from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import requires_infrastructure
from app.models.enums import SourceKind
from app.models.project import Project
from app.models.scan import Scan
from app.models.finding import Finding
from app.models.risk_assessment import RiskAssessment
from sqlalchemy.orm import Session

@requires_infrastructure
async def test_reports_api_summary_and_export(client: AsyncClient, db_session: Session) -> None:
    # 1. Setup mock data
    project = Project(name="Report Test", source_type=SourceKind.LOCAL.value, local_path="/tmp")
    db_session.add(project)
    db_session.commit()

    scan = Scan(project_id=project.id, status="completed", findings_count=2)
    db_session.add(scan)
    db_session.commit()

    finding1 = Finding(scan_id=scan.id, title="Vuln 1", severity="critical", rule_id="1", file="a.py", category="vulnerability", confidence="high", analyzer="test")
    finding2 = Finding(scan_id=scan.id, title="Vuln 2", severity="low", rule_id="2", file="b.py", category="vulnerability", confidence="high", analyzer="test")
    assessment = RiskAssessment(scan_id=scan.id, overall_score=85, breakdown={})
    db_session.add_all([finding1, finding2, assessment])
    db_session.commit()

    # 2. Test JSON export (summary)
    resp = await client.get(f"/api/reports/{scan.id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["projectName"] == "Report Test"
    assert data["overallScore"] == 85
    assert data["grade"] == "B+"
    assert data["totalFindings"] == 2
    assert data["criticalCount"] == 1
    assert data["lowCount"] == 1

    # 3. Test HTML export
    html_resp = await client.get(f"/api/reports/{scan.id}/export/html")
    assert html_resp.status_code == 200
    assert "text/html" in html_resp.headers["content-type"]
    assert "Report Test" in html_resp.text

    # 4. Test PDF export
    pdf_resp = await client.get(f"/api/reports/{scan.id}/export/pdf")
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert pdf_resp.content.startswith(b"%PDF-1.4")
