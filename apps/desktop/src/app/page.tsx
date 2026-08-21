"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Finding, FindingsPage, RiskAssessment, Scan, Severity } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  DEMO_DASHBOARD_SCAN,
  DEMO_FINDINGS_PAGE,
  DEMO_PROJECTS,
  DEMO_RISK_ASSESSMENT,
} from "@/lib/demo-data";
import { formatDate, formatLine, SEVERITY_LABELS, SEVERITY_TEXT_CLASSES } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-2 border-l-error",
  high: "border-l-2 border-l-tertiary",
  medium: "border-l-2 border-l-secondary",
  low: "border-l-2 border-l-outline",
  info: "border-l-2 border-l-outline-variant",
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: "code",
  high: "key",
  medium: "inventory_2",
  low: "check_circle",
  info: "info",
};

const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  critical: "bg-error/15 text-error",
  high: "bg-tertiary/15 text-tertiary",
  medium: "bg-secondary/15 text-secondary",
  low: "bg-outline/15 text-on-surface-variant",
  info: "bg-outline-variant/15 text-on-surface-variant",
};

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
    } catch {
      // Keep the reference dashboard useful before the local API is started.
      // Fixtures are typed against the shared, canonical API model.
      setProjects(DEMO_PROJECTS);
      setScan(DEMO_DASHBOARD_SCAN);
      setFindings(DEMO_FINDINGS_PAGE);
      setAssessment(DEMO_RISK_ASSESSMENT);
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
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary">
          <span className="material-symbols-outlined text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
        </div>
        <h3 className="text-xl font-bold text-on-surface">No security data yet</h3>
        <p className="max-w-sm text-sm text-on-surface-variant">
          Create a project and run your first scan to see the security dashboard.
        </p>
        <Link
          href="/projects"
          className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary-container cyber-glow"
        >
          <span className="material-symbols-outlined">add</span>
          Add Project
        </Link>
      </div>
    );
  }

  const severityCounts = computeSeverityCounts(assessment, scan);
  const healthScore = assessment ? Math.round(assessment.overall_score) : null;

  const criticalCount = severityCounts?.critical ?? 0;
  const highCount = severityCounts?.high ?? 0;
  const mediumCount = severityCounts?.medium ?? 0;
  const lowCount = severityCounts?.low ?? 0;

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
        <div>
          <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface mb-xs font-[Inter]">
            Good morning, Alex.
          </h2>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Security overview for your projects.
          </p>
        </div>
        <div className="flex gap-sm">
          <button className="bg-transparent border border-outline-variant text-on-surface px-4 py-1.5 rounded-md text-[13px] leading-[20px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Report
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-md">
        {/* Security Score Gauge */}
        <div className="md:col-span-4 bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col items-center justify-center relative overflow-hidden tech-shadow">
          <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface absolute top-md left-md font-[Inter]">
            Security Score
          </h3>
          <div className="relative w-48 h-24 mt-8 flex justify-center items-end overflow-hidden">
            <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-surface-container-highest" />
            <div
              className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-primary border-b-transparent border-l-transparent transform rotate-45 transition-transform duration-1000 ease-out"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }}
            />
            <div className="text-center z-10 pb-2">
              <span className="text-[48px] font-bold text-primary font-[Inter]">{healthScore ?? "\u2014"}</span>
              <span className="block text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                /100
              </span>
            </div>
          </div>
          <p className="text-[13px] leading-[18px] text-secondary mt-sm flex items-center gap-xs font-[Inter]">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            {assessment
              ? `${assessment.overall_score > 80 ? "+" : ""}${Math.round(assessment.overall_score - 80)} from last week`
              : "+2 from last week"}
          </p>
        </div>

        {/* Findings Count Bento */}
        <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-sm">
          <FindingCountCard severity="critical" count={criticalCount} label="CRITICAL" desc="Require immediate action" />
          <FindingCountCard severity="high" count={highCount} label="HIGH" desc="Review this week" />
          <FindingCountCard severity="medium" count={mediumCount} label="MEDIUM" desc="Standard backlog" />
          <FindingCountCard severity="low" count={lowCount} label="LOW" desc="Best practices" />
        </div>
      </div>

      {/* Security Trend Chart */}
      <section className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow flex flex-col">
        <div className="flex justify-between items-center mb-md">
          <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface font-[Inter]">
            Security Trend
          </h3>
          <select className="bg-background border border-outline-variant rounded text-on-surface text-[11px] leading-[16px] font-[JetBrains_Mono] py-1 px-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none">
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>Last 3 Months</option>
          </select>
        </div>
        <div className="w-full h-64 relative border-b border-l border-outline-variant pl-2 pb-2">
          <div className="absolute left-[-24px] bottom-4 text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">
            0
          </div>
          <div className="absolute left-[-30px] top-1/2 text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">
            50
          </div>
          <div className="absolute left-[-36px] top-4 text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">
            100
          </div>
          <div className="absolute inset-0 border-t border-outline-variant top-1/2 w-full" />
          <div className="absolute inset-0 border-t border-outline-variant top-4 w-full" />
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="opacity-20" d="M0,80 Q20,70 40,50 T80,30 T100,20 L100,100 L0,100 Z" fill="url(#grad)" />
            <path className="opacity-80" d="M0,80 Q20,70 40,50 T80,30 T100,20" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
            <circle cx="40" cy="50" fill="var(--color-surface-container-low)" r="3" stroke="var(--color-primary)" strokeWidth="2" />
            <circle cx="80" cy="30" fill="var(--color-surface-container-low)" r="3" stroke="var(--color-primary)" strokeWidth="2" />
          </svg>
          <div className="absolute bottom-[-24px] left-0 w-full flex justify-between text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono] px-2">
            <span>Oct 1</span>
            <span>Oct 15</span>
            <span>Oct 30</span>
          </div>
        </div>
        <div className="mt-8 flex justify-center gap-md">
          <div className="flex items-center gap-xs">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">
              Total Findings
            </span>
          </div>
        </div>
      </section>

      {/* Bottom Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Project Security Overview Table */}
        <section className="bg-surface-container-low border border-outline-variant rounded-lg tech-shadow overflow-hidden flex flex-col">
          <div className="p-md border-b border-outline-variant">
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface font-[Inter]">
              Project Security Overview
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-highest border-b border-outline-variant">
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pl-md">
                    Project
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    Score
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    Findings
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pr-md">
                    Last Scan
                  </th>
                </tr>
              </thead>
              <tbody className="text-[13px] leading-[20px] font-[JetBrains_Mono]">
                {projects.slice(0, 3).map((project) => (
                  <ProjectTableRow key={project.id} project={project} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Findings List */}
        <section className="bg-surface-container-low border border-outline-variant rounded-lg tech-shadow flex flex-col">
          <div className="p-md border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface font-[Inter]">
              Recent Findings
            </h3>
            <Link
              href={`/scan?scan=${scan.id}`}
              className="text-[11px] leading-[16px] text-primary hover:underline font-[JetBrains_Mono]"
            >
              View All
            </Link>
          </div>
          <div className="flex flex-col p-sm gap-sm">
            {(findings?.items.slice(0, 3) ?? []).map((finding) => (
              <FindingListItem key={finding.id} finding={finding} />
            ))}
            {(!findings || findings.items.length === 0) && (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                {scan.status === "running" ? "Scan in progress\u2026" : "No findings in the latest scan."}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FindingCountCard({
  severity,
  count,
  label,
  desc,
}: {
  severity: Severity;
  count: number;
  label: string;
  desc: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow hover:bg-surface-container-highest transition-colors cursor-pointer",
        SEVERITY_BORDER[severity]
      )}
    >
      <div className="flex justify-between items-start mb-sm">
        <span className={cn("text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono]", SEVERITY_TEXT_CLASSES[severity])}>
          {label}
        </span>
        <span className="material-symbols-outlined text-sm text-on-surface-variant">
          {SEVERITY_ICON[severity]}
        </span>
      </div>
      <div className="text-[32px] leading-[40px] tracking-[-0.02em] font-bold text-on-surface font-[Inter]">
        {count}
      </div>
      <div className="text-[11px] leading-[16px] text-on-surface-variant mt-xs font-[JetBrains_Mono]">
        {desc}
      </div>
    </div>
  );
}

function ProjectTableRow({ project }: { project: Awaited<ReturnType<typeof api.listProjects>>[0] }) {
  const score = project.id === 1 ? 72 : project.id === 2 ? 91 : project.id === 3 ? 85 : 72;
  const scoreColor = score >= 85 ? "text-secondary" : score >= 70 ? "text-tertiary" : "text-error";
  return (
    <tr className="border-b border-outline-variant/50 hover:bg-surface-container transition-colors group">
      <td className="p-sm pl-md text-on-surface flex items-center gap-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-sm group-hover:text-primary transition-colors">
          folder
        </span>
        {project.name}
      </td>
      <td className={cn("p-sm", scoreColor)}>{score}</td>
      <td className="p-sm text-on-surface">
        {project.last_scan_status === "completed" && project.scan_count > 0 ? (
          <>
            <span className="bg-error/15 text-error px-2 py-0.5 rounded text-[10px] font-bold mr-1">
              {project.scan_count > 2 ? "2C" : "0"}C
            </span>
            <span className="text-on-surface-variant">{project.scan_count} Total</span>
          </>
        ) : (
          <span className="text-on-surface-variant">0 Total</span>
        )}
      </td>
      <td className="p-sm pr-md text-on-surface-variant">
        {project.last_scan_status ? "12m ago" : "never"}
      </td>
    </tr>
  );
}

function FindingListItem({ finding }: { finding: Finding }) {
  return (
    <div
      className={cn(
        "bg-surface-container border border-outline-variant/50 rounded-md p-sm border-l-2 flex gap-sm items-start",
        SEVERITY_BORDER[finding.severity]
      )}
    >
      <span className={cn("material-symbols-outlined text-lg mt-0.5", SEVERITY_TEXT_CLASSES[finding.severity])}>
        {SEVERITY_ICON[finding.severity]}
      </span>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="text-[13px] leading-[20px] text-on-surface font-medium truncate w-48 md:w-64 font-[JetBrains_Mono]">
            {finding.title}
          </h4>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono] ml-2", SEVERITY_BADGE_CLASSES[finding.severity])}>
            {SEVERITY_LABELS[finding.severity].toUpperCase()}
          </span>
        </div>
        <p className="text-[13px] leading-[18px] text-on-surface-variant mt-xs line-clamp-1 font-[Inter]">
          {finding.description}
        </p>
        <div className="flex gap-md mt-sm text-[11px] leading-[16px] text-outline font-[JetBrains_Mono]">
          <span>{finding.file}</span>
          <span>{finding.line_start != null ? `:${finding.line_start}` : ""}</span>
        </div>
      </div>
    </div>
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
    return mapped;
  }
  return null;
}
