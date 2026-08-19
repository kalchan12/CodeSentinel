"""Configuration analyzer: security settings in config files."""

from __future__ import annotations

from pathlib import Path

from engine.analyzers.configuration.analyzer import ConfigurationAnalyzer
from engine.core.context import AnalysisContext
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


def test_flags_debug_mode_in_yaml(tmp_path: Path) -> None:
    (tmp_path / "config.yml").write_text("debug: true\n")
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    rule = next(f for f in findings if f.rule_id == "debug-mode-enabled")
    assert rule.category is FindingCategory.CONFIGURATION
    assert rule.severity is Severity.LOW
    assert rule.file == "config.yml"
    assert rule.line_start == 1


def test_flags_open_cors(tmp_path: Path) -> None:
    (tmp_path / "app.json").write_text('{"cors_origins": "*"}\n')
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    rule = next(f for f in findings if f.rule_id == "open-cors")
    assert rule.severity is Severity.MEDIUM
    assert rule.rule_id == "open-cors"


def test_flags_weak_secret_key(tmp_path: Path) -> None:
    (tmp_path / "app.conf").write_text('secret_key = "short"\n')
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    rule = next(f for f in findings if f.rule_id == "weak-secret-key")
    assert rule.severity is Severity.MEDIUM


def test_flags_empty_secret_key(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text('SECRET_KEY = ""\n')
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    rule = next(f for f in findings if f.rule_id == "empty-secret-key")
    assert rule.severity is Severity.HIGH


def test_python_settings_checks(tmp_path: Path) -> None:
    (tmp_path / "settings.py").write_text(
        "DEBUG = True\nALLOWED_HOSTS = ['*']\nSECRET_KEY = 'weak'\n"
    )
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    rules = {f.rule_id for f in findings}
    assert "debug-mode-enabled" in rules
    assert "open-allowed-hosts" in rules
    assert "weak-secret-key" in rules


def test_flask_debug_server(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("app.run(host='0.0.0.0', debug=True)\n")
    findings = ConfigurationAnalyzer().analyze(_context(tmp_path))
    assert any(f.rule_id == "debug-server" for f in findings)


def test_clean_config_no_findings(tmp_path: Path) -> None:
    (tmp_path / "config.yml").write_text("debug: false\nport: 8080\n")
    (tmp_path / "settings.py").write_text("DEBUG = False\n")
    assert ConfigurationAnalyzer().analyze(_context(tmp_path)) == []


def test_skips_lockfiles(tmp_path: Path) -> None:
    (tmp_path / "package-lock.json").write_text('{"debug": true}\n')
    assert ConfigurationAnalyzer().analyze(_context(tmp_path)) == []
