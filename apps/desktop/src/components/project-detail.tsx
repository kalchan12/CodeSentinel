"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project, RiskAssessment, Scan, Severity } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import {
  formatDate,
  formatRiskScore,
  SCAN_STATUS_LABELS,
  SCAN_STATUS_STYLES,
  SEVERITY_BAR_CLASSES,
  SEVERITY_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectDetail({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [projectData, scansData] = await Promise.all([
        api.getProject(projectId),
        api.listProjectScans(projectId),
      ]);
      setProject(projectData);
      setScans(scansData);
      const completed = scansData.find((s) => s.status === "completed");
      if (completed) {
        setAssessment(await api.getAssessment(completed.id).catch(() => null));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load project");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function startScan() {
    setStarting(true);
    try {
      const scan = await api.createScan(projectId);
      toast.success(`Scan #${scan.id} started`);
      router.push(`/scan?scan=${scan.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start scan");
    } finally {
      setStarting(false);
    }
  }

  async function removeProject() {
    if (!window.confirm("Delete this project and all its scans?")) return;
    try {
      await api.deleteProject(projectId);
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete project");
    }
  }

  if (project === null) {
    return <Skeleton className="h-64 w-full" />;
  }

  const healthScore = assessment ? Math.round(assessment.overall_score) : null;
  const severityCounts = assessment?.breakdown?.severity_counts ?? {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Projects
        </Link>
        <span className="text-on-surface-variant">/</span>
        <button
          onClick={removeProject}
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-error"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
          Delete
        </button>
      </div>

      {/* Project header bento */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-card p-6 lg:col-span-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "radial-gradient(#8B5CF6 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="relative z-10 mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined h-[18px] w-[18px] text-outline">lock_open</span>
                <span className="font-code text-[11px] font-bold tracking-wider text-outline uppercase">
                  {project.source_type === "github" ? "GitHub Repository" : "Local Project"}
                </span>
              </div>
              <h2 className="flex items-center gap-2 text-3xl font-bold text-on-surface">
                {project.name}
              </h2>
              <p className="mt-1 max-w-2xl font-code text-sm text-on-surface-variant">
                {project.description ?? (project.local_path ?? project.repo_url)}
              </p>
            </div>
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded border border-outline-variant bg-surface-container px-3 py-1.5 font-code text-[11px] font-bold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-sm mr-1">open_in_new</span>
                GitHub
              </a>
            )}
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-4 border-t border-outline-variant pt-4 md:grid-cols-4">
            <StatBlock label="Source" value={project.source_type} mono />
            <StatBlock label="Scans" value={String(project.scan_count)} />
            <StatBlock label="Findings" value={String(scans[0]?.findings_count ?? 0)} />
            <StatBlock
              label="Last Scan"
              value={
                project.last_scan_status
                  ? SCAN_STATUS_LABELS[project.last_scan_status]
                  : "never"
              }
              accent={project.last_scan_status === "completed"}
            />
          </div>
        </div>

        {/* Run scan CTA */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-primary/30 bg-card p-6 text-center lg:col-span-4">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <span className="material-symbols-outlined h-8 w-8 text-primary transition-transform group-hover:scale-110" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-on-surface">Security Audit</h3>
          <p className="mb-6 font-code text-sm text-on-surface-variant">
            Initiate a comprehensive static analysis and dependency check.
          </p>
          <button
            onClick={startScan}
            disabled={starting}
            className="flex w-full max-w-[200px] items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 font-code text-[11px] font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-50 cyber-glow"
          >
            <span className="material-symbols-outlined h-4 w-4">play_arrow</span>
            {starting ? "Starting…" : "Run Security Scan"}
          </button>
        </div>
      </div>

      {/* Health + breakdown / scan history */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-6">
          {/* Health score */}
          <div className="rounded-xl border border-outline-variant bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-code text-[11px] font-bold tracking-wider text-outline uppercase">
                Project Health Score
              </h3>
              <span className="material-symbols-outlined h-4 w-4 text-outline-variant">info</span>
            </div>
            <div className="flex items-end gap-4">
              <div className="text-[64px] leading-none font-bold tracking-tighter text-secondary">
                {healthScore ?? "—"}
                <span className="text-2xl text-outline-variant">/100</span>
              </div>
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 rounded border border-secondary bg-secondary/15 px-1 py-0.5 font-code text-xs text-secondary">
                  <span className="material-symbols-outlined h-3.5 w-3.5">trending_up</span>
                  {assessment ? SEVERITY_LABELS[assessment.overall_level as Severity] : "no data"}
                </span>
              </div>
            </div>
          </div>

          {/* Vulnerability breakdown */}
          <div className="flex-1 rounded-xl border border-outline-variant bg-card p-4">
            <h3 className="mb-4 font-code text-[11px] font-bold tracking-wider text-outline uppercase">
              Vulnerability Breakdown
            </h3>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((sev) => {
                const count = severityCounts[sev] ?? 0;
                const max = Math.max(...Object.values(severityCounts), 1);
                return (
                  <div key={sev} className="flex items-center justify-between rounded p-1.5 transition-colors hover:bg-surface-container">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-3 rounded-sm", SEVERITY_BAR_CLASSES[sev])} />
                      <span className="font-code text-sm text-on-surface">{SEVERITY_LABELS[sev]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className={cn("h-full rounded-full transition-all", SEVERITY_BAR_CLASSES[sev])}
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-code text-sm text-on-surface">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scan history */}
        <div className="flex h-full flex-col rounded-xl border border-outline-variant bg-card lg:col-span-6">
          <div className="flex items-center justify-between border-b border-outline-variant p-4">
            <h3 className="font-code text-[11px] font-bold tracking-wider text-outline uppercase">
              Recent Scan History
            </h3>
            <span className="material-symbols-outlined h-5 w-5 text-primary transition-colors hover:text-primary-fixed">filter_list</span>
          </div>
          <div className="min-h-[300px] flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {scans.length === 0 && (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                No scans yet. Run your first security scan to begin.
              </div>
            )}
            {scans.map((scan) => (
              <Link
                key={scan.id}
                href={`/scan?scan=${scan.id}`}
                className="group flex cursor-pointer items-center justify-between rounded border border-outline-variant bg-surface-container-low p-2.5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded border",
                      scan.status === "completed" && "border-secondary/30 bg-secondary/10 text-secondary",
                      scan.status === "running" && "border-primary/30 bg-primary/10 text-primary",
                      (scan.status === "failed" || scan.status === "canceled") && "border-error/30 bg-error/10 text-error",
                      scan.status === "pending" && "border-outline-variant bg-surface-container text-on-surface-variant"
                    )}
                  >
                    {scan.status === "completed" ? (
                      <span className="material-symbols-outlined h-5 w-5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : scan.status === "running" ? (
                      <span className="material-symbols-outlined h-5 w-5 animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
                    ) : scan.status === "failed" || scan.status === "canceled" ? (
                      <span className="material-symbols-outlined h-5 w-5">warning</span>
                    ) : (
                      <span className="material-symbols-outlined h-5 w-5">folder_open</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-code text-sm font-semibold text-on-surface">scan-{scan.id}</span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-code text-[10px] font-bold",
                          SCAN_STATUS_STYLES[scan.status]
                        )}
                      >
                        {SCAN_STATUS_LABELS[scan.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-outline-variant">
                      {formatDate(scan.started_at ?? scan.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-secondary">
                    {formatRiskScore(scan.risk_score)}
                  </div>
                  <p className="text-[11px] text-outline">Score</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 font-code text-[10px] font-bold tracking-wider text-outline uppercase">{label}</p>
      <p className={cn("text-lg font-semibold text-on-surface", mono && "font-code text-sm", accent && "text-primary")}>
        {value}
      </p>
    </div>
  );
}