"""Risk engine: turns normalized findings into explainable risk scores.

The engine deliberately depends only on ``engine.models.finding.Finding``
and never on individual analysis tools, so the scoring model can be
replaced without touching analyzers or the orchestration layer.
"""
