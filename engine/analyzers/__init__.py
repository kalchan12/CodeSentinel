"""Analysis providers. Each subpackage wraps one tool or source of
analysis; every provider implements ``engine.core.analyzer.Analyzer``.

Importing this package registers every analyzer (implemented and planned)
in the ``AnalyzerRegistry``.
"""

from engine.ai.analyzer import AIAnalyzer  # noqa: F401
from engine.analyzers.configuration.analyzer import ConfigurationAnalyzer  # noqa: F401
from engine.analyzers.dependencies.analyzer import DependencyAnalyzer  # noqa: F401
from engine.analyzers.git.analyzer import GitAnalyzer  # noqa: F401
from engine.analyzers.gitleaks.analyzer import GitleaksAnalyzer  # noqa: F401
from engine.analyzers.mock.analyzer import MockAnalyzer  # noqa: F401
from engine.analyzers.semgrep.analyzer import SemgrepAnalyzer  # noqa: F401
from engine.analyzers.tree_sitter.analyzer import TreeSitterAnalyzer  # noqa: F401
