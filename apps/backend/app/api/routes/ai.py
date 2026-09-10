"""AI Analysis routes: status checks and automated CLI codebase evaluations."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import ai_service, project_service

router = APIRouter(tags=["ai"])


class AIScanRequest(BaseModel):
    provider: str = "opencode"  # "opencode" or "agy"
    prompt: Optional[str] = None


@router.get("/ai/status")
def get_ai_status() -> dict[str, Any]:
    """Return the installed status and version information for local AI CLIs."""
    return ai_service.get_ai_status()


@router.post("/projects/{project_id}/ai-scan")
async def trigger_ai_scan(
    project_id: int,
    payload: AIScanRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Execute an automated security evaluation using OpenCode or Antigravity CLI."""
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.provider not in ["opencode", "agy"]:
        raise HTTPException(status_code=400, detail="Provider must be 'opencode' or 'agy'")

    try:
        results = await ai_service.run_ai_codebase_assessment(
            db=db,
            project_id=project_id,
            provider=payload.provider,
            custom_prompt=payload.prompt,
        )
        return results
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
