"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bolt,
  ChevronDown,
  Database,
  FileText,
  History,
  Info,
  KeyRound,
  MoreVertical,
  Package,
  Timer,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { Finding, FindingsPage, RiskAssessment, Scan, Severity } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  formatDate,
  formatLine,
  SEVERITY_BAR_CLASSES,
  SEVERITY_DOT_CLASSES,
  SEVERITY_LABELS,
  SEVERITY_TEXT_CLASSES,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof api.listProjects>> | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

  const load = useCallback(async () => {
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);
      const withScans = projectList.filter((p) => p.last_scan_id != null);
      if (withScans.length === 0) return;
      const target = withScans[0];
      const scans = await api.listProjectScans(target.id);
      const latest = scans[0];
      if (!latest) return;
      setScan(latest);
      if (latest.status === "completed") {
        const [f, a] = await Promise.all([
          api.getFindings(latest.id, {}).catch(() => null),
          api.getAssessment(latest.id).catch(() => null),
        ]);
        setFindings(f);
        setAssessment(a);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (projects === null) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const projectsWithScans = projects.filter((p) => p.last_scan_id != null);
  const currentProject = projectsWithScans.length > 0 ? projectsWithScans[0] : null;

  if (!currentProject || !scan) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-container/20 text-primary">
          <Database className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-on-surface">No security data yet</h3>
        <p className="max-w-sm text-sm text-on-surface-variant">
          Create a project and run your first scan to see the security dashboard.
        </p>
        <Link
          href="/projects"
          className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary-container"
        >
          <Bolt className="h-4 w-4" />
          Go to Projects
        </Link>
      </div>
    );
  }

  const severityCounts = computeSeverityCounts(assessment, scan);
  const healthScore = assessment ? Math.round(assessment.overall_score) : null;
  const riskLabel = assessment?.overall_level ?? scan.risk_level ?? null;
  const riskTextClass = riskLabel ? SEVERITY_TEXT_CLASSES[riskLabel as Severity] : "text-on-surface-variant";

  return (
    <div className="flex flex-col gap-6">
      {/* Hero + Severity summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="gradient-border relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-xl p-8 lg:col-span-2">
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded border border-error/20 bg-error/10 px-2 py-0.5 text-[11px] font-bold tracking-widest text-error uppercase">
                Scan #{scan.id}
              </span>
              <span className="text-xs font-medium text-on-surface-variant">
                {scan.status === "running"
                  ? `Running · ${Math.round(scan.progress)}%`
                  : `Last scan · ${formatDate(scan.completed_at ?? scan.started_at ?? scan.created_at)}`}
              </span>
            </div>
            <h3 className="mb-2 text-3xl font-bold text-on-surface">Overall Security Health</h3>
            <p className="max-w-md text-sm leading-relaxed text-on-surface-variant">
              {scan.status === "completed"
                ? "Risk assessment from the latest scan. Address critical and high findings first."
                : "A scan is currently in progress. The risk assessment updates once analysis completes."}
            </p>
          </div>
          <div className="relative z-10 flex items-end justify-between">
            <div className="flex items-baseline gap-4">
              <span className="text-6xl font-bold tracking-tighter text-on-surface">
                {healthScore ?? "—"}
                <span className="ml-1 text-2xl text-outline">/100</span>
              </span>
              <div className="flex flex-col">
                <span className={cn("text-lg leading-none font-bold", riskTextClass)}>
                  {riskLabel ? SEVERITY_LABELS[riskLabel as Severity] : "NO DATA"}
                </span>
                <span className="mt-1 text-xs text-on-surface-variant">
                  {scan.findings_count} findings
                </span>
              </div>
            </div>
            <Link
              href={`/projects?project=${currentProject.id}`}
              className="btn-glow flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary-container"
            >
              <span>Open Project</span>
              <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
            </Link>
          </div>
        </div>

        {/* Severity summary */}
        <div className="flex flex-col rounded-xl border border-outline-variant bg-surface-container p-6">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-sm font-bold tracking-wider text-on-surface uppercase">
              Severity Summary
            </h4>
            <Info className="h-4 w-4 cursor-help text-outline" />
          </div>
          <div className="flex flex-1 flex-col gap-4">
            {(["critical", "high", "medium", "low", "info"] as Severity[]).map((sev) => {
              const count = severityCounts?.[sev] ?? 0;
              const max = severityCounts
                ? Math.max(...(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => severityCounts?.[s] ?? 0), 1)
                : 1;
              return (
                <div key={sev} className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className={SEVERITY_TEXT_CLASSES[sev]}>{SEVERITY_LABELS[sev]}</span>
                    <span className="text-on-surface">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-dim">
                    <div
                      className={cn("h-full rounded-full transition-all", SEVERITY_BAR_CLASSES[sev], sev === "critical" && "glow-primary")}
                      style={{ width: `${Math.max((count / max) * 100, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coverage tiles */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CoverageTile
          icon={FileText}
          iconClass="text-primary"
          label="Source Code"
          value={scan.findings_count}
          sub="Findings"
        />
        <CoverageTile
          icon={Package}
          iconClass="text-secondary"
          label="Dependencies"
          value={countByCategory(findings, "dependency")}
          sub="Checked"
        />
        <CoverageTile
          icon={KeyRound}
          iconClass="text-tertiary"
          label="Secrets"
          value={countByCategory(findings, "secrets")}
          sub="Detected"
        />
      </div>

      {/* Recent findings + scan info */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container xl:col-span-3">
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high/30 p-5">
            <h4 className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <History className="h-[18px] w-[18px] text-primary" />
              Recent Findings
            </h4>
            <Link href={`/scan?scan=${scan.id}`} className="text-xs font-bold text-primary hover:underline">
              View Scan Results
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-dim/50 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
                <tr>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Finding</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Rule</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {findings?.items.slice(0, 5).map((finding) => (
                  <FindingRow key={finding.id} finding={finding} scanId={scan.id} />
                ))}
                {(!findings || findings.items.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                      {scan.status === "running" ? "Scan in progress…" : "No findings in the latest scan."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latest scan info */}
        <div className="flex flex-col gap-6 rounded-xl border border-outline-variant bg-surface-container p-6">
          <h4 className="text-sm font-bold tracking-wider text-on-surface uppercase">Latest Scan</h4>
          <div className="space-y-6">
            <ScanInfo icon={FileText} iconClass="text-primary" label="Scan ID" value={`#${scan.id}`} />
            <ScanInfo icon={Database} iconClass="text-secondary" label="Status" value={scan.status} />
            <ScanInfo
              icon={Timer}
              iconClass="text-tertiary"
              label="Duration"
              value={formatDuration(scan.started_at, scan.completed_at)}
            />
            <ScanInfo icon={History} iconClass="text-on-surface-variant" label="Started" value={formatDate(scan.started_at ?? scan.created_at)} />
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-on-surface-variant">
            <TrendingUp className="h-4 w-4 text-error" />
            Risk model: {assessment?.algorithm ?? "pending"}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverageTile({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container p-5">
      <div className="flex size-12 items-center justify-center rounded-lg bg-surface-bright">
        <Icon className={cn("h-7 w-7", iconClass)} />
      </div>
      <div>
        <p className="text-xs font-bold tracking-tight text-on-surface-variant uppercase">{label}</p>
        <h5 className="text-xl font-bold text-on-surface">
          {value}
          <span className="ml-1 text-xs font-normal text-on-surface-variant">{sub}</span>
        </h5>
      </div>
    </div>
  );
}

function ScanInfo({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-10 items-center justify-center rounded bg-surface-bright">
        <Icon className={cn("h-5 w-5", iconClass)} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-on-surface-variant">{label}</span>
        <span className="font-code text-sm font-medium text-on-surface">{value}</span>
      </div>
    </div>
  );
}

function FindingRow({ finding, scanId }: { finding: Finding; scanId: number }) {
  return (
    <tr className="transition-colors hover:bg-surface-bright/20">
      <td className="px-6 py-4">
        <span className={cn("flex items-center gap-1.5 font-bold", SEVERITY_TEXT_CLASSES[finding.severity])}>
          <span
            className={cn(
              "size-2 rounded-full",
              SEVERITY_DOT_CLASSES[finding.severity],
              finding.severity === "critical" && "animate-pulse"
            )}
          />
          {SEVERITY_LABELS[finding.severity]}
        </span>
      </td>
      <td className="px-6 py-4">
        <Link
          href={`/finding?scan=${scanId}&id=${finding.id}`}
          className="font-semibold text-on-surface hover:text-primary"
        >
          {finding.title}
        </Link>
        {finding.remediation && (
          <p className="mt-0.5 line-clamp-1 text-xs text-emerald-400/90">{finding.remediation}</p>
        )}
      </td>
      <td className="px-6 py-4 font-code text-xs text-on-surface-variant">
        {formatLine(finding)}
      </td>
      <td className="px-6 py-4">
        <span className="rounded border border-outline-variant bg-surface-container px-2 py-0.5 font-code text-[10px] font-bold text-on-surface-variant">
          {finding.rule_id ?? finding.analyzer}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <MoreVertical className="ml-auto h-5 w-5 text-outline hover:text-on-surface" />
      </td>
    </tr>
  );
}

function computeSeverityCounts(
  assessment: RiskAssessment | null,
  scan: Scan
): Record<Severity, number> | null {
  if (assessment?.breakdown?.severity_counts) {
    return assessment.breakdown.severity_counts;
  }
  const byCategory = (scan.correlation as { by_category?: Record<string, number> } | null)?.by_category;
  if (byCategory) {
    const mapped: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
    // correlation buckets don't carry severity; approximate from scan aggregate
    return mapped;
  }
  return null;
}

function countByCategory(findings: FindingsPage | null, category: string): number {
  if (!findings) return 0;
  return findings.items.filter((f) => f.category === category).length;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}