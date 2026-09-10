"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Finding, FindingsPage, RiskAssessment, Scan, Severity } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
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
  critical: "bg-error/15 text-error ring-1 ring-error/30",
  high: "bg-tertiary/15 text-tertiary ring-1 ring-tertiary/30",
  medium: "bg-secondary/15 text-secondary ring-1 ring-secondary/30",
  low: "bg-outline/15 text-on-surface-variant ring-1 ring-outline/30",
  info: "bg-outline-variant/15 text-on-surface-variant ring-1 ring-outline-variant/30",
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
      setProjects([]);
      setScan(null);
      setFindings(null);
      setAssessment(null);
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
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 cyber-glow">
          <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
        </div>
        <h3 className="text-2xl font-bold text-on-surface">No security data yet</h3>
        <p className="max-w-md text-base text-on-surface-variant">
          Create a project and run your first scan to see the security dashboard.
        </p>
        <Link
          href="/projects"
          className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary-container hover:scale-105 cyber-glow"
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
  
  // Dynamic color for score gauge
  const scoreColorClass = healthScore === null ? "text-primary" : healthScore >= 85 ? "text-secondary" : healthScore >= 70 ? "text-tertiary" : "text-error";
  const strokeColorClass = healthScore === null ? "stroke-primary" : healthScore >= 85 ? "stroke-secondary" : healthScore >= 70 ? "stroke-tertiary" : "stroke-error";

  return (
    <div className="max-w-[1440px] mx-auto space-y-xl pb-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
        <div>
          <h2 className="text-3xl leading-tight tracking-tight font-bold text-on-surface mb-1 font-[Inter]">
            Security Overview
          </h2>
          <p className="text-base text-on-surface-variant font-[Inter]">
            Live posture for <span className="text-on-surface font-semibold">{currentProject.name}</span>
          </p>
        </div>
        <div className="flex gap-sm">
          <Link
            href={`/scan?scan=${scan.id}`}
            className="group bg-surface border border-outline-variant hover:border-primary/50 text-on-surface px-5 py-2.5 rounded-lg text-sm font-[JetBrains_Mono] hover:bg-surface-container-highest transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-[0_0_15px_rgba(208,188,255,0.15)]"
          >
            <span className="material-symbols-outlined text-base group-hover:text-primary transition-colors">radar</span>
            View Scan Details
          </Link>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Security Score Gauge */}
        <div className="lg:col-span-4 bg-gradient-to-br from-surface-container-low to-surface border border-outline-variant/60 rounded-xl p-lg flex flex-col items-center justify-center relative overflow-hidden tech-shadow group hover:border-outline-variant transition-colors">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <h3 className="text-lg font-semibold text-on-surface absolute top-6 left-6 font-[Inter]">
            Security Score
          </h3>
          
          <div className="relative mt-8 mb-4">
            <svg viewBox="0 0 100 50" className="w-56 h-28 overflow-visible">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="var(--color-surface-container-highest)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                className={cn("transition-all duration-1000 ease-out", healthScore === null ? "stroke-primary" : "")}
                stroke={healthScore === null ? undefined : healthScore >= 85 ? "var(--color-secondary)" : healthScore >= 70 ? "var(--color-tertiary)" : "var(--color-error)"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 - (125.6 * (healthScore ?? 0)) / 100}
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center justify-end h-full pb-1">
              <div className="flex items-baseline gap-1">
                <span className={cn("text-5xl font-bold font-[Inter]", healthScore === null ? "text-primary" : healthScore >= 85 ? "text-secondary" : healthScore >= 70 ? "text-tertiary" : "text-error")}>
                  {healthScore ?? "\u2014"}
                </span>
              </div>
              <span className="text-xs font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-widest mt-1">
                /100
              </span>
            </div>
          </div>
          
          <p className="text-sm text-on-surface-variant mt-2 flex items-center gap-1.5 font-[Inter] bg-surface-container-highest/50 px-3 py-1.5 rounded-full">
            <span className={cn("material-symbols-outlined text-sm", healthScore === null ? "text-primary" : healthScore >= 85 ? "text-secondary" : healthScore >= 70 ? "text-tertiary" : "text-error")}>verified</span>
            {assessment
              ? <span className="font-medium text-on-surface">Level: {assessment.overall_level.toUpperCase()}</span>
              : "Score evaluated locally"}
          </p>
        </div>

        {/* Findings Count Bento */}
        <div className="lg:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FindingCountCard severity="critical" count={criticalCount} label="CRITICAL" desc="Require immediate action" />
          <FindingCountCard severity="high" count={highCount} label="HIGH" desc="Review this week" />
          <FindingCountCard severity="medium" count={mediumCount} label="MEDIUM" desc="Standard backlog" />
          <FindingCountCard severity="low" count={lowCount} label="LOW" desc="Best practices" />
        </div>
      </div>

      {/* Security Trend Chart */}
      <section className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-lg tech-shadow flex flex-col group hover:border-outline-variant transition-colors relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-on-surface font-[Inter] flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">monitoring</span>
            Security Trend
          </h3>
          <select className="bg-surface border border-outline-variant/50 rounded-md text-on-surface text-xs font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none hover:bg-surface-container transition-colors cursor-pointer shadow-sm">
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>Last 3 Months</option>
          </select>
        </div>
        <div className="w-full h-64 relative border-b border-l border-outline-variant/40 pl-3 pb-3 mt-4">
          <div className="absolute left-[-28px] bottom-3 text-[10px] text-on-surface-variant font-[JetBrains_Mono]">
            0
          </div>
          <div className="absolute left-[-32px] top-[48%] text-[10px] text-on-surface-variant font-[JetBrains_Mono]">
            50
          </div>
          <div className="absolute left-[-38px] top-3 text-[10px] text-on-surface-variant font-[JetBrains_Mono]">
            100
          </div>
          
          <div className="absolute inset-0 border-t border-outline-variant/20 top-1/2 w-full border-dashed" />
          <div className="absolute inset-0 border-t border-outline-variant/20 top-4 w-full border-dashed" />
          
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="trend-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path className="transition-all duration-1000" d="M0,80 Q20,70 40,50 T80,30 T100,20 L100,100 L0,100 Z" fill="url(#trend-grad)" />
            <path className="transition-all duration-1000" d="M0,80 Q20,70 40,50 T80,30 T100,20" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" filter="url(#glow)" />
            <circle cx="40" cy="50" fill="var(--color-surface)" r="4" stroke="var(--color-primary)" strokeWidth="2.5" className="hover:r-5 transition-all cursor-pointer" />
            <circle cx="80" cy="30" fill="var(--color-surface)" r="4" stroke="var(--color-primary)" strokeWidth="2.5" className="hover:r-5 transition-all cursor-pointer" />
          </svg>
          
          <div className="absolute bottom-[-28px] left-0 w-full flex justify-between text-[10px] text-on-surface-variant font-[JetBrains_Mono] px-2">
            <span>Oct 1</span>
            <span>Oct 15</span>
            <span>Oct 30</span>
          </div>
        </div>
        <div className="mt-10 flex justify-center gap-6">
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/30">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-on-surface font-[JetBrains_Mono]">
              Total Findings
            </span>
          </div>
        </div>
      </section>

      {/* Bottom Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg">
        {/* Project Security Overview Table */}
        <section className="bg-surface-container-low border border-outline-variant/60 rounded-xl tech-shadow overflow-hidden flex flex-col group hover:border-outline-variant transition-colors">
          <div className="p-5 border-b border-outline-variant/50 bg-surface-container-highest/20">
            <h3 className="text-lg font-semibold text-on-surface font-[Inter] flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">folder_open</span>
              Project Security Overview
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container/50 border-b border-outline-variant/50">
                  <th className="py-3 px-4 text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-wider uppercase pl-5">
                    Project
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-wider uppercase">
                    Score
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-wider uppercase">
                    Findings
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-wider uppercase pr-5">
                    Last Scan
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm font-[JetBrains_Mono]">
                {projects.slice(0, 4).map((project) => (
                  <ProjectTableRow key={project.id} project={project} />
                ))}
              </tbody>
            </table>
          </div>
          {projects.length > 4 && (
             <div className="p-3 border-t border-outline-variant/30 bg-surface/30 text-center">
                <Link href="/projects" className="text-xs text-primary hover:text-primary-container font-[JetBrains_Mono] hover:underline transition-all">
                  View all {projects.length} projects &rarr;
                </Link>
             </div>
          )}
        </section>

        {/* Recent Findings List */}
        <section className="bg-surface-container-low border border-outline-variant/60 rounded-xl tech-shadow flex flex-col group hover:border-outline-variant transition-colors">
          <div className="p-5 border-b border-outline-variant/50 flex justify-between items-center bg-surface-container-highest/20">
            <h3 className="text-lg font-semibold text-on-surface font-[Inter] flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">bug_report</span>
              Recent Findings
            </h3>
            <Link
              href={`/scan?scan=${scan.id}`}
              className="text-xs text-primary hover:text-primary-container font-[JetBrains_Mono] hover:underline transition-all flex items-center gap-1"
            >
              View All <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>
          <div className="flex flex-col p-4 gap-3">
            {(findings?.items.slice(0, 3) ?? []).map((finding) => (
              <FindingListItem key={finding.id} finding={finding} />
            ))}
            {(!findings || findings.items.length === 0) && (
              <div className="py-12 flex flex-col items-center justify-center text-center text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">check_circle</span>
                {scan.status === "running" ? "Scan in progress\u2026" : "No findings in the latest scan! Great job."}
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
        "bg-gradient-to-b from-surface-container-low to-surface border border-outline-variant/50 rounded-xl p-5 tech-shadow hover:bg-surface-container transition-all duration-300 cursor-pointer relative overflow-hidden group",
      )}
    >
      <div className={cn("absolute top-0 left-0 w-full h-1", SEVERITY_BADGE_CLASSES[severity].split(' ')[0])} />
      <div className={cn("absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 blur-xl group-hover:opacity-20 transition-opacity", SEVERITY_BADGE_CLASSES[severity].split(' ')[0])} />
      
      <div className="flex justify-between items-start mb-3 relative z-10">
        <span className={cn("text-xs font-bold font-[JetBrains_Mono] tracking-wider", SEVERITY_TEXT_CLASSES[severity])}>
          {label}
        </span>
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", SEVERITY_BADGE_CLASSES[severity])}>
          <span className="material-symbols-outlined text-sm">
            {SEVERITY_ICON[severity]}
          </span>
        </div>
      </div>
      <div className="text-4xl font-bold text-on-surface font-[Inter] mb-1 relative z-10 group-hover:scale-105 transition-transform origin-left">
        {count}
      </div>
      <div className="text-xs text-on-surface-variant font-[JetBrains_Mono] relative z-10 opacity-80">
        {desc}
      </div>
    </div>
  );
}

