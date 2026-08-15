"""Scan endpoints: creation (enqueues analysis) and result queries."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.finding import FindingsPage
from app.schemas.risk import RiskAssessmentRead
from app.schemas.scan import ScanCreate, ScanRead
from app.services import project_service, scan_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["scans"])


@router.post(
    "/projects/{project_id}/scans",
    response_model=ScanRead,
    status_code=status.HTTP_201_CREATED,
)
def create_scan(
    project_id: int,
    payload: ScanCreate,
    db: Session = Depends(get_db),
) -> ScanRead:
    if project_service.get_project(db, project_id) is None:
        raise HTTPException(status_code=404, detail="project not found")

    scan = scan_service.create_scan(db, project_id)

    from app.tasks import run_scan

    try:
        run_scan.delay(scan.id)
    except Exception as exc:  # noqa: BLE001 - broker unreachable (worker down)
        logger.exception("failed to enqueue scan %d", scan.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"analysis worker is unavailable: {exc}",
        ) from exc

    read = scan_service.get_scan_read(db, scan.id)
    return read or ScanRead.from_model(scan)


@router.get("/scans/{scan_id}", response_model=ScanRead)
def get_scan(scan_id: int, db: Session = Depends(get_db)) -> ScanRead:
    read = scan_service.get_scan_read(db, scan_id)
    if read is None:
        raise HTTPException(status_code=404, detail="scan not found")
    return read


@router.get("/scans/{scan_id}/findings", response_model=FindingsPage)
def get_findings(
    scan_id: int,
    severity: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=500, le=1000),
    db: Session = Depends(get_db),
) -> FindingsPage:
    if scan_service.get_scan(db, scan_id) is None:
        raise HTTPException(status_code=404, detail="scan not found")
    items, total = scan_service.list_findings(db, scan_id, severity, category, limit)
    return FindingsPage(total=total, items=items)


@router.get("/scans/{scan_id}/assessment", response_model=RiskAssessmentRead)
def get_assessment(scan_id: int, db: Session = Depends(get_db)) -> RiskAssessmentRead:
    assessment = scan_service.get_assessment(db, scan_id)
    if assessment is None:
        raise HTTPException(
            status_code=404, detail="assessment not available yet (scan may still be running)"
        )
    return assessment
