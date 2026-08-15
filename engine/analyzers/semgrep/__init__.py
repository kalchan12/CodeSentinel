"""Semgrep-based analyzer (planned).

Will wrap the Semgrep CLI (``semgrep scan --json``) with a ruleset tuned
for the detected languages and normalize its JSON output into Finding
objects. Registered but not implemented yet — enabling it without an
implementation raises AnalyzerNotAvailableError.
"""
