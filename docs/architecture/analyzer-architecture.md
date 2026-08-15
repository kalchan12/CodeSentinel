# Analyzer Architecture

Every analysis source in CodeSentinel is a **plugin** that implements one
interface. The pipeline (orchestrator, normalization, correlation, risk)
depends only on that interface, never on concrete tools.

## 1. The Analyzer interface

`engine/core/analyzer.py`:

```python
class Analyzer(ABC):
    name: str = ""  # unique registry name, e.g. "semgrep", "mock"
    description: str = ""
    implemented: bool = True  # False for registered-but-planned analyzers

    @abstractmethod
    def analyze(self, context: AnalysisContext) -> list[Finding]: ...
```

`AnalysisContext` (`engine/core/context.py`) provides: resolved project
`path`, `project_id`/`name`, the original `ProjectSource`, a detected
languages list (future), and a progress callback for long-running analyzers.

## 2. The Finding contract

All analyzers return normalized `Finding` objects
(`engine/models/finding.py`). Fields:

| Field | Meaning |
| --- | --- |
| `id` | UUID (auto) |
| `analyzer` | producer name |
| `category` | stable enum: `secrets`, `vulnerability`, `dependency`, `configuration`, `code_quality`, `repository`, `ai_insight` |
| `title` / `description` | human-readable |
| `severity` | `info`/`low`/`medium`/`high`/`critical` |
| `confidence` | `low`/`medium`/`high` |
| `file`, `line_start`, `line_end` | location |
| `code_snippet` | small excerpt |
| `rule_id` | stable rule identifier (used for deduplication) |
| `evidence` | machine-readable proof (matched text, CVSS, ...) |
| `remediation` | actionable fix suggestion |
| `metadata` | free-form bag; may include risk overrides `exploitability`/`impact` |

The risk engine reads `severity`, `confidence`, `category` and optional
`metadata["exploitability"]`/`metadata["impact"]` overrides.

## 3. Registry and enabling analyzers

`engine/core/registry.py` keeps a name → class registry. Modules
self-register via `AnalyzerRegistry.register(Class)` on import;
`engine/analyzers/__init__.py` imports every provider so the registry is
always complete.

Which analyzers actually run is configured through the environment:

```
CODESENTINEL_ENABLED_ANALYZERS=mock            # only mock (default)
CODESENTINEL_ENABLED_ANALYZERS=mock,ai         # plus AI (no-op provider)
```

Unknown or unimplemented names raise `AnalyzerRegistryError` at worker
startup (fail loudly, never silently skip).

## 4. Adding a new analyzer (step by step)

1. Create `engine/analyzers/<name>/` with `__init__.py` and `analyzer.py`.
2. Implement `Analyzer`:

   ```python
   from typing import Mapping
   from engine.core.analyzer import Analyzer
   from engine.core.context import AnalysisContext
   from engine.core.registry import AnalyzerRegistry
   from engine.models.finding import Finding


   class MyAnalyzer(Analyzer):
       name = "myanalyzer"
       description = "..."
       implemented = True

       def __init__(self, env: Mapping[str, str] | None = None) -> None:
           self.binary = env.get("CODESENTINEL_MYANALYZER_PATH", "mytool")

       def analyze(self, context: AnalysisContext) -> list[Finding]:
           # run tool over context.project_path, map output -> Finding
           return []


   AnalyzerRegistry.register(MyAnalyzer)
   ```

3. Import it in `engine/analyzers/__init__.py`.
4. Add it to `CODESENTINEL_ENABLED_ANALYZERS` to activate.
5. Write unit tests in `tests/unit/` (deterministic inputs → expected
   findings). No DB required.

Because analyzers are injected into the orchestrator
(`engine/core/registry.py:build_orchestrator`), nothing else needs to change.

## 5. Special analyzers

### 5.1 Mock analyzer (`mock`)
Deterministic demo provider (no external tools): regex-based detection of
hardcoded credentials, `eval`/`exec`, debug configuration, plus TODO-ish
markers and an "all-clear" info finding on clean repositories. It is the
reference implementation for the contract and the default enabled analyzer.

### 5.2 AI analyzer (`ai`)
`engine/ai/analyzer.py` wraps an `AIProvider` (`engine/ai/provider.py`).
Providers are interchangeable (OpenCode, Ollama/LM Studio, external APIs);
the default `NoopAIProvider` means AI is disabled by default. The analyzer
runs only when the provider says it is available, and it builds a bounded
`AIAnalysisRequest` — *targeted* code snippets around existing findings, the
correlation summary, dependency summary and a shallow project structure
listing — never the whole repository.

## 6. Pipeline stages after analysis

```
FindingNormalizer.validate_all   drops invalid findings (logs why)
FindingNormalizer.deduplicate    key = (rule|title, file, line); max severity wins
FindingCorrelator.correlate      groups by category and file (future: cross-finding)
RiskEngine.assess                per-finding risk + scan assessment + priorities
```

Everything downstream consumes normalized `Finding`s; audit trails live in
`metadata`/`evidence`, so the risk engine stays tool-agnostic.