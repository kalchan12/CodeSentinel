"""Tree-sitter analyzer: AST structural checks."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.analyzers.tree_sitter.analyzer import TreeSitterAnalyzer
from engine.core.context import AnalysisContext
from engine.models.finding import FindingCategory, Severity
from engine.models.source import ProjectSource, SourceType

try:
    from tree_sitter_language_pack import get_parser  # noqa: F401

    TS_AVAILABLE = True
except ImportError:
    TS_AVAILABLE = False


def _context(root: Path) -> AnalysisContext:
    return AnalysisContext(
        project_id=1,
        project_name="p",
        source=ProjectSource(type=SourceType.LOCAL, local_path=str(root)),
        project_path=root,
    )


@pytest.mark.skipif(not TS_AVAILABLE, reason="tree-sitter-language-pack not installed")
def test_python_unsafe_calls(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text(
        "import pickle\n"
        "import subprocess\n"
        "import os\n"
        "import yaml\n"
        "def run(data):\n"
        "    pickle.loads(data)\n"
        "    subprocess.run('ls', shell=True)\n"
        "    os.system('ls')\n"
        "    yaml.load(data)\n"
    )
    findings = TreeSitterAnalyzer().analyze(_context(tmp_path))
    rules = {f.rule_id for f in findings}
    assert "py-unsafe-deserialization" in rules
    assert "py-subprocess-shell" in rules
    assert "py-shell-injection" in rules
    assert "py-unsafe-yaml-load" in rules

    shell = next(f for f in findings if f.rule_id == "py-subprocess-shell")
    assert shell.category is FindingCategory.VULNERABILITY
    assert shell.severity is Severity.MEDIUM
    assert shell.file == "app.py"
    assert shell.line_start == 7
    assert shell.code_snippet


@pytest.mark.skipif(not TS_AVAILABLE, reason="tree-sitter-language-pack not installed")
def test_safe_yaml_load_not_flagged(tmp_path: Path) -> None:
    (tmp_path / "safe.py").write_text(
        "import yaml\ndef load(data):\n    return yaml.safe_load(data)\n"
    )
    findings = TreeSitterAnalyzer().analyze(_context(tmp_path))
    assert "py-unsafe-yaml-load" not in {f.rule_id for f in findings}


@pytest.mark.skipif(not TS_AVAILABLE, reason="tree-sitter-language-pack not installed")
def test_subprocess_without_shell_not_flagged(tmp_path: Path) -> None:
    (tmp_path / "ok.py").write_text("import subprocess\nsubprocess.run(['ls', '-la'])\n")
    assert TreeSitterAnalyzer().analyze(_context(tmp_path)) == []


@pytest.mark.skipif(not TS_AVAILABLE, reason="tree-sitter-language-pack not installed")
def test_javascript_eval_and_child_process(tmp_path: Path) -> None:
    (tmp_path / "app.js").write_text(
        "const cp = require('child_process');\n"
        "function run(input) {\n"
        "  eval(input);\n"
        "  cp.exec('ls ' + input);\n"
        "}\n"
    )
    findings = TreeSitterAnalyzer().analyze(_context(tmp_path))
    rules = {f.rule_id for f in findings}
    assert "js-eval" in rules
    assert "js-shell-exec" in rules


@pytest.mark.skipif(not TS_AVAILABLE, reason="tree-sitter-language-pack not installed")
def test_skips_vendored_directories(tmp_path: Path) -> None:
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "bad.js").write_text("eval('x')\n")
    assert TreeSitterAnalyzer().analyze(_context(tmp_path)) == []
