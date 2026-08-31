/**
 * CodeSentinel shared types.
 *
 * These mirror the OpenAPI contract produced by the FastAPI backend
 * (engine domain models + app.schemas). Keep them in sync when the API
 * changes; see docs/api/endpoints.md.
 */

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";
export type FindingCategory =
  | "secrets"
  | "vulnerability"
  | "dependency"
  | "configuration"
  | "code_quality"
  | "repository"
  | "ai_insight";
export type SourceType = "local" | "github";
export type ScanStatus = "pending" | "running" | "completed" | "failed" | "canceled";

export const SEVERITY_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];

export const SEVERITY_STYLES: Record<Severity, string> = {
  info: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  secrets: "Secrets",
  vulnerability: "Vulnerability",
  dependency: "Dependency",
  configuration: "Configuration",
  code_quality: "Code quality",
  repository: "Repository",
  ai_insight: "AI insight",
};

export interface Project {
  id: number;
  name: string;
  description: string | null;
  source_type: SourceType;
  local_path: string | null;
  repo_url: string | null;
  scan_count: number;
  last_scan_status: ScanStatus | null;
  last_scan_id: number | null;
  last_scan_score: number | null;
  last_scan_findings_count: number | null;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
  source_type: SourceType;
  local_path?: string | null;
  repo_url?: string | null;
}

export interface Scan {
  id: number;
  project_id: number;
  status: ScanStatus;
  progress: number;
  celery_task_id: string | null;
  error_message: string | null;
  findings_count: number;
  correlation: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  risk_score: number | null;
  risk_level: Severity | null;
}

export interface Finding {
  id: string;
  scan_id: number;
  analyzer: string;
  category: FindingCategory;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  file: string;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  rule_id: string | null;
  evidence: Record<string, unknown> | null;
  remediation: string | null;
  metadata: Record<string, unknown>;
  risk_score: number | null;
  risk_level: Severity | null;
  created_at: string;
}

export interface FindingsPage {
  total: number;
  items: Finding[];
}

export interface RiskBreakdown {
  finding_count: number;
  severity_counts: Record<Severity, number>;
  max_score: number;
  weighted_average_score: number;
}

export interface PriorityItem {
  finding_id: string;
  title: string;
  file: string;
  severity: Severity;
  score: number;
  remediation: string | null;
}

export interface RiskAssessment {
  id: number;
  scan_id: number;
  overall_score: number;
  overall_level: Severity;
  algorithm: string | null;
  rationale: string | null;
  breakdown: RiskBreakdown | null;
  top_priorities: PriorityItem[] | null;
  finding_risks: Array<Record<string, unknown>> | null;
  created_at: string;
}

/** Overall severity buckets for the dashboard distribution chart. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  info: "#94a3b8",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};