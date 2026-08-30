from engine.models.finding import Confidence, Finding, FindingCategory, Severity

def normalize_configuration_finding(
    rule_id: str,
    title: str,
    severity: Severity,
    remediation: str,
    path: str,
    lines: list[str],
    line_no: int,
    snippet_lines: int = 3
) -> Finding:
    return Finding(
        analyzer="configuration",
        category=FindingCategory.CONFIGURATION,
        title=title,
        description=f"Security-relevant setting matched in {path}:{line_no}.",
        severity=severity,
        confidence=Confidence.MEDIUM,
        file=path,
        line_start=line_no,
        line_end=line_no,
        code_snippet="\n".join(lines[max(0, line_no - snippet_lines) : line_no + snippet_lines]),
        rule_id=rule_id,
        remediation=remediation,
        metadata={"rule": rule_id},
    )