function ProjectTableRow({ project }: { project: Awaited<ReturnType<typeof api.listProjects>>[0] }) {
  const router = useRouter();
  const score = project.last_scan_score !== null ? Math.round(project.last_scan_score) : "—";
  const scoreColor = project.last_scan_score && project.last_scan_score >= 85 ? "text-secondary" : project.last_scan_score && project.last_scan_score >= 70 ? "text-tertiary" : "text-error";
  return (
    <tr 
      onClick={() => router.push(`/projects?project=${project.id}`)}
      className="cursor-pointer border-b border-outline-variant/30 hover:bg-surface-container transition-colors group"
    >
      <td className="py-3 px-4 pl-5 text-on-surface flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-outline-variant/50 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all">
          <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:text-primary transition-colors">
            folder
          </span>
        </div>
        <span className="font-medium">{project.name}</span>
      </td>
      <td className={cn("py-3 px-4 font-bold", scoreColor)}>{score}</td>
      <td className="py-3 px-4 text-on-surface">
        {project.last_scan_status === "completed" && project.last_scan_findings_count !== null ? (
          <span className="bg-surface border border-outline-variant/50 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1.5 shadow-sm">
             <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
            {project.last_scan_findings_count}
          </span>
        ) : (
          <span className="text-on-surface-variant text-xs flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-outline-variant" /> 0</span>
        )}
      </td>
      <td className="py-3 px-4 pr-5 text-on-surface-variant uppercase text-[10px] tracking-wider">
        {project.last_scan_status ? (
           <span className="flex items-center gap-1">
             <span className="material-symbols-outlined text-[14px]">history</span>
             {project.last_scan_status}
           </span>
        ) : "never"}
      </td>
    </tr>
  );
}

