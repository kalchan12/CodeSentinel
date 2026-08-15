"""Project endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.project import ProjectCreate, ProjectRead
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectRead]:
    return project_service.list_projects(db)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectRead:
    project = project_service.create_project(db, payload)
    return ProjectRead.from_model(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectRead:
    project = project_service.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return ProjectRead.from_model(
        project,
        scan_count=len(project.scans),
        last_scan=project.scans[0] if project.scans else None,
    )


@router.get("/{project_id}/scans", response_model=list)
def list_project_scans(project_id: int, db: Session = Depends(get_db)):
    from app.services import scan_service

    if project_service.get_project(db, project_id) is None:
        raise HTTPException(status_code=404, detail="project not found")
    return scan_service.list_scans(db, project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    if not project_service.delete_project(db, project_id):
        raise HTTPException(status_code=404, detail="project not found")
