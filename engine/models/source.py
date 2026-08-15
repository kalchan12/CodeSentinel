"""Source descriptors: what does a project point at?"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, model_validator


class SourceType(StrEnum):
    LOCAL = "local"
    GITHUB = "github"


class ProjectSource(BaseModel):
    """Description of where the analyzed code lives.

    - ``local``: an absolute path on the user's machine.
    - ``github``: an HTTPS repository URL, cloned into the local workspace
      before analysis (code never leaves the machine by default).
    """

    model_config = ConfigDict(extra="forbid")

    type: SourceType
    local_path: str | None = None
    repo_url: str | None = None

    @model_validator(mode="after")
    def _validate_fields(self) -> ProjectSource:
        if self.type is SourceType.LOCAL and not self.local_path:
            raise ValueError("local projects require local_path")
        if self.type is SourceType.GITHUB and not self.repo_url:
            raise ValueError("github projects require repo_url")
        return self
