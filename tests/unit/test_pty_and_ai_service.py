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
