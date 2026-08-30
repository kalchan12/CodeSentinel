from collections.abc import Mapping
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

_SEVERITY_MAP = {
    "ERROR": Severity.HIGH,
    "WARNING": Severity.MEDIUM,
    "INFO": Severity.LOW,
}

_CATEGORY_MAP = {
    "secrets": FindingCategory.SECRETS,
    "security": FindingCategory.VULNERABILITY,
    "correctness": FindingCategory.CODE_QUALITY,
    "best-practice": FindingCategory.CODE_QUALITY,
}

def normalize_semgrep_finding(result: Mapping[str, object]) -> Finding:
    extra = result.get("extra", {}) or {}
    metadata = extra.get("metadata", {}) or {}
    severity = _SEVERITY_MAP.get(str(extra.get("severity", "WARNING")).upper(), Severity.MEDIUM)
    category = _CATEGORY_MAP.get(
        str(metadata.get("category", "")).lower(), FindingCategory.VULNERABILITY
    )
    check_id = str(result.get("check_id", "semgrep-rule"))
    path = str(result.get("path", ""))
    start = result.get("start", {}) or {}
    end = result.get("end", {}) or {}
    line_start = start.get("line") if isinstance(start, Mapping) else None
    line_end = end.get("line") if isinstance(end, Mapping) else None
    snippet = str(extra.get("lines", "") or "").strip()
    message = str(extra.get("message", "")).strip() or check_id

    return Finding(
        analyzer="semgrep",
        category=category,
        title=_title_from_rule(check_id),
        description=message,
        severity=severity,
        confidence=Confidence.HIGH,
        file=path,
        line_start=line_start,
        line_end=line_end,
        code_snippet=snippet or None,
        rule_id=check_id,
        evidence={
            "semgrep_severity": str(extra.get("severity", "")),
            "rule_category": str(metadata.get("category", "")),
        },
        remediation=_remediation_from_metadata(metadata),
        metadata={"rule": check_id},
    )

def _title_from_rule(check_id: str) -> str:
    short = check_id.rsplit(".", 1)[-1]
    return short.replace("-", " ").replace("_", " ").title()

def _remediation_from_metadata(metadata: Mapping[str, object]) -> str | None:
    for key in ("fix", "remediation", "message"):
        value = metadata.get(key)
        if value:
            return str(value)
    return None
