from collections.abc import Mapping
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

def normalize_gitleaks_finding(leak: Mapping[str, object]) -> Finding:
    file = str(leak.get("File", ""))
    rule_id = str(leak.get("RuleID", "gitleaks-rule"))
    severity = _severity(rule_id)
    description = str(
        leak.get("Description", "") or f"gitleaks rule {rule_id} matched a secret-like value"
    )
    snippet = str(leak.get("Match", "") or "").strip()

    return Finding(
        analyzer="gitleaks",
        category=FindingCategory.SECRETS,
        title=_title(rule_id),
        description=description,
        severity=severity,
        confidence=Confidence.MEDIUM,
        file=file,
        line_start=leak.get("StartLine") if isinstance(leak.get("StartLine"), int) else None,
        line_end=leak.get("EndLine") if isinstance(leak.get("EndLine"), int) else None,
        code_snippet=snippet or None,
        rule_id=rule_id,
        evidence={
            "leak_type": rule_id,
            "redacted": True,
            "commit": str(leak.get("Commit", "")) if leak.get("Commit") else None,
        },
        remediation=(
            "Rotate the exposed credential immediately, remove it from the "
            "repository and rewrite history if it was ever pushed."
        ),
        metadata={"rule": rule_id},
    )

def _title(rule_id: str) -> str:
    return (rule_id.replace("_", " ").replace("-", " ").title() or "Exposed secret") + " (gitleaks)"

def _severity(rule_id: str) -> Severity:
    lowered = rule_id.lower()
    if "generic" in lowered or "api" in lowered:
        return Severity.MEDIUM
    return Severity.HIGH
