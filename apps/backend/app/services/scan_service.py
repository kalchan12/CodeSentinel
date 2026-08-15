"""Scan bookkeeping: creation, status updates, result persistence.

Only the Celery worker persists scan results through this service; the
HTTP layer creates scans and reads their state.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import ScanStatus
from app.models.finding import Finding as FindingModel
from app.models.risk_assessment import RiskAssessment
from app.models.scan import Scan
from app.schemas.finding import FindingRead
from app.schemas.risk import RiskAssessmentRead
from app.schemas.scan import ScanRead
from engine.models.result import OrchestrationResult

logger = logging.getLogger(__name__)


def create_scan(db: Session, project_id: int) -> Scan:
    scan = Scan(project_id=project_id, status=ScanStatus.PENDING.value)
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def get_scan(db: Session, scan_id: int) -> Scan | None:
    return db.get(Scan, scan_id)


def list_scans(db: Session, project_id: int) -> list[ScanRead]:
    scans = db.scalars(
        select(Scan).where(Scan.project_id == project_id).order_by(Scan.id.desc())
    ).all()
    return [ScanRead.from_model(scan) for scan in scans]


def get_scan_read(db: Session, scan_id: int) -> ScanRead | None:
    scan = get_scan(db, scan_id)
    if scan is None:
        return None
    assessment = db.scalars(select(RiskAssessment).where(RiskAssessment.scan_id == scan_id)).first()
    return ScanRead.from_model(scan, assessment=assessment)


def start_scan(db: Session, scan_id: int, task_id: str) -> None:
    scan = db.get(Scan, scan_id)
    if scan is None:
        return
    scan.status = ScanStatus.RUNNING.value
    scan.started_at = datetime.now(UTC)
    scan.celery_task_id = task_id
    db.commit()


def update_progress(db: Session, scan_id: int, progress: float) -> None:
    scan = db.get(Scan, scan_id)
    if scan is None:
        return
    scan.progress = round(progress, 2)
    db.commit()


def persist_results(db: Session, scan_id: int, result: OrchestrationResult) -> None:
    """Store normalized findings, risk assessment and scan bookkeeping."""
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise ValueError(f"scan {scan_id} not found")

    risk_by_id = {r.finding_id: r for r in result.assessment.finding_risks}

    findings: list[FindingModel] = []
    for finding in result.findings:
        risk = risk_by_id.get(finding.id)
        findings.append(
            FindingModel(
                id=finding.id,
                scan_id=scan_id,
                analyzer=finding.analyzer,
                category=finding.category.value,
                severity=finding.severity.value,
                severity_rank=finding.severity.rank,
                confidence=finding.confidence.value,
                title=finding.title,
                description=finding.description,
                file=finding.file,
                line_start=finding.line_start,
                line_end=finding.line_end,
                code_snippet=finding.code_snippet,
                rule_id=finding.rule_id,
                evidence=finding.evidence,
                remediation=finding.remediation,
                finding_metadata=finding.metadata,
                risk_score=risk.score if risk else None,
                risk_level=risk.level.value if risk else None,
            )
        )
    db.add_all(findings)

    assessment = result.assessment
    db.add(
        RiskAssessment(
            scan_id=scan_id,
            overall_score=assessment.score,
            overall_level=assessment.level.value,
            algorithm=assessment.algorithm,
            rationale=assessment.rationale,
            breakdown=assessment.breakdown.model_dump(mode="json"),
            top_priorities=[p.model_dump(mode="json") for p in assessment.top_priorities],
            finding_risks=[fr.model_dump(mode="json") for fr in assessment.finding_risks],
        )
    )

    scan.status = ScanStatus.COMPLETED.value
    scan.progress = 100.0
    scan.findings_count = len(findings)
    scan.correlation = result.correlation.to_dict() if result.correlation else None
    scan.completed_at = datetime.now(UTC)
    db.commit()
    logger.info("persisted %d findings for scan %d", len(findings), scan_id)


def fail_scan(db: Session, scan_id: int, message: str) -> None:
    scan = db.get(Scan, scan_id)
    if scan is None:
        return
    scan.status = ScanStatus.FAILED.value
    scan.error_message = message
    scan.completed_at = datetime.now(UTC)
    db.commit()


def list_findings(
    db: Session,
    scan_id: int,
    severity: str | None = None,
    category: str | None = None,
    limit: int = 500,
) -> tuple[list[FindingRead], int]:
    stmt = select(FindingModel).where(FindingModel.scan_id == scan_id)
    if severity:
        stmt = stmt.where(FindingModel.severity == severity)
    if category:
        stmt = stmt.where(FindingModel.category == category)
    total = len(db.scalars(stmt).all())
    rows = db.scalars(
        stmt.order_by(FindingModel.severity_rank.desc(), FindingModel.id).limit(limit)
    ).all()
    return [FindingRead.from_model(row) for row in rows], total


def get_assessment(db: Session, scan_id: int) -> RiskAssessmentRead | None:
    assessment = db.scalars(select(RiskAssessment).where(RiskAssessment.scan_id == scan_id)).first()
    if assessment is None:
        return None
    return RiskAssessmentRead.from_model(assessment)
