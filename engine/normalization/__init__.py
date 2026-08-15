"""Normalization: validation and deduplication of analyzer output.

Analyzer output is already typed as ``Finding``; this module turns raw
concerns into guarantees the rest of the pipeline can rely on:

- invalid findings (missing required fields, wrong shapes) are logged and
  dropped instead of crashing a scan
- duplicates produced by overlapping analyzers are collapsed
"""
