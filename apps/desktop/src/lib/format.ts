import type { ScanStatus, Severity } from "@codesentinel/shared";
import { SEVERITY_STYLES } from "@codesentinel/shared";

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

export const SCAN_STATUS_STYLES: Record<ScanStatus, string> = {
  pending: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function severityClass(severity: Severity): string {
  return SEVERITY_STYLES[severity];
}

export function formatLine(findingLocation: {
  file: string;
  line_start: number | null;
  line_end: number | null;
}): string {
  const file = findingLocation.file || "<unknown>";
  if (findingLocation.line_start != null) {
    return `${file}:${findingLocation.line_start}`;
  }
  return file;
}

export function formatRiskScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return score.toFixed(0);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString();
}