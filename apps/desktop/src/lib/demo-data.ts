import type { Finding, FindingsPage, Project, RiskAssessment, Scan } from "@codesentinel/shared";

/**
 * Canonical-model fixtures used only when the local API has no data yet.
 * They keep the four UI reference screens navigable without introducing a
 * second, UI-only shape that would drift from the backend contract.
 */
const DEMO_TIMESTAMP = "2026-08-21T09:42:00.000Z";

export const DEMO_PROJECTS: Project[] = [
  {
    id: 1,
    name: "payments-api",
    description: "Payment service API",
    source_type: "github",
    local_path: null,
    repo_url: "github.com/company/payments-api",
    scan_count: 8,
    last_scan_status: "completed",
    last_scan_id: 8923,
    created_at: DEMO_TIMESTAMP,
  },
  {
    id: 2,
    name: "auth-service",
    description: "Authentication service",
    source_type: "github",
    local_path: null,
    repo_url: "github.com/company/auth-service",
    scan_count: 4,
    last_scan_status: "completed",
    last_scan_id: 8922,
    created_at: DEMO_TIMESTAMP,
  },
  {
    id: 3,
    name: "frontend-web",
    description: "Customer-facing web application",
    source_type: "local",
    local_path: "/workspace/frontend-web",
    repo_url: null,
    scan_count: 12,
    last_scan_status: "completed",
    last_scan_id: 8921,
    created_at: DEMO_TIMESTAMP,
  },
];

export const DEMO_DASHBOARD_SCAN: Scan = {
  id: 8923,
  project_id: 1,
  status: "completed",
  progress: 100,
  celery_task_id: null,
  error_message: null,
  findings_count: 188,
  correlation: null,
  started_at: DEMO_TIMESTAMP,
  completed_at: DEMO_TIMESTAMP,
  created_at: DEMO_TIMESTAMP,
  risk_score: 72,
  risk_level: "high",
};

export const DEMO_ACTIVE_SCAN: Scan = {
  id: 8924,
  project_id: 1,
  status: "running",
  progress: 42,
  celery_task_id: "demo-scan-8924",
  error_message: null,
  findings_count: 17,
  correlation: null,
  started_at: DEMO_TIMESTAMP,
  completed_at: null,
  created_at: DEMO_TIMESTAMP,
  risk_score: null,
  risk_level: null,
};

export const DEMO_FINDINGS: Finding[] = [
  {
    id: "demo-sql-injection",
    scan_id: DEMO_DASHBOARD_SCAN.id,
    analyzer: "semgrep",
    category: "vulnerability",
    severity: "critical",
    confidence: "high",
    title: "SQL Injection",
    description:
      "Direct string concatenation in SQL queries allows attackers to inject malicious SQL commands. If a user provides input such as 1 OR 1=1, the resulting query can expose all user records or allow destructive operations.",
    file: "src/api/users.py",
    line_start: 43,
    line_end: 43,
    code_snippet: `@app.route('/users', methods=['GET'])
def get_user():
    user_id = request.args.get('id')
    query = "SELECT * FROM users WHERE id = " + user_id
    cursor.execute(query)
    return jsonify(cursor.fetchone())`,
    rule_id: "CWE-89",
    evidence: { matched_pattern: "string-concatenated SQL query" },
    remediation: "Use parameterized queries to safely bind variables.",
    metadata: {
      confidence_score: 91,
      snippet_start_line: 40,
      ai_summary: "The analyzer detected unparameterized input user_id flowing directly into cursor.execute().",
      remediation_example: 'query = "SELECT * FROM users WHERE id = %s"\ncursor.execute(query, (user_id,))',
    },
    risk_score: 94,
    risk_level: "critical",
    created_at: DEMO_TIMESTAMP,
  },
  {
    id: "demo-hardcoded-api-key",
    scan_id: DEMO_DASHBOARD_SCAN.id,
    analyzer: "gitleaks",
    category: "secrets",
    severity: "high",
    confidence: "high",
    title: "Hardcoded API Key",
    description: "An AWS Secret Access Key pattern was found in the repository.",
    file: "config/aws.js",
    line_start: 12,
    line_end: 12,
    code_snippet: null,
    rule_id: "aws-access-key-id",
    evidence: { pattern: "AWS access key", value_masked: true },
    remediation: "Move the credential to a secret manager and rotate the exposed key.",
    metadata: { confidence_score: 88 },
    risk_score: 81,
    risk_level: "critical",
    created_at: DEMO_TIMESTAMP,
  },
  {
    id: "demo-outdated-lodash",
    scan_id: DEMO_DASHBOARD_SCAN.id,
    analyzer: "osv",
    category: "dependency",
    severity: "medium",
    confidence: "high",
    title: "Outdated Dependency: Lodash",
    description: "Version 4.17.15 contains a known prototype-pollution vulnerability.",
    file: "package.json",
    line_start: null,
    line_end: null,
    code_snippet: null,
    rule_id: "GHSA-p6mc-m468-83gw",
    evidence: { package: "lodash", installed_version: "4.17.15" },
    remediation: "Upgrade lodash to a patched version.",
    metadata: { confidence_score: 98 },
    risk_score: 58,
    risk_level: "medium",
    created_at: DEMO_TIMESTAMP,
  },
];

export const DEMO_FINDINGS_PAGE: FindingsPage = {
  total: 188,
  items: DEMO_FINDINGS,
};

export const DEMO_RISK_ASSESSMENT: RiskAssessment = {
  id: 1,
  scan_id: DEMO_DASHBOARD_SCAN.id,
  overall_score: 84,
  overall_level: "high",
  algorithm: "explainable-v1",
  rationale: "Weighted by normalized severity, confidence, exploitability, and project context.",
  breakdown: {
    finding_count: 188,
    severity_counts: { critical: 3, high: 12, medium: 45, low: 128, info: 0 },
    max_score: 94,
    weighted_average_score: 84,
  },
  top_priorities: [
    {
      finding_id: "demo-sql-injection",
      title: "SQL Injection",
      file: "src/api/users.py",
      severity: "critical",
      score: 94,
      remediation: "Use parameterized queries to safely bind variables.",
    },
  ],
  finding_risks: null,
  created_at: DEMO_TIMESTAMP,
};

export function demoFindingsForSeverity(severity?: string): FindingsPage {
  const items = severity ? DEMO_FINDINGS.filter((finding) => finding.severity === severity) : DEMO_FINDINGS;
  return { total: severity ? items.length : DEMO_FINDINGS_PAGE.total, items };
}
