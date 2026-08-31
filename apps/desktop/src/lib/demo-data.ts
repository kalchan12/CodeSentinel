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

export interface DependencyItem {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  ecosystem: "npm" | "PyPI" | "Go" | "crates.io";
  manifest: string;
  license: string;
  vulnerabilityCount: number;
  maxSeverity: "critical" | "high" | "medium" | "low" | "none";
  advisories: {
    id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    fixedIn?: string;
  }[];
}

export const DEMO_DEPENDENCIES: DependencyItem[] = [
  {
    id: "dep-lodash",
    name: "lodash",
    version: "4.17.15",
    latestVersion: "4.17.21",
    ecosystem: "npm",
    manifest: "apps/desktop/package.json",
    license: "MIT",
    vulnerabilityCount: 2,
    maxSeverity: "high",
    advisories: [
      { id: "GHSA-p6mc-m468-83gw", title: "Prototype Pollution in lodash", severity: "high", fixedIn: "4.17.21" },
      { id: "CVE-2020-8203", title: "Prototype Pollution in zipObjectDeep", severity: "medium", fixedIn: "4.17.19" },
    ],
  },
  {
    id: "dep-axios",
    name: "axios",
    version: "0.21.1",
    latestVersion: "1.7.4",
    ecosystem: "npm",
    manifest: "apps/desktop/package.json",
    license: "MIT",
    vulnerabilityCount: 1,
    maxSeverity: "high",
    advisories: [
      { id: "CVE-2021-3749", title: "Regular Expression Denial of Service in axios", severity: "high", fixedIn: "0.21.2" },
    ],
  },
  {
    id: "dep-fastapi",
    name: "fastapi",
    version: "0.110.0",
    latestVersion: "0.115.0",
    ecosystem: "PyPI",
    manifest: "pyproject.toml",
    license: "MIT",
    vulnerabilityCount: 0,
    maxSeverity: "none",
    advisories: [],
  },
  {
    id: "dep-pydantic",
    name: "pydantic",
    version: "2.6.4",
    latestVersion: "2.8.2",
    ecosystem: "PyPI",
    manifest: "pyproject.toml",
    license: "MIT",
    vulnerabilityCount: 0,
    maxSeverity: "none",
    advisories: [],
  },
  {
    id: "dep-cryptography",
    name: "cryptography",
    version: "41.0.3",
    latestVersion: "43.0.0",
    ecosystem: "PyPI",
    manifest: "pyproject.toml",
    license: "Apache-2.0 / BSD",
    vulnerabilityCount: 1,
    maxSeverity: "medium",
    advisories: [
      { id: "CVE-2023-49083", title: "NULL-dereference when parsing PKCS#7 certificates", severity: "medium", fixedIn: "41.0.6" },
    ],
  },
  {
    id: "dep-tree-sitter",
    name: "tree-sitter",
    version: "0.22.6",
    latestVersion: "0.22.6",
    ecosystem: "PyPI",
    manifest: "pyproject.toml",
    license: "MIT",
    vulnerabilityCount: 0,
    maxSeverity: "none",
    advisories: [],
  },
  {
    id: "dep-celery",
    name: "celery",
    version: "5.4.0",
    latestVersion: "5.4.0",
    ecosystem: "PyPI",
    manifest: "pyproject.toml",
    license: "BSD-3-Clause",
    vulnerabilityCount: 0,
    maxSeverity: "none",
    advisories: [],
  },
];

export interface SecretItem {
  id: string;
  ruleId: string;
  title: string;
  type: string;
  file: string;
  line: number;
  commit?: string;
  maskedSecret: string;
  severity: "critical" | "high" | "medium";
  confidence: "high" | "medium" | "low";
  status: "active" | "rotated" | "ignored";
  detectedAt: string;
}

export const DEMO_SECRETS: SecretItem[] = [
  {
    id: "sec-aws-access-key",
    ruleId: "aws-access-token",
    title: "AWS Access Key ID",
    type: "Cloud Credential",
    file: "config/aws.js",
    line: 12,
    commit: "7f4c91a",
    maskedSecret: "AKIAIOSFODNN7EXAMPLE",
    severity: "critical",
    confidence: "high",
    status: "active",
    detectedAt: DEMO_TIMESTAMP,
  },
  {
    id: "sec-openai-api-key",
    ruleId: "openai-api-key",
    title: "OpenAI API Secret Key",
    type: "API Token",
    file: "packages/engine/ai/config.env",
    line: 4,
    commit: "2d8b10e",
    maskedSecret: "sk-proj-********************************4a2F",
    severity: "high",
    confidence: "high",
    status: "active",
    detectedAt: DEMO_TIMESTAMP,
  },
  {
    id: "sec-jwt-secret",
    ruleId: "generic-api-key",
    title: "Hardcoded JWT Secret Token",
    type: "Auth Secret",
    file: "apps/backend/app/config.py",
    line: 28,
    commit: "e12a9c4",
    maskedSecret: "super-secret-jwt-key-development",
    severity: "high",
    confidence: "medium",
    status: "active",
    detectedAt: DEMO_TIMESTAMP,
  },
  {
    id: "sec-db-connection",
    ruleId: "postgres-uri-password",
    title: "PostgreSQL Database Credentials",
    type: "Database URI",
    file: ".env.example",
    line: 3,
    commit: "a094bb1",
    maskedSecret: "postgresql://postgres:********@localhost:5432/codesentinel",
    severity: "medium",
    confidence: "high",
    status: "ignored",
    detectedAt: DEMO_TIMESTAMP,
  },
];

