"""Dependency analyzer: manifest parsing + OSV vulnerability lookup.

Parses lockfiles/manifests (requirements.txt, Pipfile, package.json,
package-lock.json, go.mod, Cargo.lock, poetry.lock) and queries the OSV
API (https://osv.dev) for known vulnerabilities of *exactly pinned*
versions. Unpinned dependencies are reported as an info-level finding.

Network failures degrade gracefully: the analyzer logs the problem and
returns a single info finding instead of failing the whole scan.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.registry import AnalyzerRegistry
from engine.normalization.dependencies import normalize_unpinned_finding, normalize_vuln_finding
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

logger = logging.getLogger(__name__)

OSV_QUERY_URL = "https://api.osv.dev/v1/querybatch"
DEFAULT_TIMEOUT_S = 60
MAX_QUERIES = 500

#: manifest filename (case-insensitive) -> parser name
_MANIFESTS = {
    "requirements.txt": "pip",
    "pipfile": "pipfile",
    "package.json": "npm",
    "package-lock.json": "npm-lock",
    "go.mod": "go",
    "cargo.lock": "cargo",
    "poetry.lock": "poetry",
}

_ECOSYSTEM = {
    "pip": "PyPI",
    "pipfile": "PyPI",
    "poetry": "PyPI",
    "npm": "npm",
    "npm-lock": "npm",
    "go": "Go",
    "cargo": "crates.io",
}

_VERSION_RE = r"[0-9][0-9A-Za-z.+-]*"
#: pinned requirement, tolerating trailing environment markers (e.g. "; python_version >= '3.8'")
_PIN_RE = re.compile(rf"^(\S+)\s*(?:===|==)\s*({_VERSION_RE})")
#: any requirement that is not exactly pinned (range, latest, bare name)
_UNPINNED_RE = re.compile(r"^([A-Za-z0-9_.-]+?)\s*(?:>=|<=|~=|==|!=|>|<|\*)")
_PIPFILE_RE = re.compile(
    rf'^\s*["\']?([A-Za-z0-9_.-]+)["\']?\s*=\s*["\'](?:==|===)?({_VERSION_RE})["\']'
)
_GO_RE = re.compile(rf"^\s*([A-Za-z0-9._/-]+)\s+(v{_VERSION_RE})$")
_CARGO_RE = re.compile(r'^\s*(name|version)\s*=\s*"([^"]+)"$')

_EXACT_VERSION_RE = re.compile(rf"^{_VERSION_RE}$")


class OSVClient(Protocol):
    """Minimal HTTP surface the analyzer depends on (injectable for tests)."""

    def post(self, url: str, json: dict[str, Any], timeout: float) -> Any: ...


class _HttpxClient:
    """Default client backed by httpx with a bounded timeout."""

    def __init__(self) -> None:
        import httpx  # deferred import: runtime dependency only when used

        self._client = httpx.Client(timeout=DEFAULT_TIMEOUT_S)

    def post(self, url: str, json: dict[str, Any], timeout: float) -> Any:
        return self._client.post(url, json=json, timeout=timeout)


class DependencyAnalyzer(Analyzer):
    name = "dependencies"
    description = "OSV-based dependency vulnerability analysis"
    implemented = True

    def __init__(
        self,
        env: Mapping[str, str] | None = None,
        client: OSVClient | None = None,
    ) -> None:
        self.env = env or {}
        self.client = client or _HttpxClient()

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        dependencies = _collect_dependencies(context.project_path)
        if not dependencies:
            return []

        pinned = [d for d in dependencies if d.version is not None]
        unpinned = [d for d in dependencies if d.version is None]

        findings: list[Finding] = []
        if unpinned:
            findings.append(normalize_unpinned_finding(list({d.file for d in unpinned}), len(unpinned)))

        for dep, vulns in self._query_osv(pinned):
            findings.extend([normalize_vuln_finding(dep.name, dep.version, dep.file, dep.line, _ECOSYSTEM[dep.kind], v) for v in vulns])
        return findings

    def _query_osv(
        self, dependencies: list[Dependency]
    ) -> list[tuple[Dependency, list[dict[str, Any]]]]:
        if not dependencies:
            return []
        queries = [
            {
                "package": {"name": d.name, "ecosystem": _ECOSYSTEM[d.kind]},
                "version": d.version,
            }
            for d in dependencies[:MAX_QUERIES]
        ]
        try:
            response = self.client.post(
                OSV_QUERY_URL, json={"queries": queries}, timeout=DEFAULT_TIMEOUT_S
            )
        except Exception as exc:  # noqa: BLE001 - offline scan must not kill the pipeline
            logger.warning("OSV lookup failed (%s); dependency findings unavailable", exc)
            return []
        try:
            payload = response.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSV response was not JSON (%s)", exc)
            return []

        results = payload.get("results", []) if isinstance(payload, Mapping) else []
        return [
            (dep, list(result.get("vulns", [])))
            for dep, result in zip(dependencies[:MAX_QUERIES], results, strict=False)
            if isinstance(result, Mapping) and result.get("vulns")
        ]


class Dependency:
    """One pinned (or unpinned) dependency found in a manifest."""

    __slots__ = ("name", "version", "kind", "file", "line")

    def __init__(
        self,
        name: str,
        version: str | None,
        kind: str,
        file: str,
        line: int | None = None,
    ) -> None:
        self.name = name
        self.version = version
        self.kind = kind
        self.file = file
        self.line = line


def _collect_dependencies(root: Path) -> list[Dependency]:
    dependencies: list[Dependency] = []
    if not root.is_dir():
        return dependencies
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(
            part in {".git", "node_modules", "vendor", ".venv", "venv", "dist", "build", "target"}
            for part in path.parts
        ):
            continue
        parser = _MANIFESTS.get(path.name.lower())
        if parser is None:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        dependencies.extend(_parse_manifest(parser, content, str(path.relative_to(root))))
    return dependencies


def _parse_manifest(kind: str, content: str, file: str) -> list[Dependency]:
    if kind == "pip":
        return _parse_pip(content, file)
    if kind == "pipfile":
        return _parse_pipfile(content, file)
    if kind == "npm":
        return _parse_package_json(content, file)
    if kind == "npm-lock":
        return _parse_package_lock(content, file)
    if kind == "go":
        return _parse_go_mod(content, file)
    if kind in ("cargo", "poetry"):
        return _parse_name_version_lock(content, file)
    return []


def _parse_pip(content: str, file: str) -> list[Dependency]:
    result: list[Dependency] = []
    for index, raw in enumerate(content.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith(("#", "-r", "-e", "--")):
            continue
        match = _PIN_RE.match(line)
        if match:
            result.append(Dependency(match.group(1), match.group(2), "pip", file, index))
            continue
        if match := _UNPINNED_RE.match(line):
            result.append(Dependency(match.group(1), None, "pip", file, index))
    return result


def _parse_pipfile(content: str, file: str) -> list[Dependency]:
    result: list[Dependency] = []
    in_packages = False
    for index, raw in enumerate(content.splitlines(), start=1):
        stripped = raw.strip()
        if stripped.startswith("["):
            in_packages = stripped.lower() in ("[packages]", "[dev-packages]")
            continue
        if not in_packages:
            continue
        match = _PIPFILE_RE.match(raw)
        if match:
            result.append(Dependency(match.group(1), match.group(2), "pipfile", file, index))
    return result


def _parse_package_json(content: str, file: str) -> list[Dependency]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return []
    result: list[Dependency] = []
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        deps = payload.get(section, {}) if isinstance(payload, Mapping) else {}
        if not isinstance(deps, Mapping):
            continue
        for name, spec in deps.items():
            if isinstance(spec, str) and _EXACT_VERSION_RE.fullmatch(spec):
                result.append(Dependency(str(name), spec, "npm", file))
    return result


def _parse_package_lock(content: str, file: str) -> list[Dependency]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return []
    packages = payload.get("packages", {}) if isinstance(payload, Mapping) else {}
    if not isinstance(packages, Mapping):
        return []
    result: list[Dependency] = []
    for key, info in packages.items():
        if not isinstance(info, Mapping):
            continue
        name = str(key).rsplit("node_modules/", 1)[-1]
        if not name or not name.strip():
            continue
        version = info.get("version")
        if isinstance(version, str):
            result.append(Dependency(name, version, "npm-lock", file))
    return result


def _parse_go_mod(content: str, file: str) -> list[Dependency]:
    result: list[Dependency] = []
    in_block = False
    for index, raw in enumerate(content.splitlines(), start=1):
        stripped = raw.strip()
        if stripped.startswith("require ("):
            in_block = True
            continue
        if in_block and stripped.startswith(")"):
            in_block = False
            continue
        if in_block or stripped.startswith("require "):
            candidate = stripped[8:].strip() if stripped.startswith("require ") else stripped
            match = _GO_RE.match(candidate)
            if match:
                result.append(Dependency(match.group(1), match.group(2), "go", file, index))
    return result


def _parse_name_version_lock(content: str, file: str) -> list[Dependency]:
    result: list[Dependency] = []
    name: str | None = None
    for index, raw in enumerate(content.splitlines(), start=1):
        match = _CARGO_RE.match(raw.strip())
        if not match:
            continue
        key, value = match.groups()
        if key == "name":
            name = value
        elif key == "version" and name is not None:
            result.append(Dependency(name, value, "cargo", file, index))
            name = None
    return result




AnalyzerRegistry.register(DependencyAnalyzer)
