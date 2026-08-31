"""Application configuration.

All settings are read from CODESENTINEL_* environment variables
(see docs/environment.md). Overrides can also come from a ``.env`` file
in the working directory.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CODESENTINEL_",
        env_file=".env",
        extra="ignore",
    )

    environment: str = "development"
    log_level: str = "INFO"
    api_prefix: str = "/api"

    database_url: str = f"sqlite:///{Path.home()}/.codesentinel/codesentinel.db"
    #: Local-first workspace: clones and local data live here.
    data_dir: Path = Path.home() / ".codesentinel"

    #: Comma-separated analyzer names enabled for scans.
    enabled_analyzers: str = "mock"

    #: Comma-separated CORS origins (Next.js dev server, Tauri, custom scheme).
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:1420,tauri://localhost,http://tauri.localhost"

    @property
    def workspace_root(self) -> Path:
        return self.data_dir / "workspace"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def analyzer_list(self) -> list[str]:
        return [name.strip() for name in self.enabled_analyzers.split(",") if name.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
