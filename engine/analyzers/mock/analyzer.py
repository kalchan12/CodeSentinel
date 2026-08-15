"""Deterministic demo analyzer used by the vertical slice.

Scans a project tree (up to a bound) for simple, real-world-style
patterns: hardcoded credentials, risky dynamic code execution, debug
configuration, TODO/FIXME markers, and missing .gitignore. Always returns
a stable result set so scans are repeatable.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

#: Directories never scanned (dependencies, build artifacts, VCS).
SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "vendor",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    "target",
    ".next",
    ".idea",
    ".vscode",
}
MAX_FILES = 300
MAX_FILE_SIZE = 512 * 1024
SNIPPET_LINES = 3

SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".go",
    ".rb",
    ".java",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".php",
    ".rs",
    ".kt",
    ".swift",
    ".sh",
    ".yml",
    ".yaml",
    ".json",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".env",
    ".properties",
    ".xml",
}

#: (pattern, category, severity, rule_id, matches_whole_line)
_RULES: list[tuple[re.Pattern[str], FindingCategory, Severity, str, bool]] = [
    (
        re.compile(r"(?i)(password|passwd|api[_-]?key|secret|token)\s*[:=]\s*['\"][^'\"]{6,}"),
        FindingCategory.SECRETS,
        Severity.HIGH,
        "mock-secret-in-code",
        True,
    ),
    (
        re.compile(r"\b(eval|exec)\s*\("),
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "mock-dynamic-code-exec",
        False,
    ),
    (
        re.compile(r"(?i)(debug|testing|test_mode)\s*[:=]\s*(true|1)\b"),
        FindingCategory.CONFIGURATION,
        Severity.LOW,
        "mock-debug-enabled",
        False,
    ),
]

_REMEDIATION = {
    "mock-secret-in-code": (
        "Remove the credential, rotate it, and store it in an environment "
        "variable or a secrets manager (e.g. 1Password, Vault)."
    ),
    "mock-dynamic-code-exec": (
        "Avoid eval()/exec() with untrusted input; use a safe parser or data-driven design instead."
    ),
    "mock-debug-enabled": (
        "Disable debug/test mode before deployment; debug endpoints can leak internals."
    ),
}


class MockAnalyzer(Analyzer):
    """Finds basic low-hanging fruit. Deterministic, zero dependencies."""

    name = "mock"
    description = "Deterministic demo analyzer (hardcoded secrets, eval/exec, debug config)"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []
        files = _iter_source_files(context.project_path)
        total = len(files)
        for index, path in enumerate(files):
            lines = _read_lines(path)
            relative = str(path.relative_to(context.project_path))
            for line_no, _line in enumerate(lines, start=1):
                findings.extend(_match_line(path=relative, lines=lines, line_no=line_no))
            if context.progress_callback is not None:
                context.report_progress(index + 1, max(total, 1))

        if not findings:
            findings.append(_info_finding("repository appears clean (per mock rules)"))
        return findings


def _iter_source_files(root: Path) -> list[Path]:
    result: list[Path] = []
    if not root.is_dir():
        return result
    for path in sorted(root.rglob("*")):
        if path.is_file() and _should_scan_file(path):
            result.append(path)
            if len(result) >= MAX_FILES:
                break
    return sorted(result)


def _should_scan_file(path: Path) -> bool:
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    return path.suffix.lower() in SOURCE_EXTENSIONS or path.name == ".gitignore"


def _read_lines(path: Path) -> list[str]:
    try:
        if path.stat().st_size > MAX_FILE_SIZE:
            return []
        return path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []


def _match_line(path: str, lines: list[str], line_no: int) -> list[Finding]:
    line = lines[line_no - 1]
    for pattern, category, severity, rule_id, whole_line in _RULES:
        matches = list(pattern.finditer(line))
        if not matches:
            continue
        if whole_line and not any(pattern.fullmatch(m.group().strip()) for m in matches):
            continue
        matched_text = matches[0].group().strip()
        finding = Finding(
            analyzer="mock",
            category=category,
            severity=severity,
            confidence=Confidence.MEDIUM,
            file=path,
            line_start=line_no,
            line_end=line_no,
            code_snippet="\n".join(
                lines[max(0, line_no - SNIPPET_LINES) : line_no + SNIPPET_LINES]
            ),
            title=rule_id.replace("mock-", "").replace("-", " ").title(),
            description=(
                f"Mock analyzer detected a {category.value} issue at {path}:{line_no} "
                f"(match: {matched_text[:80]!r}). This is a demo finding "
                f"reproduced by the mock analyzer."
            ),
            rule_id=rule_id,
            evidence={"matched_text": matched_text, "pattern": pattern.pattern},
            remediation=_REMEDIATION.get(rule_id),
            metadata={"rule": rule_id},
        )
        return [finding]
    return []


def _info_finding(message: str) -> Finding:
    return Finding(
        analyzer="mock",
        category=FindingCategory.REPOSITORY,
        severity=Severity.INFO,
        confidence=Confidence.HIGH,
        file="",
        title="No issues detected (mock)",
        description=message,
        rule_id="mock-clean",
        metadata={"rule": "mock-clean"},
    )


AnalyzerRegistry.register(MockAnalyzer)
