"""Dependency analyzer: manifest parsing and OSV lookup."""

from __future__ import annotations

from pathlib import Path

from engine.analyzers.dependencies.analyzer import (
    DependencyAnalyzer,
    _collect_dependencies,
    _parse_manifest,
)
from engine.core.context import AnalysisContext
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType

#: pre-built OSV querybatch response: requests 2.19.1 has known CVEs.
_OSV_RESPONSE = {
    "results": [
        {
            "vulns": [
                {
                    "id": "GHSA-xxxx-yyyy-zzzz",
                    "summary": "Request is vulnerable to open redirect",
                    "aliases": ["CVE-2018-18074"],
                    "severity": [{"type": "CVSS_V3", "score": "7.5"}],
                    "affected": [
                        {"ranges": [{"events": [{"introduced": "0"}, {"fixed": "2.19.2"}]}]}
                    ],
                }
            ]
        }
    ]
}


class _FakeClient:
    def __init__(self, payload: object) -> None:
        self.payload = payload
        self.calls: list[dict[str, object]] = []

    def post(self, url: str, json: dict[str, object], timeout: float) -> _FakeResponse:
        self.calls.append(json)
        return _FakeResponse(self.payload)


class _FakeResponse:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def json(self) -> object:
        return self.payload


class _BrokenClient:
    def post(self, url: str, json: dict[str, object], timeout: float) -> None:
        raise ConnectionError("no network")


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


def test_parses_requirements_txt(tmp_path: Path) -> None:
    manifest = tmp_path / "requirements.txt"
    manifest.write_text(
        "# comment\n"
        "requests==2.19.1\n"
        "Django==4.2.7 ; python_version >= '3.8'\n"
        "flask>=2.0\n"
        "-r base.txt\n"
    )
    deps = _parse_manifest("pip", manifest.read_text(), "requirements.txt")
    pinned = [(d.name, d.version) for d in deps]
    assert ("requests", "2.19.1") in pinned
    assert ("Django", "4.2.7") in pinned
    unpinned = [(d.name, d.version) for d in deps if d.version is None]
    assert ("flask", None) in unpinned


def test_parses_package_json_only_pins(tmp_path: Path) -> None:
    manifest = tmp_path / "package.json"
    manifest.write_text(
        "{\n"
        '  "dependencies": {"axios": "1.6.0", "express": "^4.18.0", "cors": "*"},\n'
        '  "devDependencies": {"typescript": "5.3.2"}\n'
        "}\n"
    )
    deps = _parse_manifest("npm", manifest.read_text(), "package.json")
    versions = {(d.name, d.version) for d in deps}
    assert ("axios", "1.6.0") in versions
    assert ("typescript", "5.3.2") in versions
    assert "express" not in {d.name for d in deps}
    assert "cors" not in {d.name for d in deps}


def test_parses_package_lock(tmp_path: Path) -> None:
    manifest = tmp_path / "package-lock.json"
    manifest.write_text('{"packages": {"": {}, "node_modules/axios": {"version": "1.6.0"}}}')
    deps = _parse_manifest("npm-lock", manifest.read_text(), "package-lock.json")
    assert [(d.name, d.version) for d in deps] == [("axios", "1.6.0")]


def test_parses_go_mod(tmp_path: Path) -> None:
    manifest = tmp_path / "go.mod"
    manifest.write_text(
        "module example.com/app\n"
        "\n"
        "go 1.22\n"
        "\n"
        "require (\n"
        "  github.com/gin-gonic/gin v1.9.1\n"
        "  github.com/pkg/errors v0.9.1 // indirect\n"
        ")\n"
        "\n"
        "require github.com/stretchr/testify v1.8.4\n"
    )
    deps = _parse_manifest("go", manifest.read_text(), "go.mod")
    versions = {(d.name, d.version) for d in deps}
    assert ("github.com/gin-gonic/gin", "v1.9.1") in versions
    assert ("github.com/stretchr/testify", "v1.8.4") in versions


def test_collects_manifests_and_skips_node_modules(tmp_path: Path) -> None:
    (tmp_path / "requirements.txt").write_text("requests==2.19.1\n")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "requirements.txt").write_text("whatever\n")
    deps = _collect_dependencies(tmp_path)
    assert [(d.name, d.version) for d in deps] == [("requests", "2.19.1")]


def test_vulnerable_dependency_reported(tmp_path: Path) -> None:
    (tmp_path / "requirements.txt").write_text("requests==2.19.1\n")
    analyzer = DependencyAnalyzer(client=_FakeClient(_OSV_RESPONSE))
    findings = analyzer.analyze(_context(tmp_path))

    vuln = next(f for f in findings if f.rule_id == "GHSA-xxxx-yyyy-zzzz")
    assert vuln.category is FindingCategory.DEPENDENCY
    assert vuln.severity is Severity.HIGH
    assert vuln.file == "requirements.txt"
    assert vuln.line_start == 1
    assert vuln.evidence["version"] == "2.19.1"
    assert "2.19.2" in (vuln.remediation or "")
    assert "CVE-2018-18074" in vuln.description


def test_query_payload_ecosystem_and_version(tmp_path: Path) -> None:
    (tmp_path / "requirements.txt").write_text("requests==2.19.1\n")
    client = _FakeClient({"results": [{"vulns": []}]})
    analyzer = DependencyAnalyzer(client=client)
    analyzer.analyze(_context(tmp_path))
    query = client.calls[0]["queries"][0]  # type: ignore[index]
    assert query["package"] == {"name": "requests", "ecosystem": "PyPI"}
    assert query["version"] == "2.19.1"


def test_unpinned_dependencies_reported_info(tmp_path: Path) -> None:
    (tmp_path / "requirements.txt").write_text("flask>=2.0\n")
    analyzer = DependencyAnalyzer(client=_FakeClient({"results": []}))
    findings = analyzer.analyze(_context(tmp_path))
    assert len(findings) == 1
    finding = findings[0]
    assert finding.rule_id == "unpinned-dependencies"
    assert finding.severity is Severity.INFO
    assert finding.evidence["count"] == 1


def test_network_failure_degrades_to_info_finding(tmp_path: Path) -> None:
    (tmp_path / "requirements.txt").write_text("requests==2.19.1\n")
    analyzer = DependencyAnalyzer(client=_BrokenClient())
    findings = analyzer.analyze(_context(tmp_path))
    assert findings == []
