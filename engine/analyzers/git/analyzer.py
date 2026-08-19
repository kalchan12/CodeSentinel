"""Git analyzer: repository hygiene and exposure checks.

Runs only against git repositories (raises AnalyzerNotAvailableError
otherwise). Checks: dirty working tree, tracked credential files,
missing .gitignore and large tracked files. Findings use the
``repository`` category (except tracked secrets, which are ``secrets``).
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S = 30
LARGE_FILE_BYTES = 5 * 1024 * 1024

#: file names/patterns that should never be tracked
_SENSITIVE_NAMES = re.compile(
    r"(^|/)(\.env(\..*)?|\.pem|\.key|\.p12|\.pfx|id_rsa|id_ed25519|credentials|secret|secrets)(\.|$)",
    re.IGNORECASE,
)

_REMEDIATION_SENSITIVE = (
    "Remove the file from the repository and from git history, rotate any "
    "credentials it contained, and add it to .gitignore."
)


class GitAnalyzer(Analyzer):
    name = "git"
    description = "Git / repository metadata analysis (hygiene and exposure)"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}
        self.binary = self.env.get("CODESENTINEL_GIT_PATH", "git")
        self.timeout_s = int(self.env.get("CODESENTINEL_GIT_TIMEOUT", DEFAULT_TIMEOUT_S))

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        binary = shutil.which(self.binary)
        if binary is None:
            raise AnalyzerNotAvailableError(f"git binary {self.binary!r} not found on PATH")
        if not (context.project_path / ".git").exists():
            raise AnalyzerNotAvailableError(
                f"{context.project_path} is not a git repository; the git analyzer "
                "only applies to git checkouts"
            )

        findings: list[Finding] = []
        tracked = self._git(binary, context.project_path, "ls-files")
        if tracked is None:
            return findings

        tracked_names = [line for line in tracked.splitlines() if line]
        if not tracked_names:
            return findings

        sensitive = [name for name in tracked_names if _SENSITIVE_NAMES.search(name)]
        if sensitive:
            findings.append(
                Finding(
                    analyzer="git",
                    category=FindingCategory.SECRETS,
                    title=f"{len(sensitive)} credential-like file(s) tracked in git",
                    description=(
                        "These files are committed to the repository: "
                        + ", ".join(sensitive[:10])
                        + ("..." if len(sensitive) > 10 else "")
                        + "."
                    ),
                    severity=Severity.HIGH,
                    confidence=Confidence.HIGH,
                    file=sensitive[0],
                    rule_id="tracked-sensitive-files",
                    evidence={"files": sensitive},
                    remediation=_REMEDIATION_SENSITIVE,
                    metadata={"rule": "tracked-sensitive-files"},
                )
            )

        if ".gitignore" not in tracked_names:
            findings.append(
                Finding(
                    analyzer="git",
                    category=FindingCategory.REPOSITORY,
                    title="Repository has no .gitignore",
                    description=(
                        "No tracked .gitignore means build artifacts, local "
                        "databases and credentials can be committed by accident."
                    ),
                    severity=Severity.LOW,
                    confidence=Confidence.HIGH,
                    file="",
                    rule_id="missing-gitignore",
                    remediation="Add a .gitignore covering build outputs and local data.",
                    metadata={"rule": "missing-gitignore"},
                )
            )

        large = _large_tracked_files(context.project_path, tracked_names, LARGE_FILE_BYTES)
        if large:
            findings.append(
                Finding(
                    analyzer="git",
                    category=FindingCategory.REPOSITORY,
                    title=(
                        f"{len(large)} tracked file(s) larger than "
                        f"{LARGE_FILE_BYTES // (1024 * 1024)} MB"
                    ),
                    description=(
                        "Large files bloat the repository and slow clones: "
                        + ", ".join(large[:10])
                        + "."
                    ),
                    severity=Severity.LOW,
                    confidence=Confidence.MEDIUM,
                    file=large[0],
                    rule_id="large-tracked-files",
                    evidence={"files": large},
                    remediation="Move large assets out of git (Git LFS or external storage).",
                    metadata={"rule": "large-tracked-files"},
                )
            )

        status = self._git(binary, context.project_path, "status", "--porcelain")
        if status:
            count = len([line for line in status.splitlines() if line.strip()])
            findings.append(
                Finding(
                    analyzer="git",
                    category=FindingCategory.REPOSITORY,
                    title=f"{count} uncommitted change(s) in the working tree",
                    description=(
                        "A scan usually reflects committed code; uncommitted "
                        "changes may hide issues or contain secrets not yet "
                        "tracked."
                    ),
                    severity=Severity.INFO,
                    confidence=Confidence.HIGH,
                    file="",
                    rule_id="dirty-working-tree",
                    evidence={"changed_entries": count},
                    remediation="Commit or review the pending changes before release.",
                    metadata={"rule": "dirty-working-tree"},
                )
            )

        return findings

    def _git(self, binary: str, cwd: Path, *args: str) -> str | None:
        try:
            proc = subprocess.run(
                [binary, "-C", str(cwd), *args],
                capture_output=True,
                text=True,
                timeout=self.timeout_s,
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            logger.warning("git %s failed: %s", args[0], exc)
            return None
        if proc.returncode != 0:
            logger.warning("git %s exited %d: %s", args[0], proc.returncode, proc.stderr.strip())
            return None
        return proc.stdout


def _large_tracked_files(root: Path, tracked: list[str], threshold: int) -> list[str]:
    large: list[str] = []
    for name in tracked:
        path = root / name
        try:
            if path.is_file() and path.stat().st_size > threshold:
                large.append(name)
        except OSError:
            continue
    return large


AnalyzerRegistry.register(GitAnalyzer)
