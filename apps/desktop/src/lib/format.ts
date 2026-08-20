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
  pending: "bg-surface-container text-on-surface-variant border border-outline-variant",
  running: "bg-secondary/10 text-secondary border border-secondary/30",
  completed: "bg-primary/10 text-primary border border-primary/30",
  failed: "bg-error/10 text-error border border-error/30",
  canceled: "bg-surface-container text-on-surface-variant border border-outline-variant",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Design-token severity colors for pips/bars (see cybernetic_developer_core). */
export const SEVERITY_DOT_CLASSES: Record<Severity, string> = {
  critical: "bg-error",
  high: "bg-tertiary",
  medium: "bg-secondary",
  low: "bg-outline",
  info: "bg-outline-variant",
};

export const SEVERITY_TEXT_CLASSES: Record<Severity, string> = {
  critical: "text-error",
  high: "text-tertiary",
  medium: "text-secondary",
  low: "text-on-surface-variant",
  info: "text-on-surface-variant",
};

export const SEVERITY_BAR_CLASSES: Record<Severity, string> = {
  critical: "bg-error",
  high: "bg-tertiary",
  medium: "bg-secondary",
  low: "bg-outline",
  info: "bg-outline-variant",
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