function FindingListItem({ finding }: { finding: Finding }) {
  return (
    <div
      className={cn(
        "bg-surface border border-outline-variant/40 rounded-lg p-3.5 flex gap-3.5 items-start hover:bg-surface-container-low transition-colors cursor-pointer group shadow-sm",
        SEVERITY_BORDER[finding.severity]
      )}
    >
      <div className={cn("w-8 h-8 rounded-md shrink-0 flex items-center justify-center mt-0.5", SEVERITY_BADGE_CLASSES[finding.severity])}>
        <span className={cn("material-symbols-outlined text-base", SEVERITY_TEXT_CLASSES[finding.severity])}>
          {SEVERITY_ICON[finding.severity]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-sm text-on-surface font-medium truncate font-[JetBrains_Mono] group-hover:text-primary transition-colors">
            {finding.title}
          </h4>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] shrink-0 tracking-widest", SEVERITY_BADGE_CLASSES[finding.severity])}>
            {SEVERITY_LABELS[finding.severity].toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-1 font-[Inter]">
          {finding.description}
        </p>
        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-outline font-[JetBrains_Mono] bg-background/50 py-1 px-2 rounded w-fit border border-outline-variant/30">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">description</span>{finding.file}</span>
          {finding.line_start != null && (
             <span className="flex items-center gap-1 text-on-surface-variant/70"><span className="material-symbols-outlined text-[12px]">numbers</span>{finding.line_start}</span>
          )}
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
