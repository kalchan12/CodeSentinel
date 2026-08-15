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

        raw_findings: list[Finding] = []
        try:
            for i, analyzer in enumerate(self.analyzers):
                analyzer_started = time.monotonic()
                analyzer_findings = analyzer.analyze(context)
                raw_findings.extend(analyzer_findings)
                logger.info(
                    "analyzer %s reported %d findings in %.2fs",
                    analyzer.name,
                    len(analyzer_findings),
                    time.monotonic() - analyzer_started,
                )
                if progress_callback is not None:
                    progress_callback(i + 1, len(self.analyzers))
        except Exception:
            logger.exception("analysis pipeline failed")
            raise

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