export interface ReportSummary {
  projectName: string;
  scanId: number;
  generatedAt: string;
  overallScore: number;
  grade: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  compliance: {
    framework: string;
    score: number;
    status: "compliant" | "warning" | "failing";
    violations: number;
  }[];
}

export const DEMO_REPORT: ReportSummary = {
  projectName: "payments-api",
  scanId: 8923,
  generatedAt: DEMO_TIMESTAMP,
  overallScore: 72,
  grade: "B-",
  totalFindings: 188,
  criticalCount: 3,
  highCount: 12,
  mediumCount: 45,
  lowCount: 128,
  compliance: [
    { framework: "OWASP Top 10 (2021)", score: 68, status: "warning", violations: 8 },
    { framework: "CWE Top 25 (2023)", score: 74, status: "warning", violations: 4 },
    { framework: "Secret Hygiene & Credentials", score: 55, status: "failing", violations: 3 },
    { framework: "SCA / Dependency Health", score: 82, status: "compliant", violations: 2 },
  ],
};

export interface AIInsightItem {
  id: string;
  category: "vulnerability" | "architecture" | "secret" | "refactor" | "configuration";
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  summary: string;
  affectedFiles: string[];
  rootCause: string;
  remediationSnippet: string;
  tokenCost: number;
}

export const DEMO_AI_INSIGHTS: AIInsightItem[] = [
  {
    id: "ai-sql-injection-flow",
    category: "vulnerability",
    title: "Taint Flow: Unsanitized Request Param to SQL Cursor",
    severity: "critical",
    confidence: "high",
    summary:
      "Taint analysis across request handlers shows user_id enters without type casting or parameterized binding, creating a direct SQL injection vector through psycopg2 cursor execution.",
    affectedFiles: ["src/api/users.py", "src/services/user_service.py"],
    rootCause: "Inline string concatenation in db query builder instead of tuple argument parameters.",
    remediationSnippet: `// Suggested Patch in src/api/users.py:
- query = "SELECT * FROM users WHERE id = " + user_id
- cursor.execute(query)
+ query = "SELECT * FROM users WHERE id = %s"
+ cursor.execute(query, (int(user_id),))`,
    tokenCost: 412,
  },
  {
    id: "ai-jwt-algorithm-none",
    category: "architecture",
    title: "JWT Token Validation Accepts None Algorithm",
    severity: "high",
    confidence: "high",
    summary:
      "JWT decoding function does not specify algorithms=['HS256'], allowing attackers to forge tokens with algorithm: 'none' and bypass authentication.",
    affectedFiles: ["apps/backend/app/api/auth.py"],
    rootCause: "jwt.decode call omitted explicit algorithms whitelist parameter.",
    remediationSnippet: `// Suggested Patch in apps/backend/app/api/auth.py:
- payload = jwt.decode(token, SECRET_KEY)
+ payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])`,
    tokenCost: 285,
  },
  {
    id: "ai-cors-wildcard",
    category: "configuration",
    title: "Overly Permissive CORS Middleware Configuration",
    severity: "medium",
    confidence: "medium",
    summary:
      "FastAPI CORSMiddleware has allow_origins=['*'] with allow_credentials=True, which is rejected by modern browsers and leaks internal endpoints.",
    affectedFiles: ["apps/backend/app/main.py"],
    rootCause: "Wildcard origin specified in production configuration dictionary.",
    remediationSnippet: `// Suggested Patch in apps/backend/app/main.py:
- allow_origins=["*"]
+ allow_origins=settings.allowed_cors_origins`,
    tokenCost: 190,
  },
];


export interface ConfigItem {
  id: string;
  ruleId: string;
  title: string;
  file: string;
  line: number;
  type: string;
  status: "active" | "resolved" | "ignored";
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  remediation?: string;
  codeSnippet?: string;
  detectedAt?: string;
}

export const DEMO_CONFIGS: ConfigItem[] = [
  {
    id: "cfg-1",
    ruleId: "cfg-docker-no-volume",
    title: "Postgres Container Missing Persistent Volume",
    file: "docker-compose.yml",
    line: 12,
    type: "Insecure Defaults",
    status: "active",
    severity: "medium",
    description: "Postgres container is running without a configured volume, risking data loss.",
    remediation: "Mount a named volume or host directory under /var/lib/postgresql/data.",
    codeSnippet: "image: postgres:16-alpine",
    detectedAt: "2026-08-30T10:00:00Z",
  },
  {
    id: "cfg-2",
    ruleId: "cfg-nginx-missing-hsts",
    title: "Missing Strict-Transport-Security Header",
    file: "nginx.conf",
    line: 45,
    type: "Missing Headers",
    status: "active",
    severity: "low",
    description: "Missing Strict-Transport-Security header in HTTPS server block.",
    remediation: 'Add \'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\'',
    codeSnippet: "server { listen 443 ssl; }",
    detectedAt: "2026-08-30T10:05:00Z",
  },
  {
    id: "cfg-3",
    ruleId: "cfg-fastapi-cors-wildcard",
    title: "Overly Permissive CORS Origin",
    file: "apps/backend/app/main.py",
    line: 28,
    type: "Open CORS",
    status: "active",
    severity: "high",
    description: "Wildcard CORS origin '*' used with credentials enabled.",
    remediation: "Specify explicit trusted origins in CORS middleware settings.",
    codeSnippet: "allow_origins=['*'], allow_credentials=True",
    detectedAt: "2026-08-30T10:10:00Z",
  },
];
