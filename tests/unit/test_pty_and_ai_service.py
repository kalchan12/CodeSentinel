"""Unit tests for PTY and AI service utilities."""

from __future__ import annotations

import os
from app.services.ai_service import find_cli_binary, get_ai_status
from app.services.pty_service import PTYSession


def test_find_cli_binary_known() -> None:
    # 'ls' is always present in linux
    path = find_cli_binary("ls")
    assert path is not None
    assert os.path.exists(path)


def test_find_cli_binary_nonexistent() -> None:
    path = find_cli_binary("non_existent_binary_xyz_123")
    assert path is None


def test_get_ai_status_structure() -> None:
    status = get_ai_status()
    assert "opencode" in status
    assert "agy" in status
    assert "available" in status["opencode"]
    assert "description" in status["opencode"]
    assert "available" in status["agy"]
    assert "description" in status["agy"]


def test_pty_session_initialization() -> None:
    cmd = ["bash"]
    session = PTYSession(command=cmd, rows=30, cols=100)
    assert session.command == cmd
    assert session.rows == 30
    assert session.cols == 100
    assert session.master_fd is None
    assert session.pid is None
    assert session.is_running is False
    assert "PATH" in session.env
    assert session.env["TERM"] == "xterm-256color"


def test_discover_project_source_files(tmp_path) -> None:
    from app.services.ai_service import discover_project_source_files

    # Create dummy structure
    (tmp_path / "app.py").write_text("print('hello')")
    (tmp_path / "config.json").write_text("{}")
    (tmp_path / ".env").write_text("SECRET=123")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "vendor.js").write_text("// vendor")
    (tmp_path / ".venv").mkdir()
    (tmp_path / ".venv" / "lib.py").write_text("# venv")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.ts").write_text("const x = 1;")

    discovered = discover_project_source_files(str(tmp_path), max_files=20)
    assert "app.py" in discovered
    assert "config.json" in discovered
    assert ".env" in discovered
    assert any("main.ts" in p for p in discovered)
    assert not any("vendor.js" in p for p in discovered)
    assert not any("lib.py" in p for p in discovered)


def test_extract_code_snippet(tmp_path) -> None:
    from app.services.ai_service import extract_code_snippet

    file_p = tmp_path / "test.py"
    lines = [f"line_{i}\n" for i in range(1, 11)]
    file_p.write_text("".join(lines))

    # Context around line 5
    snippet = extract_code_snippet(str(tmp_path), "test.py", 5, context_lines=2)
    assert snippet is not None
    assert "line_5" in snippet
    assert "line_4" in snippet
    assert "line_6" in snippet


def test_parse_ai_findings_agy_envelope() -> None:
    from app.services.ai_service import parse_ai_findings

    raw_agy = '{"response": "```json\\n[\\n  {\\n    \\"title\\": \\"SQL Injection\\",\\n    \\"severity\\": \\"critical\\",\\n    \\"file\\": \\"app.py\\",\\n    \\"line_start\\": 42,\\n    \\"description\\": \\"Raw SQL query concatenation\\",\\n    \\"remediation\\": \\"Use parameterized queries\\"\\n  }\\n]\\n```"}'
    findings = parse_ai_findings(raw_agy, "agy")
    assert len(findings) == 1
    assert findings[0]["title"] == "SQL Injection"
    assert findings[0]["severity"] == "critical"
    assert findings[0]["file"] == "app.py"
    assert findings[0]["line_start"] == 42


def test_parse_ai_findings_markdown_fallback() -> None:
    from app.services.ai_service import parse_ai_findings

    raw_md = """
    ### Remote Code Execution in endpoint
    - Severity: High
    - File: app.py
    - Line: 15
    - Remediation: Remove unsafe pickle loads.
    Unsafe deserialization detected in user payload.
    """
    findings = parse_ai_findings(raw_md, "opencode")
    assert len(findings) == 1
    assert "Remote Code Execution" in findings[0]["title"]
    assert findings[0]["file"] == "app.py"
    assert findings[0]["line_start"] == 15
    assert findings[0]["severity"] == "high"
