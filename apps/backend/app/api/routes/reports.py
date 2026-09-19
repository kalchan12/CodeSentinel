from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.finding import Finding
from app.models.project import Project
from app.models.risk_assessment import RiskAssessment
from app.models.scan import Scan
from app.schemas.report import ReportSummary
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{scan_id}/summary", response_model=ReportSummary)
def get_report_summary(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    project = db.query(Project).filter(Project.id == scan.project_id).first()
    assessment = db.query(RiskAssessment).filter(RiskAssessment.scan_id == scan_id).first()
    findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()

    return ReportService.calculate_summary(scan, project, assessment, findings)


@router.get("/{scan_id}/export/json")
def export_report_json(scan_id: int, db: Session = Depends(get_db)):
    summary = get_report_summary(scan_id, db)
    return summary


@router.get("/{scan_id}/export/html")
def export_report_html(scan_id: int, db: Session = Depends(get_db)):
    summary = get_report_summary(scan_id, db)

    compliance_rows = "".join(
        f"<tr><td>{c.framework}</td><td>{c.score}%</td><td>{c.status.upper()}</td>"
        f"<td>{c.violations}</td></tr>"
        for c in summary.compliance
    )

    html_content = f"""
    <html>
        <head>
            <title>Security Report - {summary.projectName}</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 40px; color: #334155; line-height: 1.5;
                }}
                h1 {{ color: #0f172a; margin-bottom: 4px; }}
                .subtitle {{ color: #64748b; font-size: 14px; margin-bottom: 24px; }}
                .summary {{
                    background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px;
                    border-radius: 8px; margin-bottom: 24px;
                }}
                .score {{ font-size: 28px; font-weight: bold; color: #7c3aed; }}
                table {{ border-collapse: collapse; width: 100%; margin-top: 12px; }}
                th, td {{
                    border: 1px solid #e2e8f0; padding: 10px 12px;
                    text-align: left; font-size: 13px;
                }}
                th {{ background-color: #f1f5f9; color: #0f172a; font-weight: 600; }}
            </style>
        </head>
        <body>
            <h1>CodeSentinel Security Report: {summary.projectName}</h1>
            <div class="subtitle">Local-First Source Code Analysis & Risk Assessment</div>
            <div class="summary">
                <p><strong>Scan ID:</strong> #{summary.scanId}</p>
                <p><strong>Generated At:</strong> {summary.generatedAt}</p>
                <p><strong>Overall Risk Score:</strong>
                   <span class="score">{summary.overallScore}/100 (Grade: {summary.grade})</span>
                </p>
                <p><strong>Total Findings:</strong> {summary.totalFindings}</p>
            </div>

            <h2>Severity Breakdown</h2>
            <ul>
                <li><strong>Critical:</strong> {summary.criticalCount}</li>
                <li><strong>High:</strong> {summary.highCount}</li>
                <li><strong>Medium:</strong> {summary.mediumCount}</li>
                <li><strong>Low:</strong> {summary.lowCount}</li>
            </ul>

            <h2>Compliance Posture</h2>
            <table>
                <tr>
                    <th>Framework</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Violations</th>
                </tr>
                {compliance_rows}
            </table>
        </body>
    </html>
    """
    return Response(content=html_content, media_type="text/html")


@router.get("/{scan_id}/export/pdf")
def export_report_pdf(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    project = db.query(Project).filter(Project.id == scan.project_id).first()
    assessment = db.query(RiskAssessment).filter(RiskAssessment.scan_id == scan_id).first()
    findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()

    pdf_bytes = ReportService.generate_pdf_report(scan, project, assessment, findings)

    project_slug = project.name.lower().replace(" ", "_") if project else "project"
    filename = f"codesentinel_report_{project_slug}_scan_{scan_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
