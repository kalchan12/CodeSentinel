"""AI Analysis routes: status checks, async AI scans, and differential comparison."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.enums import ScanStatus
from app.models.finding import Finding as FindingModel
from app.models.scan import Scan as ScanModel
from app.schemas.scan import ScanRead
from app.services import ai_service, differential_service, project_service, scan_service

router = APIRouter(tags=["ai"])


class AIScanRequest(BaseModel):
    provider: str = "opencode"  # "opencode" or "agy"
    prompt: Optional[str] = None


@router.get("/ai/status")
def get_ai_status() -> dict[str, Any]:
    """Return the installed status and version information for local AI CLIs."""
    return ai_service.get_ai_status()


@router.post(
    "/projects/{project_id}/ai-scan",
    response_model=ScanRead,
    status_code=status.HTTP_201_CREATED,
)
def trigger_ai_scan(
    project_id: int,
    payload: AIScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ScanRead:
    """Create a new AI Scan job and enqueue local model assessment in the background."""
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.provider not in ["opencode", "agy"]:
        raise HTTPException(status_code=400, detail="Provider must be 'opencode' or 'agy'")

    # Create scan row in database
    scan = scan_service.create_scan(db, project_id)
    scan.correlation = {
        "scan_type": "ai",
        "provider": payload.provider,
        "status_phase": "Queued for execution",
        "live_logs": ["[Queued] AI scan job created. Waiting for worker..."],
    }
    db.commit()
    db.refresh(scan)

    # Launch background task
    background_tasks.add_task(
        ai_service.run_ai_scan_background,
        scan_id=scan.id,
        provider=payload.provider,
        custom_prompt=payload.prompt,
    )

    return ScanRead.from_model(scan)


@router.get("/scans/{scan_id}/comparison")
def get_scan_comparison(scan_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Retrieve pre-computed or on-demand differential comparison for a scan."""
    scan = db.get(ScanModel, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    correlation = scan.correlation or {}
    # If pre-computed comparison exists, return it
    if "comparison" in correlation and correlation["comparison"]:
        return correlation["comparison"]

    # Otherwise compute on-the-fly against the project's latest static scan
    static_scan = (
        db.query(ScanModel)
        .filter(
            ScanModel.project_id == scan.project_id,
            ScanModel.id != scan.id,
            ScanModel.status == ScanStatus.COMPLETED.value,
        )
        .order_by(ScanModel.id.desc())
        .first()
    )

    static_findings = []
    if static_scan:
        static_findings = db.query(FindingModel).filter(FindingModel.scan_id == static_scan.id).all()

    ai_findings = db.query(FindingModel).filter(FindingModel.scan_id == scan.id).all()

    return differential_service.compute_scan_differential(
        static_findings=static_findings,
        ai_findings=ai_findings,
        static_scan_id=static_scan.id if static_scan else None,
        ai_scan_id=scan.id,
    )


@router.get("/projects/{project_id}/scan-comparison")
def compare_two_scans(
    project_id: int,
    static_scan_id: int = Query(...),
    ai_scan_id: int = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Compare any two specific scans for a given project."""
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    static_findings = db.query(FindingModel).filter(FindingModel.scan_id == static_scan_id).all()
    ai_findings = db.query(FindingModel).filter(FindingModel.scan_id == ai_scan_id).all()

    return differential_service.compute_scan_differential(
        static_findings=static_findings,
        ai_findings=ai_findings,
        static_scan_id=static_scan_id,
        ai_scan_id=ai_scan_id,
    )
