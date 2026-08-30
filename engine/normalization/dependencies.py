from collections.abc import Mapping
from typing import Any
from engine.models.finding import Confidence, Finding, FindingCategory, Severity

def normalize_unpinned_finding(unpinned_files: list[str], unpinned_count: int) -> Finding:
    files = sorted(unpinned_files)
    return Finding(
        analyzer="dependencies",
        category=FindingCategory.DEPENDENCY,
        title=f"{unpinned_count} dependencies without exact version pins",
        description=(
            "The following manifests contain unpinned version requirements "
            f"(range, latest or path specs): {', '.join(files)}. Unpinned "
            "dependencies cannot be checked against the vulnerability feed "
            "and drift over time."
        ),
        severity=Severity.INFO,
        confidence=Confidence.MEDIUM,
        file=files[0] if files else "",
        rule_id="unpinned-dependencies",
        evidence={"count": unpinned_count, "manifests": files},
        remediation=(
            "Pin exact versions (== in pip, exact version in package.json) and use a lockfile."
        ),
        metadata={"rule": "unpinned-dependencies"},
    )

def normalize_vuln_finding(
    dep_name: str, 
    dep_version: str | None, 
    dep_file: str, 
    dep_line: int | None, 
    dep_ecosystem: str,
    vuln: dict[str, Any]
) -> Finding:
    vuln_id = str(vuln.get("id", "OSV"))
    severity = _severity(vuln)
    aliases = [str(a) for a in vuln.get("aliases", []) if isinstance(a, str)]
    title = vuln.get("summary") or vuln_id
    fixed = _fixed_version(vuln)
    remediation = (
        f"Upgrade {dep_name} to {fixed} or later." if fixed else f"Review advisory {vuln_id}."
    )
    return Finding(
        analyzer="dependencies",
        category=FindingCategory.DEPENDENCY,
        title=f"{dep_name} {dep_version}: {title}",
        description=(
            f"{dep_name} {dep_version} (listed in {dep_file}) is affected by "
            f"{vuln_id}{' (' + ', '.join(aliases) + ')' if aliases else ''}. "
            f"{title}"
        ),
        severity=severity,
        confidence=Confidence.HIGH,
        file=dep_file,
        line_start=dep_line,
        line_end=dep_line,
        rule_id=vuln_id,
        evidence={
            "ecosystem": dep_ecosystem,
            "version": dep_version,
            "aliases": aliases,
        },
        remediation=remediation,
        metadata={"rule": "osv-vulnerability", "osv_id": vuln_id},
    )

def _severity(vuln: dict[str, Any]) -> Severity:
    best = 0.0
    for entry in vuln.get("severity", []) or []:
        if not isinstance(entry, Mapping):
            continue
        if entry.get("type") != "CVSS_V3":
            continue
        try:
            best = max(best, float(entry.get("score", 0)))
        except (TypeError, ValueError):
            continue
    if best >= 9.0:
        return Severity.CRITICAL
    if best >= 7.0:
        return Severity.HIGH
    if best >= 4.0:
        return Severity.MEDIUM
    return Severity.LOW if best > 0 else Severity.MEDIUM

def _fixed_version(vuln: dict[str, Any]) -> str | None:
    for affected in vuln.get("affected", []) or []:
        if not isinstance(affected, Mapping):
            continue
        for range_ in affected.get("ranges", []) or []:
            if not isinstance(range_, Mapping):
                continue
            for event in range_.get("events", []) or []:
                if isinstance(event, Mapping) and event.get("fixed"):
                    return str(event["fixed"])
    return None
