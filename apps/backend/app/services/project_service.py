"""Project creation, listing and deletion.

Validation of local paths and repository URLs happens here (in addition
to the robust checks inside the engine's source resolver) so bad input is
rejected with a clear API error before any scan is scheduled.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import SourceKind
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectRead


def create_project(db: Session, payload: ProjectCreate) -> Project:
    if payload.source_type is SourceKind.LOCAL:
        _validate_local_path(payload.local_path)
    else:
        _validate_repo_url(payload.repo_url)

    project = Project(
        name=payload.name.strip(),
        description=payload.description,
        source_type=payload.source_type.value,
        local_path=payload.local_path.strip() if payload.local_path else None,
        repo_url=payload.repo_url.strip() if payload.repo_url else None,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _validate_local_path(path: str) -> None:
    resolved = Path(path).expanduser().resolve()
    if not resolved.exists():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"local path does not exist: {path}",
        )
    if not resolved.is_dir():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"local path is not a directory: {path}",
        )


def _validate_repo_url(url: str) -> None:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"repo_url must be an http(s) URL, got: {url}",
        )


def list_projects(db: Session) -> list[ProjectRead]:
    projects = db.scalars(select(Project).order_by(Project.created_at.desc())).all()
    return [
        ProjectRead.from_model(
            project,
            scan_count=len(project.scans),
            last_scan=project.scans[0] if project.scans else None,
        )
        for project in projects
    ]


def get_project(db: Session, project_id: int) -> Project | None:
    return db.scalars(
        select(Project).where(Project.id == project_id).options(selectinload(Project.scans))
    ).first()


def delete_project(db: Session, project_id: int) -> bool:
    project = db.get(Project, project_id)
    if project is None:
        return False
    # The workspace clone (github sources) is removed with the project.
    db.delete(project)
    db.commit()
    return True
