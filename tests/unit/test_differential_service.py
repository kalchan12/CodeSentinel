"""Unit tests for the Differential Analysis Service (comparing static scan vs AI scan)."""

from __future__ import annotations

from app.services.differential_service import (
    compute_scan_differential,
    match_findings,
    normalize_file_path,
)


class MockFinding:
    def __init__(
        self,
        id: str,
        title: str,
        category: str,
        severity: str,
        file: str,
        line_start: int | None = None,
        analyzer: str = "semgrep",
    ):
        self.id = id
        self.title = title
        self.category = category
        self.severity = severity
        self.file = file
        self.line_start = line_start
        self.analyzer = analyzer
        self.description = f"Description for {title}"
        self.remediation = f"Remediation for {title}"


def test_normalize_file_path():
    assert normalize_file_path("apps\\backend\\main.py") == "apps/backend/main.py"
    assert normalize_file_path("./src/index.ts") == "src/index.ts"
    assert normalize_file_path("/home/user/code/app.py") == "home/user/code/app.py"


def test_match_findings_proximity():
    static_f = MockFinding("1", "SQL Injection", "vulnerability", "high", "app/db.py", 42, "semgrep")
    ai_f = MockFinding("2", "Unsanitized SQL Query", "sql_injection", "high", "app/db.py", 45, "opencode")

    # Same file, within 3 lines -> should match
    assert match_findings(static_f, ai_f) is True


def test_match_findings_different_file():
    static_f = MockFinding("1", "SQL Injection", "vulnerability", "high", "app/db.py", 42, "semgrep")
    ai_f = MockFinding("2", "SQL Injection", "vulnerability", "high", "app/auth.py", 42, "opencode")

    # Different files -> should not match
    assert match_findings(static_f, ai_f) is False


def test_compute_scan_differential_partitioning():
    # 1 common finding (SQL Injection in db.py)
    # 1 static-only finding (Secret in config.py)
    # 1 AI-only finding (Logic flaw in auth.py)
    static_findings = [
        MockFinding("s1", "SQL Injection via format string", "vulnerability", "high", "app/db.py", 50, "semgrep"),
        MockFinding("s2", "Hardcoded API Key", "secret", "critical", "app/config.py", 12, "gitleaks"),
    ]
    ai_findings = [
        MockFinding("a1", "SQL Injection Vulnerability", "vulnerability", "high", "app/db.py", 53, "opencode"),
        MockFinding("a2", "Insecure Session Token Generation", "architecture", "medium", "app/auth.py", 80, "opencode"),
    ]

    diff = compute_scan_differential(static_findings, ai_findings, static_scan_id=10, ai_scan_id=20)

    assert diff["metrics"]["total_static"] == 2
    assert diff["metrics"]["total_ai"] == 2
    assert diff["metrics"]["corroborated_count"] == 1
    assert diff["metrics"]["static_only_count"] == 1
    assert diff["metrics"]["ai_only_count"] == 1

    # Check corroborated content
    assert len(diff["corroborated"]) == 1
    assert diff["corroborated"][0]["static"]["id"] == "s1"
    assert diff["corroborated"][0]["ai"]["id"] == "a1"

    # Check static-only content
    assert len(diff["static_only"]) == 1
    assert diff["static_only"][0]["id"] == "s2"

    # Check AI-only content
    assert len(diff["ai_only"]) == 1
    assert diff["ai_only"][0]["id"] == "a2"

    # Executive summary generated
    assert len(diff["executive_summary"]) > 20
