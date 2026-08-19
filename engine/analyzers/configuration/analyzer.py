"""Configuration analyzer: security-relevant settings in config files.

Checks common configuration files for dangerous settings: debug mode
left on, wide-open CORS origins, weak/empty secret keys, insecure host
allow-lists and debug-enabled application servers.

Two rule classes run over line-oriented key/value content:
- generic rules for .env / yaml / json / toml / ini / properties files
- python rules for settings/config modules (DEBUG = True, app.run(debug=True), ...)
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

#: file kinds scanned by this analyzer
_CONFIG_EXTS = {".env", ".yml", ".yaml", ".json", ".toml", ".ini", ".cfg", ".conf", ".properties"}
_PYTHON_CONFIG_NAME = re.compile(r"(settings|config|wsgi|asgi|app)\.py$")
_SKIP_DIRS = {
    ".git",
    "node_modules",
    "vendor",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    "target",
    ".next",
}
_SKIP_JSON_NAMES = {"package-lock.json", "package.json", "cargo.lock", "composer.lock", "yarn.lock"}
MAX_FILES = 100
MAX_FILE_SIZE = 512 * 1024
SNIPPET_LINES = 3

#: (regex, rule_id, severity, title, remediation) applied to any config line
_GENERIC_RULES: list[tuple[re.Pattern[str], str, Severity, str, str]] = [
    (
        re.compile(r"(?i)^\s*(debug|debug_mode|development)\s*[:=]\s*(true|1|yes|on)\b"),
        "debug-mode-enabled",
        Severity.LOW,
        "Debug mode enabled in configuration",
        "Disable debug/development mode before deployment; it can leak "
        "stack traces, secrets and internals.",
    ),
    (
        re.compile(
            r"(?i)(allow_?origin|allowed_?origins|cors_?origins?|origins?)\s*[\"']?\s*[:=]\s*(\[\s*)?[\"']\*[\"']"
        ),
        "open-cors",
        Severity.MEDIUM,
        "Wide-open CORS origins",
        "Restrict CORS origins to the exact domains that must call the API.",
    ),
    (
        re.compile(r"(?i)^\s*(secret_key|secret|api_secret)\s*[:=]\s*[\"']{1,2}\s*[\"']{1,2}\s*$"),
        "empty-secret-key",
        Severity.HIGH,
        "Empty secret key",
        "Set a strong, random secret key via a secrets manager or environment.",
    ),
    (
        re.compile(r"(?i)^\s*(secret_key|secret|api_secret)\s*[:=]\s*[\"'][^\"']{1,16}[\"']"),
        "weak-secret-key",
        Severity.MEDIUM,
        "Weak secret key",
        "Use a long, random secret key (32+ chars) from a secrets manager.",
    ),
]

#: python-specific rules
_PYTHON_RULES: list[tuple[re.Pattern[str], str, Severity, str, str]] = [
    (
        re.compile(r"^\s*DEBUG\s*=\s*(True|1)\b"),
        "debug-mode-enabled",
        Severity.LOW,
        "Debug mode enabled in configuration",
        "Disable DEBUG before deployment; debug endpoints can leak internals.",
    ),
    (
        re.compile(r"^\s*ALLOWED_HOSTS\s*=\s*\[?\s*[\"']\*[\"']"),
        "open-allowed-hosts",
        Severity.MEDIUM,
        "ALLOWED_HOSTS accepts any host",
        "List the exact hostnames the application is served from.",
    ),
    (
        re.compile(r"^\s*(SECRET_KEY|SECRET)\s*=\s*[\"'][^\"']{1,16}[\"']"),
        "weak-secret-key",
        Severity.MEDIUM,
        "Weak secret key",
        "Use a long, random secret key (32+ chars) from a secrets manager.",
    ),
    (
        re.compile(r"(?i)\.run\(.*debug\s*=\s*True"),
        "debug-server",
        Severity.LOW,
        "Development server with debug=True",
        "Run the app with a production server (e.g. gunicorn) and debug off.",
    ),
]


class ConfigurationAnalyzer(Analyzer):
    name = "configuration"
    description = "Security configuration analysis (debug, CORS, secrets, hosts)"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []
        for path in _iter_config_files(context.project_path):
            lines = _read_lines(path)
            relative = str(path.relative_to(context.project_path))
            rules = _rules_for(path)
            for line_no, line in enumerate(lines, start=1):
                for pattern, rule_id, severity, title, remediation in rules:
                    if not pattern.search(line):
                        continue
                    findings.append(
                        _finding(
                            rule_id=rule_id,
                            title=title,
                            severity=severity,
                            remediation=remediation,
                            path=relative,
                            lines=lines,
                            line_no=line_no,
                        )
                    )
                    break
        return findings


def _iter_config_files(root: Path) -> list[Path]:
    result: list[Path] = []
    if not root.is_dir():
        return result
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.name in _SKIP_JSON_NAMES:
            continue
        is_dotenv = path.name.lower() == ".env" or path.name.lower().startswith(".env.")
        if path.suffix.lower() in _CONFIG_EXTS or is_dotenv or _PYTHON_CONFIG_NAME.match(path.name):
            result.append(path)
            if len(result) >= MAX_FILES:
                break
    return result


def _read_lines(path: Path) -> list[str]:
    try:
        if path.stat().st_size > MAX_FILE_SIZE:
            return []
        return path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []


def _rules_for(path: Path) -> list[tuple[re.Pattern[str], str, Severity, str, str]]:
    if path.suffix.lower() == ".py":
        return _PYTHON_RULES
    return _GENERIC_RULES


def _finding(  # noqa: PLR0913
    rule_id: str,
    title: str,
    severity: Severity,
    remediation: str,
    path: str,
    lines: list[str],
    line_no: int,
) -> Finding:
    return Finding(
        analyzer="configuration",
        category=FindingCategory.CONFIGURATION,
        title=title,
        description=f"Security-relevant setting matched in {path}:{line_no}.",
        severity=severity,
        confidence=Confidence.MEDIUM,
        file=path,
        line_start=line_no,
        line_end=line_no,
        code_snippet="\n".join(lines[max(0, line_no - SNIPPET_LINES) : line_no + SNIPPET_LINES]),
        rule_id=rule_id,
        remediation=remediation,
        metadata={"rule": rule_id},
    )


AnalyzerRegistry.register(ConfigurationAnalyzer)
