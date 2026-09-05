"""Health endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001
        database = "unavailable"
    return {"status": "ok", "database": database}


@router.get("/analyzers")
def get_analyzers() -> list[dict]:
    import shutil
    import sys
    from pathlib import Path
    from app.config import settings
    import engine.analyzers  # noqa: F401
    from engine.core.registry import AnalyzerRegistry

    analyzers = []
    avail = AnalyzerRegistry.available()
    enabled = set(settings.analyzer_list)

    for name, info in avail.items():
        if name == "mock":
            continue
        status = "online"
        detail = str(info.get("description", ""))
        if name == "semgrep":
            semgrep_bin = shutil.which("semgrep") or (
                str(Path(sys.prefix) / "bin" / "semgrep")
                if (Path(sys.prefix) / "bin" / "semgrep").exists()
                else None
            )
            if not semgrep_bin:
                status = "offline"
        elif name == "gitleaks":
            gitleaks_bin = shutil.which("gitleaks") or (
                str(Path.home() / ".local" / "bin" / "gitleaks")
                if (Path.home() / ".local" / "bin" / "gitleaks").exists()
                else None
            )
            if not gitleaks_bin:
                status = "offline"

        analyzers.append({
            "name": name,
            "description": detail,
            "enabled": name in enabled,
            "status": status,
        })
    return analyzers
