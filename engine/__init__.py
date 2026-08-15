"""CodeSentinel analysis engine.

The engine is a standalone, database-agnostic analysis pipeline:

    source -> orchestrator -> analyzers -> normalization -> correlation -> risk

It consumes ``ProjectSource`` descriptors and produces normalized
``Finding`` objects plus a ``ScanRiskAssessment``. Persistence is the
responsibility of the calling application (the FastAPI/Celery backend).
"""

__version__ = "0.1.0"
