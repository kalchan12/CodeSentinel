"""The analysis orchestrator.

Coordinates the pipeline:

    resolve source -> run analyzers -> normalize -> correlate -> assess risk

The orchestrator only knows the ``Analyzer`` interface, the resolver,
normalizer, correlator and risk engine. It does not know Semgrep,
Gitleaks, the database or the HTTP layer, so adding an analyzer never
requires touching orchestration logic.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime

from engine.core.analyzer import Analyzer
from engine.core.context import AnalysisContext
from engine.core.source import ProjectSourceResolver
from engine.correlation.correlate import FindingCorrelator
from engine.models.finding import Finding
from engine.models.result import OrchestrationResult
from engine.models.source import ProjectSource
from engine.normalization.normalize import FindingNormalizer
from engine.risk.scoring import RiskEngine

logger = logging.getLogger(__name__)

#: Fraction of scan progress consumed by analysis vs. risk/last mile.
ANALYSIS_PROGRESS_MAX = 0.9


class AnalysisOrchestrator:
    """Runs one complete analysis pipeline for a single source."""

    def __init__(
        self,
        analyzers: list[Analyzer],
        resolver: ProjectSourceResolver,
        normalizer: FindingNormalizer,
        correlator: FindingCorrelator,
        risk_engine: RiskEngine,
    ) -> None:
        self.analyzers = analyzers
        self.resolver = resolver
        self.normalizer = normalizer
        self.correlator = correlator
        self.risk_engine = risk_engine

    def run(
        self,
        source: ProjectSource,
        project_id: int,
        project_name: str,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> OrchestrationResult:
        """Analyze ``source`` and return normalized findings + assessment.

        ``progress_callback(done, total)`` is invoked as analyzers complete,
        allowing the caller to surface scan progress in the UI.
        """
        started = time.monotonic()
        resolved = self.resolver.resolve(source, project_id)
        context = AnalysisContext(
            project_id=project_id,
            project_name=project_name,
            source=source,
            project_path=resolved.path,
        )

        import os
        from pathlib import Path

        # Calculate project workload and host hardware capacity
        file_count = 0
        total_bytes = 0
        if resolved.path.is_dir():
            for root, dirs, files in os.walk(resolved.path):
                dirs[:] = [
                    d for d in dirs
                    if d not in {".git", "node_modules", ".venv", "__pycache__", "out", ".next", "dist"}
                ]
                for f in files:
                    file_count += 1
                    try:
                        total_bytes += (Path(root) / f).stat().st_size
                    except OSError:
                        pass

        cpu_cores = os.cpu_count() or 4
        # Estimate duration based on file count, tool count, and available CPU parallel execution
        estimated_duration = round(
            max(5.0, (file_count * 0.08) / max(1, cpu_cores // 2 or 1) + len(self.analyzers) * 1.0),
            1,
        )

        tool_descriptions = {
            "semgrep": "Static Application Security Testing (AST rule checks)",
            "gitleaks": "High-Entropy Credential & Secret Detection",
            "tree_sitter": "AST Insecure Pattern & Semantic Analysis",
            "dependencies": "OSV Dependency CVE Database Matching",
            "configuration": "Insecure Configurations & Permissions Review",
            "git": "Git Commit History & Author Exposure Audit",
        }

        tools_state = [
            {
                "id": a.name,
                "name": a.name.replace("_", " ").title(),
                "description": tool_descriptions.get(a.name, f"{a.name} Security Analysis"),
                "status": "queued",
                "duration": None,
                "findings_count": 0,
            }
            for a in self.analyzers
        ]

        raw_findings: list[Finding] = []

        def emit_progress(done: int, current_analyzer: str | None = None) -> None:
            if progress_callback is None:
                return
            telemetry = {
                "project_metrics": {
                    "file_count": file_count,
                    "total_bytes": total_bytes,
                    "cpu_cores": cpu_cores,
                    "estimated_duration_seconds": estimated_duration,
                },
                "current_tool": current_analyzer,
                "tools": tools_state,
                "findings_count": len(raw_findings),
                "live_findings": [
                    {
                        "title": f.title,
                        "file": f.file,
                        "line_start": f.line_start,
                        "code_snippet": f.code_snippet,
                        "severity": f.severity.value,
                        "rule_id": f.rule_id,
                        "analyzer": f.analyzer,
                    }
                    for f in raw_findings[-6:]
                ],
            }
            try:
                progress_callback(done, len(self.analyzers), telemetry)
            except TypeError:
                progress_callback(done, len(self.analyzers))

        for i, analyzer in enumerate(self.analyzers):
            analyzer_started = time.monotonic()
            tools_state[i]["status"] = "running"

            try:
                analyzer_findings = analyzer.analyze(context)
                raw_findings.extend(analyzer_findings)
                tools_state[i]["status"] = "completed"
                tools_state[i]["duration"] = round(time.monotonic() - analyzer_started, 2)
                tools_state[i]["findings_count"] = len(analyzer_findings)
                logger.info(
                    "analyzer %s reported %d findings in %.2fs",
                    analyzer.name,
                    len(analyzer_findings),
                    time.monotonic() - analyzer_started,
                )
            except Exception:
                tools_state[i]["status"] = "failed"
                logger.exception("analyzer %s failed; continuing with remaining analyzers", analyzer.name)

            next_analyzer = self.analyzers[i + 1].name if i + 1 < len(self.analyzers) else None
            if next_analyzer and i + 1 < len(tools_state):
                tools_state[i + 1]["status"] = "running"
            emit_progress(i + 1, current_analyzer=next_analyzer)

        findings = self.normalizer.normalize(raw_findings)
        correlation = self.correlator.correlate(findings)
        assessment = self.risk_engine.assess(findings)

        logger.info(
            "orchestration finished: %d findings, overall risk=%s (%.1f), %.2fs",
            len(findings),
            assessment.level.value,
            assessment.score,
            time.monotonic() - started,
        )
        return OrchestrationResult(
            findings=findings,
            assessment=assessment,
            correlation=correlation,
            completed_at=datetime.now(UTC),
        )
