"""Tree-sitter analyzer: AST-level security checks.

Parses source files with tree-sitter grammars (via the
``tree-sitter-language-pack`` package) and runs structural rules that a
regex-based analyzer cannot express reliably: attribute-qualified calls,
argument flags such as ``shell=True`` and missing ``Loader=`` in
``yaml.load``.

Rules are defined as data in ``_RULES``; adding a check is adding one
tuple. Files are bounded (count and size) so scans stay fast.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from pathlib import Path

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.errors import AnalyzerNotAvailableError
from engine.core.registry import AnalyzerRegistry
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

logger = logging.getLogger(__name__)

MAX_FILES = 200
MAX_FILE_SIZE = 512 * 1024
SNIPPET_LINES = 3

try:
    from tree_sitter_language_pack import get_parser
except ImportError:  # pragma: no cover - exercised when extras are not installed
    get_parser = None  # type: ignore[assignment]

#: extension -> tree-sitter language name
_LANGUAGE_BY_EXT = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
}

#: node types that represent a function call per language
_CALL_NODE = {
    "python": "call",
    "javascript": "call_expression",
    "typescript": "call_expression",
    "tsx": "call_expression",
}

_SHELL_FLAG = re.compile(r"shell\s*=\s*(?:True|1)", re.IGNORECASE)
_LOADER_ARG = re.compile(r"Loader\s*=\s*(\w+)")
_UNSAFE_LOADERS = {"Loader", "UnsafeLoader", "FullLoader"}


def _rule(  # noqa: PLR0913
    language: str,
    function_suffix: str,
    category: FindingCategory,
    severity: Severity,
    rule_id: str,
    title: str,
    remediation: str,
    check_args: str | None = None,
) -> dict[str, object]:
    return {
        "language": language,
        "function_suffix": function_suffix,
        "category": category,
        "severity": severity,
        "rule_id": rule_id,
        "title": title,
        "remediation": remediation,
        "check_args": check_args,
    }


_RULES: list[dict[str, object]] = [
    _rule(
        "python",
        "pickle.loads",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-unsafe-deserialization",
        "Unsafe deserialization (pickle)",
        "Prefer JSON or validate the payload origin; pickle can execute arbitrary code.",
    ),
    _rule(
        "python",
        "pickle.load",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-unsafe-deserialization",
        "Unsafe deserialization (pickle)",
        "Prefer JSON or validate the payload origin; pickle can execute arbitrary code.",
    ),
    _rule(
        "python",
        "joblib.load",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-unsafe-deserialization",
        "Unsafe deserialization (joblib)",
        "joblib.load can execute arbitrary code; prefer JSON for untrusted input.",
    ),
    _rule(
        "python",
        "shelve.open",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-unsafe-deserialization",
        "Unsafe deserialization (shelve)",
        "shelve uses pickle internally; avoid it for untrusted data.",
    ),
    _rule(
        "python",
        "os.system",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-shell-injection",
        "Shell command execution (os.system)",
        "Pass arguments as a list via subprocess instead of a shell string.",
    ),
    _rule(
        "python",
        "os.popen",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-shell-injection",
        "Shell command execution (os.popen)",
        "Pass arguments as a list via subprocess instead of a shell string.",
    ),
    _rule(
        "python",
        "subprocess.run",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-subprocess-shell",
        "subprocess with shell=True",
        "Pass an argument list and drop shell=True to avoid shell injection.",
        check_args="shell",
    ),
    _rule(
        "python",
        "subprocess.call",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-subprocess-shell",
        "subprocess with shell=True",
        "Pass an argument list and drop shell=True to avoid shell injection.",
        check_args="shell",
    ),
    _rule(
        "python",
        "subprocess.Popen",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-subprocess-shell",
        "subprocess with shell=True",
        "Pass an argument list and drop shell=True to avoid shell injection.",
        check_args="shell",
    ),
    _rule(
        "python",
        "subprocess.check_output",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-subprocess-shell",
        "subprocess with shell=True",
        "Pass an argument list and drop shell=True to avoid shell injection.",
        check_args="shell",
    ),
    _rule(
        "python",
        "subprocess.check_call",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-subprocess-shell",
        "subprocess with shell=True",
        "Pass an argument list and drop shell=True to avoid shell injection.",
        check_args="shell",
    ),
    _rule(
        "python",
        "yaml.load",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "py-unsafe-yaml-load",
        "Unsafe yaml.load",
        "Use yaml.safe_load; yaml.load with Loader=yaml.Loader can execute arbitrary code.",
        check_args="yaml_loader",
    ),
    _rule(
        "python",
        "hashlib.md5",
        FindingCategory.VULNERABILITY,
        Severity.LOW,
        "py-weak-hash",
        "Weak hashing algorithm (MD5)",
        "Use hashlib.sha256 or sha3_256; MD5 is cryptographically broken.",
    ),
    _rule(
        "python",
        "hashlib.sha1",
        FindingCategory.VULNERABILITY,
        Severity.LOW,
        "py-weak-hash",
        "Weak hashing algorithm (SHA-1)",
        "Use hashlib.sha256 or sha3_256; SHA-1 is cryptographically broken.",
    ),
    _rule(
        "javascript",
        "eval",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "js-eval",
        "Dynamic code execution (eval)",
        "Avoid eval; use a safe parser or explicit dispatch for untrusted input.",
    ),
    _rule(
        "javascript",
        "Function",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "js-function-ctor",
        "Dynamic code execution (Function constructor)",
        "Avoid new Function; use a safe parser or explicit dispatch.",
    ),
    _rule(
        "javascript",
        "child_process.exec",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "js-shell-exec",
        "Child process with shell string",
        "Use spawn(command, args) with an argument array instead of a shell string.",
    ),
    _rule(
        "javascript",
        "child_process.execSync",
        FindingCategory.VULNERABILITY,
        Severity.MEDIUM,
        "js-shell-exec",
        "Child process with shell string",
        "Use spawn(command, args) with an argument array instead of a shell string.",
    ),
]


class TreeSitterAnalyzer(Analyzer):
    name = "tree_sitter"
    description = "Tree-sitter AST-based source analysis (structural security checks)"
    implemented = True

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self.env = env or {}

    def analyze(self, context: AnalysisContext) -> list[Finding]:
        if get_parser is None:
            raise AnalyzerNotAvailableError(
                "tree_sitter analyzer requires the tree-sitter-language-pack package; "
                'install extras with `pip install -e ".[analyzers]"`'
            )
        findings: list[Finding] = []
        for path in _iter_files(context.project_path):
            findings.extend(_analyze_file(path, context.project_path))
        return findings


def _iter_files(root: Path) -> list[Path]:
    result: list[Path] = []
    if not root.is_dir():
        return result
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(
            part
            in {
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
            for part in path.parts
        ):
            continue
        if path.suffix.lower() not in _LANGUAGE_BY_EXT:
            continue
        try:
            if path.stat().st_size > MAX_FILE_SIZE:
                continue
        except OSError:
            continue
        result.append(path)
        if len(result) >= MAX_FILES:
            break
    return result


def _analyze_file(path: Path, root: Path) -> list[Finding]:
    language = _LANGUAGE_BY_EXT.get(path.suffix.lower())
    if language is None:
        return []
    try:
        parser = get_parser(language)  # type: ignore[misc]
    except Exception as exc:  # noqa: BLE001 - unknown language/grammar issues
        logger.debug("tree-sitter could not parse %s: %s", path, exc)
        return []
    try:
        source = path.read_bytes()
    except OSError:
        return []
    tree = parser.parse(source)
    if tree is None or tree.root_node is None:
        return []

    lines = source.decode("utf-8", errors="replace").splitlines()
    relative = str(path.relative_to(root))
    findings: list[Finding] = []
    for rule in _RULES:
        if rule["language"] != language:
            continue
        for node in _walk_calls(tree.root_node, _CALL_NODE[language]):
            function_node = node.child_by_field_name("function")
            if function_node is None:
                continue
            function_text = _node_text(function_node, source)
            if not function_text.endswith(str(rule["function_suffix"])):
                continue
            arguments = node.child_by_field_name("arguments")
            arguments_text = _node_text(arguments, source) if arguments else ""
            if not _args_match(rule, arguments_text):
                continue
            findings.append(_finding(rule, path=relative, lines=lines, node=node, source=source))
    return findings


def _walk_calls(root: object, call_type: str) -> list[object]:
    cursor = root.walk()  # type: ignore[attr-defined]
    calls: list[object] = []
    visited = set()
    while True:
        node = cursor.node
        if id(node) not in visited:
            visited.add(id(node))
            if node.type == call_type:
                calls.append(node)
        if cursor.goto_first_child():
            continue
        if cursor.goto_next_sibling():
            continue
        while not cursor.goto_parent():
            if not cursor.goto_next_sibling():
                return calls


def _node_text(node: object, source: bytes) -> str:
    start_byte, end_byte = node.start_byte, node.end_byte  # type: ignore[attr-defined]
    return source[start_byte:end_byte].decode("utf-8", errors="replace")


def _args_match(rule: dict[str, object], arguments_text: str) -> bool:
    check = rule.get("check_args")
    if check == "shell":
        return bool(_SHELL_FLAG.search(arguments_text))
    if check == "yaml_loader":
        match = _LOADER_ARG.search(arguments_text)
        if match is None:
            return True
        return match.group(1) in _UNSAFE_LOADERS
    return True


def _finding(  # noqa: PLR0913
    rule: dict[str, object],
    path: str,
    lines: list[str],
    node: object,
    source: bytes,
) -> Finding:
    line_start = node.start_point[0] + 1  # type: ignore[attr-defined]
    line_end = node.end_point[0] + 1  # type: ignore[attr-defined]
    snippet = "\n".join(
        lines[max(0, line_start - 1 - SNIPPET_LINES) : line_start - 1 + SNIPPET_LINES]
    )
    return Finding(
        analyzer="tree_sitter",
        category=rule["category"],  # type: ignore[arg-type]
        title=str(rule["title"]),
        description=(
            f"AST rule {rule['rule_id']} matched {rule['function_suffix']} at {path}:{line_start}."
        ),
        severity=rule["severity"],  # type: ignore[arg-type]
        confidence=Confidence.HIGH,
        file=path,
        line_start=line_start,
        line_end=line_end,
        code_snippet=snippet or None,
        rule_id=str(rule["rule_id"]),
        evidence={"language": rule["language"], "matched_function": rule["function_suffix"]},
        remediation=str(rule["remediation"]),
        metadata={"rule": str(rule["rule_id"])},
    )


AnalyzerRegistry.register(TreeSitterAnalyzer)
