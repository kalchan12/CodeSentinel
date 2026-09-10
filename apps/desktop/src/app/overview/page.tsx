"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Finding, FindingsPage, Project, RiskAssessment, Scan, Severity } from "@codesentinel/shared";

import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewScanDialog } from "@/components/new-scan-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { SEVERITY_LABELS, SEVERITY_TEXT_CLASSES } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-2 border-l-error",
  high: "border-l-2 border-l-tertiary",
  medium: "border-l-2 border-l-secondary",
  low: "border-l-2 border-l-outline",
  info: "border-l-2 border-l-outline-variant",
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: "dangerous",
  high: "warning",
  medium: "report",
  low: "info",
  info: "help",
};

const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  critical: "bg-error/15 text-error ring-1 ring-error/30",
  high: "bg-tertiary/15 text-tertiary ring-1 ring-tertiary/30",
  medium: "bg-secondary/15 text-secondary ring-1 ring-secondary/30",
  low: "bg-outline/15 text-on-surface-variant ring-1 ring-outline/30",
  info: "bg-outline-variant/15 text-on-surface-variant ring-1 ring-outline-variant/30",
};

export default function OverviewDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [scanningProjectId, setScanningProjectId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);

      // Find the project with the most recent scan
      const scannedProjects = projectList.filter((p) => p.last_scan_id != null);
      if (scannedProjects.length > 0) {
        const target = scannedProjects[0];
        if (target.last_scan_id) {
          const [scanData, findingsData, assessmentData] = await Promise.all([
            api.getScan(target.last_scan_id).catch(() => null),
            api.getFindings(target.last_scan_id, {}).catch(() => null),
            api.getAssessment(target.last_scan_id).catch(() => null),
          ]);
          setLatestScan(scanData);
          setFindings(findingsData);
          setAssessment(assessmentData);
        }
      } else {
        setLatestScan(null);
        setFindings(null);
        setAssessment(null);
      }
    } catch {
      setProjects([]);
      setLatestScan(null);
      setFindings(null);
      setAssessment(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleQuickScan(project: Project) {
    setScanningProjectId(project.id);
    try {
      const scan = await api.createScan(project.id);
      toast.success(`Scan #${scan.id} started for ${project.name}`);
      router.push(`/scan?scan=${scan.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to initiate scan");
    } finally {
      setScanningProjectId(null);
    }
  }

  if (projects === null) {
    return (
      <div className="max-w-[1440px] mx-auto space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // Calculate workspace-level aggregate metrics
  const totalProjects = projects.length;
  const localProjects = projects.filter((p) => p.source_type === "local").length;
  const githubProjects = projects.filter((p) => p.source_type === "github").length;
  const totalScans = projects.reduce((acc, p) => acc + p.scan_count, 0);
  const totalFindings = projects.reduce((acc, p) => acc + (p.last_scan_findings_count ?? 0), 0);

  // Compute average score across scanned projects
  const scoredProjects = projects.filter((p) => p.last_scan_score !== null);
  const averageScore =
    scoredProjects.length > 0
      ? Math.round(scoredProjects.reduce((acc, p) => acc + (p.last_scan_score ?? 0), 0) / scoredProjects.length)
      : assessment
        ? Math.round(assessment.overall_score)
        : null;

  // Severity counts from latest assessment or estimated from total findings
  const severityCounts = assessment?.breakdown?.severity_counts ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  // If literally 0 projects in workspace, show onboarding state
  if (totalProjects === 0) {
    return (
      <div className="max-w-[1440px] mx-auto flex min-h-[75vh] items-center justify-center p-4">
        <div className="relative w-full max-w-[620px] rounded-2xl border border-outline-variant bg-surface-container-low p-8 text-center tech-shadow cyber-glow overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-secondary/10 blur-3xl" />

          <div className="relative mx-auto mb-5 flex size-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_25px_rgba(208,188,255,0.2)]">
            <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              security
            </span>
            <div className="absolute -top-1 -right-1 size-3 rounded-full bg-secondary animate-ping" />
            <div className="absolute -top-1 -right-1 size-3 rounded-full bg-secondary" />
          </div>

          <h3 className="mb-2 text-2xl font-bold tracking-tight text-on-surface font-[Inter]">
            Welcome to CodeSentinel
          </h3>
          <p className="mx-auto mb-6 max-w-[460px] text-sm leading-relaxed text-on-surface-variant font-[Inter]">
            Local-First Secure Source Code Analysis & Risk Assessment. Start by registering a local directory on this machine or a remote GitHub repository.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 relative z-10">
            <NewProjectDialog
              onCreated={load}
              trigger={
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-all duration-200 hover:bg-primary/90 hover:scale-[1.02] shadow-[0_0_15px_rgba(208,188,255,0.25)] cursor-pointer">
                  <span className="material-symbols-outlined text-lg">add</span>
                  Add First Project
                </button>
              }
            />
            <Link
              href="/analyzer-status"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high px-6 py-3 text-sm font-semibold text-on-surface transition-all duration-200 hover:border-primary/50"
            >
              <span className="material-symbols-outlined text-lg text-secondary">monitor_heart</span>
              Check Analyzers
            </Link>
          </div>

          <div className="border-t border-outline-variant/60 pt-5">
            <h4 className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider mb-3">
              Included Security Engines
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-[JetBrains_Mono] text-on-surface">
              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">code</span>
                <span>Semgrep SAST</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-base">key</span>
                <span>Gitleaks Secrets</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">inventory_2</span>
                <span>OSV Dependencies</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface font-[Inter]">
              Security Command Center
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-secondary/10 text-secondary border border-secondary/30">
              Workspace Live
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-[Inter]">
            Aggregated security posture, threat intelligence, and project inventory across your local workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <NewScanDialog
            trigger={
              <button className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-lg text-xs font-semibold font-[JetBrains_Mono] flex items-center gap-1.5 shadow-[0_0_12px_rgba(208,188,255,0.2)] transition-all cursor-pointer hover:scale-[1.02]">
                <span className="material-symbols-outlined text-base">radar</span>
                Run Scan
              </button>
            }
          />
          <NewProjectDialog
            onCreated={load}
            trigger={
              <button className="bg-surface-container border border-outline-variant hover:border-primary/50 text-on-surface px-4 py-2 rounded-lg text-xs font-semibold font-[JetBrains_Mono] flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-base text-primary">add</span>
                Add Target
              </button>
            }
          />
          <Link
            href="/reports"
            className="bg-transparent border border-outline-variant hover:border-outline text-on-surface px-3.5 py-2 rounded-lg text-xs font-semibold font-[JetBrains_Mono] flex items-center gap-1.5 transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-base text-secondary">assessment</span>
            Reports
          </Link>
        </div>
      </header>

      {/* Workspace At-A-Glance Bento Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Monitored Projects */}
        <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 tech-shadow relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Targets Monitored
            </span>
            <span className="material-symbols-outlined text-primary text-xl">folder_open</span>
          </div>
          <div className="text-3xl font-bold text-on-surface font-[Inter] mb-1">
            {totalProjects}
          </div>
          <div className="text-[11px] text-on-surface-variant font-[JetBrains_Mono] flex items-center gap-2">
            <span>{localProjects} local</span>
            <span>·</span>
            <span>{githubProjects} GitHub</span>
          </div>
        </div>

        {/* Completed Scans */}
        <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 tech-shadow relative overflow-hidden group hover:border-secondary/40 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Scans Conducted
            </span>
            <span className="material-symbols-outlined text-secondary text-xl">radar</span>
          </div>
          <div className="text-3xl font-bold text-on-surface font-[Inter] mb-1">
            {totalScans}
          </div>
          <div className="text-[11px] text-on-surface-variant font-[JetBrains_Mono]">
            {scoredProjects.length} active target{scoredProjects.length === 1 ? "" : "s"} evaluated
          </div>
        </div>

        {/* Total Findings */}
        <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 tech-shadow relative overflow-hidden group hover:border-error/40 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Active Findings
            </span>
            <span className="material-symbols-outlined text-error text-xl">security</span>
          </div>
          <div className="text-3xl font-bold text-on-surface font-[Inter] mb-1">
            {totalFindings}
          </div>
          <div className="text-[11px] text-on-surface-variant font-[JetBrains_Mono]">
            Across all scanned repositories
          </div>
        </div>

        {/* Engine Status */}
        <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 tech-shadow relative overflow-hidden group hover:border-secondary/40 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Security Engine
            </span>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-[10px] text-secondary font-[JetBrains_Mono] font-bold">READY</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-secondary font-[Inter] mb-1">
            Local-First
          </div>
          <div className="text-[11px] text-on-surface-variant font-[JetBrains_Mono] truncate">
            Semgrep · Gitleaks · OSV
          </div>
        </div>
      </div>

      {/* Posture Gauge & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Security Health Score Gauge (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant/60 rounded-xl p-6 tech-shadow flex flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex justify-between items-center mb-2">
            <h3 className="text-base font-semibold text-on-surface font-[Inter]">
              Portfolio Security Score
            </h3>
            <span className="text-[10px] font-bold font-[JetBrains_Mono] uppercase text-outline">
              0-100 Gauge
            </span>
          </div>

          <div className="relative mt-4 mb-3">
            <svg viewBox="0 0 100 50" className="w-52 h-26 overflow-visible">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="var(--color-surface-container-highest)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={
                  averageScore === null
                    ? "var(--color-outline)"
                    : averageScore >= 85
                      ? "var(--color-secondary)"
                      : averageScore >= 70
                        ? "var(--color-tertiary)"
                        : "var(--color-error)"
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset={averageScore !== null ? 125.6 - (125.6 * averageScore) / 100 : 125.6}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center justify-end h-full pb-1">
              <span className="text-4xl font-extrabold font-[Inter] text-on-surface">
                {averageScore !== null ? averageScore : "—"}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-widest mt-0.5">
                /100
              </span>
            </div>
          </div>

          <div className="mt-2 text-center">
            {averageScore !== null ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant font-[Inter]">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    averageScore >= 85 ? "bg-secondary" : averageScore >= 70 ? "bg-tertiary" : "bg-error"
                  )}
                />
                <span className="text-on-surface">
                  {averageScore >= 85 ? "LOW RISK POSTURE" : averageScore >= 70 ? "MODERATE RISK" : "HIGH EXPOSURE"}
                </span>
              </span>
            ) : (
              <p className="text-xs text-on-surface-variant font-[Inter]">
                Awaiting initial project scan to calculate baseline posture.
              </p>
            )}
          </div>
        </div>

        {/* Severity Bento Cards (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FindingStatBox
              severity="critical"
              count={severityCounts.critical}
              label="CRITICAL"
              desc="Immediate remediation"
            />
            <FindingStatBox
              severity="high"
              count={severityCounts.high}
              label="HIGH"
              desc="High exposure priority"
            />
            <FindingStatBox
              severity="medium"
              count={severityCounts.medium}
              label="MEDIUM"
              desc="Standard backlog"
            />
            <FindingStatBox
              severity="low"
              count={severityCounts.low}
              label="LOW"
              desc="Best practices / info"
            />
          </div>

          {/* Quick Nav Shortcut Ribbon */}
          <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-4 tech-shadow flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">hub</span>
              <div>
                <h4 className="text-xs font-bold text-on-surface font-[Inter]">Explore Subsystems</h4>
                <p className="text-[11px] text-on-surface-variant font-[Inter]">Deep dive into specialized analysis lenses</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dependencies"
                className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/60 text-xs font-[JetBrains_Mono] text-on-surface hover:border-primary/50 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm text-secondary">inventory_2</span>
                Dependencies
              </Link>
              <Link
                href="/secrets"
                className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/60 text-xs font-[JetBrains_Mono] text-on-surface hover:border-primary/50 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">lock</span>
                Secrets
              </Link>
              <Link
                href="/ai-analysis"
                className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant/60 text-xs font-[JetBrains_Mono] text-on-surface hover:border-primary/50 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm text-primary">psychology</span>
                AI Triage
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Projects Portfolio & Recent Findings Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Workspace Projects Portfolio (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant/60 rounded-xl tech-shadow overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant/60 flex justify-between items-center bg-surface-container-highest/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">folder</span>
              <h3 className="text-base font-semibold text-on-surface font-[Inter]">
                Workspace Project Inventory ({projects.length})
              </h3>
            </div>
            <Link
              href="/projects"
              className="text-xs text-primary hover:underline font-[JetBrains_Mono] flex items-center gap-1"
            >
              Manage Projects <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container/40 border-b border-outline-variant/40">
                  <th className="py-2.5 px-4 text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
                    Project Target
                  </th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
                    Score
                  </th>
                  <th className="py-2.5 px-3 text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="py-2.5 px-4 text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-xs font-[JetBrains_Mono]">
                {projects.map((project) => {
                  const score = project.last_scan_score !== null ? Math.round(project.last_scan_score) : null;
                  const isScanning = scanningProjectId === project.id;

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-surface-container/40 transition-colors group"
                    >
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:text-primary transition-colors">
                            {project.source_type === "local" ? "folder_open" : "code"}
                          </span>
                          <div className="min-w-0">
                            <button
                              onClick={() => router.push(`/projects?project=${project.id}`)}
                              className="font-semibold text-on-surface hover:text-primary text-left truncate block max-w-[200px]"
                            >
                              {project.name}
                            </button>
                            <span className="text-[10px] text-on-surface-variant/70 truncate block max-w-[220px]">
                              {project.local_path ?? project.repo_url}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {score !== null ? (
                          <span
                            className={cn(
                              "font-bold",
                              score >= 85 ? "text-secondary" : score >= 70 ? "text-tertiary" : "text-error"
                            )}
                          >
                            {score}/100
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {project.last_scan_findings_count !== null ? (
                          <span className="px-2 py-0.5 rounded bg-surface border border-outline-variant/60 text-[11px] font-bold text-on-surface">
                            {project.last_scan_findings_count}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleQuickScan(project)}
                          disabled={isScanning}
                          className="px-2.5 py-1 rounded bg-surface border border-outline-variant/70 hover:border-primary text-primary hover:bg-primary/10 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isScanning ? "sync" : "play_arrow"}
                          </span>
                          {isScanning ? "Starting…" : "Scan"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Security Findings Feed (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant/60 rounded-xl tech-shadow overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant/60 flex justify-between items-center bg-surface-container-highest/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-xl">bug_report</span>
              <h3 className="text-base font-semibold text-on-surface font-[Inter]">
                Recent Threat Intelligence
              </h3>
            </div>
            {latestScan && (
              <Link
                href={`/scan?scan=${latestScan.id}`}
                className="text-xs text-primary hover:underline font-[JetBrains_Mono] flex items-center gap-1"
              >
                Scan Results <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            )}
          </div>

          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[380px]">
            {findings && findings.items.length > 0 ? (
              findings.items.slice(0, 5).map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => router.push(`/finding?scan=${latestScan?.id}&id=${finding.id}`)}
                  className={cn(
                    "p-3 rounded-lg bg-surface border border-outline-variant/40 hover:border-primary/50 transition-all cursor-pointer group shadow-sm",
                    SEVERITY_BORDER[finding.severity]
                  )}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors font-[JetBrains_Mono]">
                      {finding.title}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold font-[JetBrains_Mono] uppercase shrink-0",
                        SEVERITY_BADGE_CLASSES[finding.severity]
                      )}
                    >
                      {SEVERITY_LABELS[finding.severity]}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant line-clamp-1 font-[Inter]">
                    {finding.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-outline font-[JetBrains_Mono]">
                    <span className="truncate">{finding.file}</span>
                    {finding.line_start != null && <span>:{finding.line_start}</span>}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center flex flex-col items-center justify-center text-on-surface-variant gap-2">
                <span className="material-symbols-outlined text-4xl text-outline-variant">verified_user</span>
                <p className="text-xs font-[Inter]">
                  {latestScan
                    ? "No vulnerabilities identified in the latest scan."
                    : "No scan results available yet. Run your first scan to populate findings."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FindingStatBox({
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
        "bg-surface-container-low border border-outline-variant/50 rounded-xl p-3.5 tech-shadow relative overflow-hidden group hover:border-outline-variant transition-colors",
        SEVERITY_BORDER[severity]
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={cn("text-[10px] font-bold font-[JetBrains_Mono] tracking-wider", SEVERITY_TEXT_CLASSES[severity])}>
          {label}
        </span>
        <span className={cn("material-symbols-outlined text-base", SEVERITY_TEXT_CLASSES[severity])}>
          {SEVERITY_ICON[severity]}
        </span>
      </div>
      <div className="text-2xl font-bold text-on-surface font-[Inter] mb-0.5">
        {count}
      </div>
      <div className="text-[10px] text-on-surface-variant font-[JetBrains_Mono] truncate">
        {desc}
      </div>
    </div>
  );
}
