from __future__ import annotations

import uuid

from app.models.finding import Finding
from app.models.project import Project
from app.models.risk_assessment import RiskAssessment
from app.models.scan import Scan
from app.services.report_service import ReportService


def test_calculate_summary_and_benchmarks() -> None:
    project = Project(name="Test Project", local_path="/test/path")
    project.id = 42

    scan = Scan(id=10, project_id=42, status="completed", findings_count=3)
    assessment = RiskAssessment(scan_id=10, overall_score=88.5, breakdown={})

    findings = [
        Finding(
            id=uuid.uuid4(),
            scan_id=10,
            title="SQL Injection",
            severity="critical",
            category="vulnerability",
            analyzer="semgrep",
            confidence="high",
            file="app/db.py",
            line_start=15,
            line_end=16,
            rule_id="sast.sql-injection",
            description="Direct string interpolation into database query.",
            remediation="Use parameterized queries.",
            code_snippet="cursor.execute('SELECT * FROM users WHERE id = ' + user_id)",
        ),
        Finding(
            id=uuid.uuid4(),
            scan_id=10,
            title="Hardcoded API Secret",
            severity="high",
            category="secrets",
            analyzer="gitleaks",
            confidence="high",
            file=".env.backup",
            line_start=1,
            line_end=1,
            rule_id="gitleaks.generic-secret",
            description="Exposed AWS access key in repository backup file.",
            remediation="Revoke secret and purge commit history.",
            code_snippet="AKIAIOSFODNN7EXAMPLE",
        ),
        Finding(
            id=uuid.uuid4(),
            scan_id=10,
            title="Insecure Dependency",
            severity="medium",
            category="dependency",
            analyzer="dependencies",
            confidence="medium",
            file="requirements.txt",
            rule_id="py.unpinned",
            description="Package requests is unpinned.",
            remediation="Pin to specific version requests==2.32.0.",
        ),
    ]

    summary = ReportService.calculate_summary(scan, project, assessment, findings)

    assert summary.projectName == "Test Project"
    assert summary.scanId == 10
    assert summary.overallScore == 88  # round(88.5) = 88
    assert summary.grade == "B+"
    assert summary.totalFindings == 3
    assert summary.criticalCount == 1
    assert summary.highCount == 1
    assert summary.mediumCount == 1
    assert summary.lowCount == 0

    assert len(summary.compliance) == 4
    framework_map = {c.framework: c for c in summary.compliance}
    assert "OWASP Top 10 (2021)" in framework_map
    assert "CWE Top 25 Standards" in framework_map
    assert "Secret Hygiene & Credentials" in framework_map
    assert "SCA / Dependency Health" in framework_map


def test_generate_pdf_report_binary() -> None:
    project = Project(name="Secure App", local_path="/src/app")
    project.id = 1

    scan = Scan(id=5, project_id=1, status="completed", findings_count=1)
    assessment = RiskAssessment(scan_id=5, overall_score=92.0, breakdown={})

    findings = [
        Finding(
            id=uuid.uuid4(),
            scan_id=5,
            title="Reflected XSS",
            severity="high",
            category="vulnerability",
            analyzer="semgrep",
            confidence="high",
            file="views/profile.py",
            line_start=20,
            line_end=22,
            rule_id="sast.xss",
            description="User input echoed without contextual HTML escaping.",
            remediation="Sanitize all user inputs before rendering.",
            code_snippet="return f'<div>Hello {user_name}</div>'",
        )
    ]

    pdf_bytes = ReportService.generate_pdf_report(scan, project, assessment, findings)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_bytes[-1024:]


def test_generate_pdf_report_with_empty_findings() -> None:
    project = Project(name="Clean App", local_path="/clean")
    project.id = 99

    scan = Scan(id=99, project_id=99, status="completed", findings_count=0)
    assessment = RiskAssessment(scan_id=99, overall_score=100.0, breakdown={})

    pdf_bytes = ReportService.generate_pdf_report(scan, project, assessment, [])

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF-1.4")
