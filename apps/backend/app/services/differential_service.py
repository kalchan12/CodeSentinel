"""Differential Analysis Service: compares static analyzer findings with AI-detected findings."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Sequence
from sqlalchemy.orm import Session

from app.models.finding import Finding

logger = logging.getLogger(__name__)

STATIC_ANALYZERS = {"semgrep", "gitleaks", "tree_sitter", "dependencies", "configuration", "git", "mock"}
AI_ANALYZERS = {"opencode", "agy", "ai"}


def normalize_file_path(path: str | None) -> str:
    """Normalize file path for cross-analyzer comparison."""
    if not path:
        return ""
    clean = path.strip().replace("\\", "/")
    # Strip leading ./ or /
    clean = re.sub(r"^\.?/+", "", clean)
    return clean.lower()


def are_categories_related(cat1: str | None, cat2: str | None, title1: str = "", title2: str = "") -> bool:
    """Check if two findings describe a similar category or vulnerability type."""
    c1 = (cat1 or "").lower()
    c2 = (cat2 or "").lower()
    t1 = title1.lower()
    t2 = title2.lower()

    if c1 and c2 and (c1 == c2 or c1 in c2 or c2 in c1):
        return True

    # Common security keywords for fuzzy category matching
    keywords = [
        "sql", "injection", "xss", "cross-site", "secret", "password", "token",
        "credential", "command", "exec", "eval", "deserialization", "cve",
        "traversal", "hardcoded", "overflow", "auth", "permission", "cors",
        "debug", "unpinned", "crypto", "hash"
    ]
    for kw in keywords:
        if (kw in t1 or kw in c1) and (kw in t2 or kw in c2):
            return True

    return False


def match_findings(static_f: Any, ai_f: Any) -> bool:
    """Determine if a static finding and an AI finding refer to the same vulnerability."""
    file_s = normalize_file_path(getattr(static_f, "file", None) or "")
    file_a = normalize_file_path(getattr(ai_f, "file", None) or "")

    # If both have file paths, they should match (or one is subpath of the other)
    if file_s and file_a:
        files_match = (
            file_s == file_a
            or file_s.endswith("/" + file_a)
            or file_a.endswith("/" + file_s)
            or os.path.basename(file_s) == os.path.basename(file_a)
        )
        if not files_match:
            return False

    line_s = getattr(static_f, "line_start", None)
    line_a = getattr(ai_f, "line_start", None) or getattr(ai_f, "line", None)

    # Line proximity match (within 12 lines)
    if line_s is not None and line_a is not None:
        try:
            diff = abs(int(line_s) - int(line_a))
            if diff <= 12:
                return True
        except (ValueError, TypeError):
            pass

    # If line numbers are missing or distant, check category/title similarity
    title_s = getattr(static_f, "title", "")
    title_a = getattr(ai_f, "title", "")
    cat_s = getattr(static_f, "category", "")
    cat_a = getattr(ai_f, "category", "")

    return are_categories_related(cat_s, cat_a, title_s, title_a)


def compute_scan_differential(
    static_findings: Sequence[Any],
    ai_findings: Sequence[Any],
    static_scan_id: int | None = None,
    ai_scan_id: int | None = None,
) -> dict[str, Any]:
    """
    Compare static scan findings with AI scan findings and partition them into:
    1. Corroborated (detected by both)
    2. AI-only (missed by static tools, found by AI)
    3. Static-only (found by static tools, missed by AI)
    """
    corroborated_pairs = []
    matched_static_indices = set()
    matched_ai_indices = set()

    for a_idx, ai_f in enumerate(ai_findings):
        best_s_idx = None
        for s_idx, static_f in enumerate(static_findings):
            if s_idx in matched_static_indices:
                continue
            if match_findings(static_f, ai_f):
                best_s_idx = s_idx
                break

        if best_s_idx is not None:
            matched_ai_indices.add(a_idx)
            matched_static_indices.add(best_s_idx)
            corroborated_pairs.append({
                "static": _serialize_finding_summary(static_findings[best_s_idx]),
                "ai": _serialize_finding_summary(ai_f),
                "agreement": "confirmed",
                "file": getattr(ai_f, "file", None) or getattr(static_findings[best_s_idx], "file", ""),
                "line": getattr(ai_f, "line_start", None) or getattr(static_findings[best_s_idx], "line_start", None),
            })

    ai_only = [
        _serialize_finding_summary(ai_f, badge="ai_only")
        for idx, ai_f in enumerate(ai_findings)
        if idx not in matched_ai_indices
    ]

    static_only = [
        _serialize_finding_summary(static_f, badge="static_only")
        for idx, static_f in enumerate(static_findings)
        if idx not in matched_static_indices
    ]

    total_static = len(static_findings)
    total_ai = len(ai_findings)
    corroborated_count = len(corroborated_pairs)
    ai_only_count = len(ai_only)
    static_only_count = len(static_only)

    overlap_rate = round((corroborated_count / max(1, total_static)) * 100, 1)
    ai_discovery_rate = round((ai_only_count / max(1, total_ai)) * 100, 1)

    # Generate executive insights summary
    insights = _generate_executive_insights(
        total_static=total_static,
        total_ai=total_ai,
        corroborated_count=corroborated_count,
        ai_only_count=ai_only_count,
        static_only_count=static_only_count,
    )

    return {
        "static_scan_id": static_scan_id,
        "ai_scan_id": ai_scan_id,
        "metrics": {
            "total_static": total_static,
            "total_ai": total_ai,
            "corroborated_count": corroborated_count,
            "ai_only_count": ai_only_count,
            "static_only_count": static_only_count,
            "overlap_percentage": overlap_rate,
            "ai_discovery_percentage": ai_discovery_rate,
        },
        "executive_summary": insights,
        "corroborated": corroborated_pairs,
        "ai_only": ai_only,
        "static_only": static_only,
    }


def _serialize_finding_summary(f: Any, badge: str = "") -> dict[str, Any]:
    """Serialize finding model or dict into clean comparison view model."""
    if isinstance(f, dict):
        return {
            "id": str(f.get("id", "")),
            "title": f.get("title", "Untitled Finding"),
            "severity": str(f.get("severity", "medium")),
            "category": str(f.get("category", "vulnerability")),
            "file": f.get("file", ""),
            "line_start": f.get("line_start") or f.get("line"),
            "description": f.get("description", ""),
            "remediation": f.get("remediation", ""),
            "analyzer": f.get("analyzer", "ai"),
            "badge": badge,
        }

    return {
        "id": str(getattr(f, "id", "")),
        "title": getattr(f, "title", "Untitled Finding"),
        "severity": str(getattr(f, "severity", "medium")),
        "category": str(getattr(f, "category", "vulnerability")),
        "file": getattr(f, "file", ""),
        "line_start": getattr(f, "line_start", None),
        "description": getattr(f, "description", ""),
        "remediation": getattr(f, "remediation", ""),
        "analyzer": getattr(f, "analyzer", ""),
        "badge": badge,
    }


def _generate_executive_insights(
    total_static: int,
    total_ai: int,
    corroborated_count: int,
    ai_only_count: int,
    static_only_count: int,
) -> str:
    """Generate deterministic synthesis comparing static rules vs AI findings."""
    if total_static == 0 and total_ai == 0:
        return "No security issues were identified by either static analyzers or AI models."

    if total_static == 0:
        return f"AI analysis identified {total_ai} potential vulnerabilities across the codebase, while static analysis found 0."

    if total_ai == 0:
        return f"Static analysis identified {total_static} vulnerabilities, while the AI model reported no additional findings."

    parts = []
    if corroborated_count > 0:
        parts.append(
            f"{corroborated_count} finding(s) were cross-validated by both deterministic static rules and the AI model (highest confidence)."
        )

    if ai_only_count > 0:
        parts.append(
            f"The AI model identified {ai_only_count} unique vulnerability pattern(s) that traditional AST and regex scanners missed (such as logic flows or contextual risks)."
        )

    if static_only_count > 0:
        parts.append(
            f"Static analyzers flagged {static_only_count} specific rule violation(s) (e.g. hardcoded secrets or package CVEs) not highlighted by the AI model."
        )

    return " ".join(parts)
