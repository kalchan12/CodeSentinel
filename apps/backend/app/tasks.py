"""Scan pipeline tasks executed by the Celery worker.

One task per scan: resolve the source, run the analysis orchestrator
(registered analyzers -> normalization -> correlation -> risk), then
persist everything through ``scan_service``.
"""

from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.services import scan_service
from engine.core.errors import AnalysisError
from engine.core.registry import build_orchestrator
from engine.models.source import ProjectSource, SourceType

logger = logging.getLogger(__name__)


@celery_app.task(name="scans.run_scan", bind=True, max_retries=0)
def run_scan(self, scan_id: int) -> dict:
    """Run one full analysis pipeline for ``scan_id``."""
    from app.config import settings

    with SessionLocal() as db:
        scan = scan_service.get_scan(db, scan_id)
        if scan is None:
            raise ValueError(f"scan {scan_id} not found")
        project_id = scan.project_id
        from app.models.project import Project

        project = db.get(Project, project_id)
        if project is None:
            raise ValueError(f"project for scan {scan_id} not found")

        source = ProjectSource(
            type=SourceType(project.source_type),
            local_path=project.local_path,
            repo_url=project.repo_url,
        )
        scan_service.start_scan(db, scan_id, self.request.id)

        orchestrator = build_orchestrator(
            enabled_analyzers=settings.analyzer_list,
            workspace_root=settings.workspace_root,
        )

        def progress(done: int, total: int) -> None:
            fraction = (done / total) if total else 0.0
            scan_service.update_progress(db, scan_id, fraction * 90.0)

    try:
        result = orchestrator.run(
            source=source,
            project_id=project_id,
            project_name=project.name,
            progress_callback=progress,
        )
    except (AnalysisError, OSError) as exc:
        logger.exception("scan %d failed", scan_id)
        with SessionLocal() as db:
            scan_service.fail_scan(db, scan_id, str(exc))
        raise
    except Exception as exc:  # noqa: BLE001 - ensure scan row reflects failure
        logger.exception("scan %d failed unexpectedly", scan_id)
        with SessionLocal() as db:
            scan_service.fail_scan(db, scan_id, f"unexpected error: {exc}")
        raise

    with SessionLocal() as db:
        scan_service.persist_results(db, scan_id, result)
    return {
        "scan_id": scan_id,
        "findings": len(result.findings),
        "risk_score": result.assessment.score,
    }
