"""Mock analyzer: deterministic demo provider for the vertical slice.

Produces realistic findings from file content patterns only — no external
tools required. Used as the default enabled analyzer until real analyzers
(Semgrep, Gitleaks, ...) land; also the reference implementation for the
Analyzer contract.
"""
