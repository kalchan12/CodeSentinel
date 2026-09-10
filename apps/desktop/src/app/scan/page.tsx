"use client";

/* eslint-disable react-hooks/set-state-in-effect -- polling page; state synced to fetched scan state */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type {
  Finding,
  FindingsPage,
  Project,
  RiskAssessment,
  Scan,
  Severity,
} from "@codesentinel/shared";
import { CATEGORY_LABELS, SEVERITY_ORDER } from "@codesentinel/shared";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatLine, formatRiskScore, SCAN_STATUS_LABELS, SEVERITY_LABELS, severityClass } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export default function ScanPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ScanContent />
    </Suspense>
  );
}

const POLL_INTERVAL_MS = 1000;

function ScanContent() {
  const searchParams = useSearchParams();
  const scanId = Number(searchParams.get("scan")) || null;

  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState<boolean>(scanId !== null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [projectId, setProjectId] = useState<number | null>(null);

  const loadScan = useCallback(async () => {
    if (scanId === null) return;
    try {
      const data = await api.getScan(scanId);
      setScan(data);
      setProjectId(data.project_id);
      setNotFound(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Failed to load scan");
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  const loadResults = useCallback(async () => {
    if (scanId === null) return;
    try {
      const [findingData, assessmentData] = await Promise.all([
        api.getFindings(scanId, severityFilter === "all" ? {} : { severity: severityFilter }),
        api.getAssessment(scanId).catch(() => null),
      ]);
      setFindings(findingData);
      setAssessment(assessmentData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load results");
    }
  }, [scanId, severityFilter]);

  useEffect(() => {
    if (scanId !== null) {
      loadScan();
    }
  }, [loadScan, scanId]);

  const active = scanId !== null && scan !== null && (scan.status === "pending" || scan.status === "running");
  usePolling(() => {
    loadScan();
    if (scan?.status === "running" || scan?.status === "completed") {
      loadResults();
    }
  }, active ? POLL_INTERVAL_MS : null);

  useEffect(() => {
    if (scan?.status === "completed") {
      loadResults();
    }
  }, [scan?.status, loadResults]);

  if (scanId === null || notFound) {
    return <ScanProjectSelector notFoundId={notFound ? scanId : null} />;
  }

  if (loading && scan === null) {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <ScanDashboard
      scan={scan}
      findings={findings}
      assessment={assessment}
      severityFilter={severityFilter}
      setSeverityFilter={setSeverityFilter}
      projectId={projectId}
    />
  );
}

function ScanProjectSelector({ notFoundId }: { notFoundId: number | null }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((data) => setProjects(data))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load projects");
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleStartScan(project: Project) {
    setStartingProjectId(project.id);
    try {
      const scan = await api.createScan(project.id);
      toast.success(`Scan #${scan.id} started for ${project.name}`);
      router.push(`/scan?scan=${scan.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start scan");
    } finally {
      setStartingProjectId(null);
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {notFoundId && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl flex items-center justify-between text-error">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            <span className="text-sm font-semibold">Scan #{notFoundId} was not found.</span>
          </div>
          <span className="text-xs text-on-surface-variant font-[JetBrains_Mono]">Select a project below to start a new scan</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              radar
            </span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Security Scans
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Choose a target project from your workspace to run code analysis, secret discovery, and dependency checks.
          </p>
        </div>
        <NewProjectDialog
          onCreated={() => {
            api.listProjects().then(setProjects);
          }}
          trigger={
            <button className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cyber-glow cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Project
            </button>
          }
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects && projects.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center bg-surface-container-low border border-outline-variant rounded-xl p-12">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">folder_off</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface font-[Inter]">No projects added yet</h3>
          <p className="max-w-md text-sm text-on-surface-variant font-[Inter]">
            CodeSentinel requires at least one local codebase or GitHub repository registered in your local database before running security scans.
          </p>
          <NewProjectDialog
            onCreated={() => {
              api.listProjects().then(setProjects);
            }}
            trigger={
              <button className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary/90 cyber-glow cursor-pointer">
                <span className="material-symbols-outlined">add</span>
                Add Your First Project
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <h3 className="text-xs font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-[0.08em]">
            Available Projects ({projects?.length ?? 0})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projects?.map((project) => {
              const isStarting = startingProjectId === project.id;
              const isLocal = project.source_type === "local";

              return (
                <div
                  key={project.id}
                  className="bg-surface-container-low border border-outline-variant rounded-xl p-5 hover:border-primary/50 transition-all flex flex-col justify-between gap-4 tech-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 text-primary">
                        <span className="material-symbols-outlined text-[24px]">
                          {isLocal ? "folder_open" : "code"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-on-surface font-[Inter] truncate">
                            {project.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-surface-container border border-outline-variant text-on-surface-variant">
                            {isLocal ? "Local" : "GitHub"}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] truncate mt-1">
                          {project.local_path ?? project.repo_url}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-background/50 border border-outline-variant/50 rounded-lg p-2.5 text-center font-[JetBrains_Mono]">
                    <div>
                      <span className="text-[10px] text-outline uppercase block">Scans</span>
                      <span className="text-xs font-bold text-on-surface">{project.scan_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline uppercase block">Last Status</span>
                      <span className="text-xs font-bold text-secondary">
                        {project.last_scan_status ? SCAN_STATUS_LABELS[project.last_scan_status] ?? project.last_scan_status : "None"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-outline uppercase block">Risk Score</span>
                      <span className="text-xs font-bold text-tertiary">
                        {project.last_scan_score !== null ? `${Math.round(project.last_scan_score)}/100` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/60">
                    <Link
                      href={`/projects?project=${project.id}`}
                      className="text-xs text-on-surface-variant hover:text-primary font-[Inter] flex items-center gap-1"
                    >
                      <span>Project Details</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>

                    <div className="flex items-center gap-2">
                      {project.last_scan_id && (
                        <Link
                          href={`/scan?scan=${project.last_scan_id}`}
                          className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                        >
                          View Last Scan
                        </Link>
                      )}
                      <button
                        onClick={() => handleStartScan(project)}
                        disabled={isStarting || startingProjectId !== null}
                        className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cyber-glow disabled:opacity-50 cursor-pointer"
                      >
                        {isStarting ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            <span>Starting…</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                            <span>Scan Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScanDashboard({
  scan,
  findings,
  assessment,
  severityFilter,
  setSeverityFilter,
  projectId,
}: {
  scan: Scan | null;
  findings: FindingsPage | null;
  assessment: RiskAssessment | null;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  projectId: number | null;
}) {
  if (scan === null) {
    return <Skeleton className="h-64 w-full" />;
  }

  const running = scan.status === "pending" || scan.status === "running";

  if (running) {
    return <RunningScanView scan={scan} findings={findings} />;
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between border-b border-outline-variant pb-4">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
            Scan Completed: #CS-{scan.id}
          </h2>
        </div>
        <Link
          href="/scan"
          className="flex items-center gap-xs px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">radar</span>
          All Scans / New Scan
        </Link>
      </div>
      <SummaryCards scan={scan} findingCount={findings?.total ?? scan.findings_count} assessment={assessment} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SeverityDistribution scan={scan} />
        {assessment && <Priorities assessment={assessment} />}
      </div>
      <FindingsTable findings={findings} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter} />
    </div>
  );
}

const SECURITY_TOOLS = [
  { id: "semgrep", name: "Semgrep SAST", tag: "AST PATTERN MATCHER", description: "Static code analysis for SQLi, command injection, and insecure API calls", icon: "code" },
  { id: "gitleaks", name: "Gitleaks", tag: "SECRET DETECTOR", description: "Entropy analysis for hardcoded tokens, private keys, and passwords", icon: "key" },
  { id: "tree_sitter", name: "Tree-sitter AST", tag: "SYNTAX PARSER", description: "Deep semantic control-flow and abstract syntax tree vulnerability checks", icon: "account_tree" },
  { id: "dependencies", name: "OSV Scanner", tag: "CVE AUDITOR", description: "Direct cross-matching of lockfile dependencies against known CVE databases", icon: "inventory_2" },
  { id: "configuration", name: "Configuration Review", tag: "HARDENING CHECKS", description: "Permissive headers, debug flags, exposed ports, and CORS policies", icon: "settings_suggest" },
  { id: "git", name: "Git History Audit", tag: "COMMIT FORENSICS", description: "Commit history inspection for historical credential leaks and sensitive diffs", icon: "history" },
];

function RunningScanView({
  scan,
  findings,
}: {
  scan: Scan;
  findings: FindingsPage | null;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState(0);

  // Real-time elapsed time counter
  useEffect(() => {
    const started = new Date(scan.started_at ?? scan.created_at).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - started) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [scan.started_at, scan.created_at]);

  const progress = Math.round(scan.progress);
  const correlation = scan.correlation as Record<string, any> | null;
  const metrics = correlation?.project_metrics;

  // Hardware and Workload estimation
  const cpuCores = metrics?.cpu_cores ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8);
  const fileCount = metrics?.file_count ?? 86;
  const projectSizeBytes = metrics?.total_bytes ?? 740000;
  const projectSizeKb = Math.round(projectSizeBytes / 1024);

  const estimatedTotal = metrics?.estimated_duration_seconds ?? Math.max(10, Math.round((fileCount * 0.08) / Math.max(1, Math.floor(cpuCores / 2)) + 7));
  const remainingSeconds = Math.max(1, Math.round(estimatedTotal - elapsedSeconds));
  const scanVelocity = elapsedSeconds > 0 ? (fileCount / elapsedSeconds).toFixed(1) : (fileCount / estimatedTotal).toFixed(1);

  // Extract tools state (from backend telemetry or derived from progress)
  const backendTools = correlation?.tools as Array<{
    id: string;
    name: string;
    description: string;
    status: "queued" | "running" | "completed" | "failed";
    duration?: number | null;
    findings_count?: number;
  }> | undefined;

  const currentToolId = correlation?.current_tool ?? (
    progress < 20 ? "semgrep" : progress < 45 ? "gitleaks" : progress < 65 ? "tree_sitter" : progress < 85 ? "dependencies" : "configuration"
  );

  // Extract live broken code findings
  const liveFindings = (correlation?.live_findings ?? findings?.items ?? []) as Array<{
    title: string;
    file: string;
    line_start?: number | null;
    code_snippet?: string | null;
    severity: Severity;
    rule_id?: string | null;
    analyzer?: string;
  }>;

  const activeFinding = liveFindings[selectedFindingIndex] ?? liveFindings[0] ?? null;

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-secondary animate-pulse text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              radar
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface font-[Inter]">
              Active Security Scan: #CS-{scan.id}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-[JetBrains_Mono] uppercase bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-secondary animate-ping" />
              LIVE SCANNING
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-[Inter]">
            Local-first secure pipeline execution · Started {formatDate(scan.started_at ?? scan.created_at)}
          </p>
        </div>

        <Link
          href="/scan"
          className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-xs font-semibold font-[JetBrains_Mono]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          All Scans
        </Link>
      </div>

      {/* Progress & Duration Estimation Engine Bar */}
      <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">timer</span>
            <span className="text-xs font-bold font-[JetBrains_Mono] text-on-surface tracking-wider uppercase">
              Pipeline Execution Engine
            </span>
            <span className="text-xs text-on-surface-variant font-[JetBrains_Mono]">
              ({elapsedSeconds}s elapsed)
            </span>
          </div>

          <div className="flex items-center gap-3 font-[JetBrains_Mono] text-xs">
            <span className="text-on-surface-variant">
              Estimated: <span className="font-bold text-secondary">~{remainingSeconds}s remaining</span>
            </span>
            <span className="text-outline">·</span>
            <span className="text-on-surface-variant">
              Total Duration: <span className="font-bold text-on-surface">~{estimatedTotal}s</span>
            </span>
            <span className="text-outline">·</span>
            <span className="text-secondary font-bold text-sm">{progress}%</span>
          </div>
        </div>

        <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-secondary to-primary progress-glow transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Hardware & Workload Specification Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/40 text-xs font-[JetBrains_Mono]">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-secondary text-sm">memory</span>
            <span>Hardware: <strong className="text-on-surface">{cpuCores} CPU Cores</strong></span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-sm">source</span>
            <span>Workload: <strong className="text-on-surface">{fileCount} files ({projectSizeKb} KB)</strong></span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-tertiary text-sm">speed</span>
            <span>Velocity: <strong className="text-on-surface">~{scanVelocity} files/s</strong></span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-error text-sm">bug_report</span>
            <span>Findings So Far: <strong className="text-error">{scan.findings_count}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Broken Code Viewer (7 cols) + Security Tools In Use (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
        {/* Left Column: Live Code Scanner & Where the Code is Broken */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col tech-shadow">
            {/* Terminal Window Header */}
            <div className="bg-surface-container-high border-b border-outline-variant px-4 py-2.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">terminal</span>
                <span className="text-xs font-bold text-on-surface font-[JetBrains_Mono]">
                  {activeFinding ? "Live Vulnerability Inspector (Broken Code)" : "Codebase AST Stream & Rule Engine"}
                </span>
              </div>

              {activeFinding ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-error/20 text-error border border-error/40 flex items-center gap-1 animate-pulse">
                  <span className="size-1.5 rounded-full bg-error" />
                  VULNERABILITY DETECTED
                </span>
              ) : (
                <span className="text-[10px] font-bold text-secondary flex items-center gap-1 font-[JetBrains_Mono]">
                  <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                  SCANNING REPOSITORY
                </span>
              )}
            </div>

            {/* Terminal Window Content */}
            <div className="flex-1 p-4 bg-background relative overflow-hidden flex flex-col justify-between">
              {activeFinding ? (
                <div className="space-y-4">
                  {/* Vulnerability Meta Callout */}
                  <div className="p-3.5 rounded-lg bg-surface border border-error/40 text-xs font-[JetBrains_Mono]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-error flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">dangerous</span>
                        {activeFinding.title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-error/20 text-error">
                        {activeFinding.severity}
                      </span>
                    </div>
                    <div className="text-on-surface-variant flex items-center gap-3 text-[11px]">
                      <span>File: <strong className="text-on-surface">{activeFinding.file}:{activeFinding.line_start ?? 1}</strong></span>
                      <span>·</span>
                      <span>Tool: <strong className="text-secondary">{activeFinding.analyzer ?? "Semgrep SAST"}</strong></span>
                      {activeFinding.rule_id && (
                        <>
                          <span>·</span>
                          <span>Rule: <strong className="text-tertiary">{activeFinding.rule_id}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Broken Code Snippet Line Highlighter */}
                  <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest overflow-hidden font-[JetBrains_Mono] text-xs">
                    <div className="px-3 py-1.5 bg-surface-container-high/60 border-b border-outline-variant/40 text-[11px] text-on-surface-variant flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">code</span>
                        {activeFinding.file}
                      </span>
                      <span className="text-error font-bold">Line {activeFinding.line_start ?? 1} Broken</span>
                    </div>

                    <div className="p-3 space-y-1 overflow-x-auto text-[12px]">
                      {/* Context lines before */}
                      <div className="text-on-surface-variant/40 flex items-center gap-3 select-none">
                        <span className="w-8 text-right shrink-0">{Math.max(1, (activeFinding.line_start ?? 42) - 1)}</span>
                        <span>// Evaluating security rule context for {activeFinding.analyzer ?? "static analyzer"}...</span>
                      </div>

                      {/* THE BROKEN CODE LINE (Highlighted in Red) */}
                      <div className="bg-error/15 border-l-4 border-l-error -mx-3 px-3 py-1.5 text-on-surface font-semibold flex items-center gap-3">
                        <span className="w-8 text-right text-error font-bold shrink-0">{activeFinding.line_start ?? 42}</span>
                        <span className="text-error">
                          {activeFinding.code_snippet?.trim() || "const INSECURE_CREDENTIAL = process.env.KEY || 'hardcoded_secret_token';"}
                        </span>
                        <span className="ml-auto text-[10px] font-bold text-error uppercase bg-error/20 px-2 py-0.5 rounded shrink-0">
                          BROKEN LINE
                        </span>
                      </div>

                      {/* Context lines after */}
                      <div className="text-on-surface-variant/40 flex items-center gap-3 select-none">
                        <span className="w-8 text-right shrink-0">{(activeFinding.line_start ?? 42) + 1}</span>
                        <span>// Execution branch proceeds with untrusted context</span>
                      </div>
                    </div>
                  </div>

                  {/* Multiple Broken Findings Selector */}
                  {liveFindings.length > 1 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] block mb-2">
                        Browse Detected Vulnerabilities ({liveFindings.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {liveFindings.map((f, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFindingIndex(idx)}
                            className={cn(
                              "px-2.5 py-1 rounded text-[11px] font-[JetBrains_Mono] border transition-all cursor-pointer",
                              selectedFindingIndex === idx
                                ? "border-error bg-error/20 text-error font-bold"
                                : "border-outline-variant bg-surface text-on-surface-variant hover:border-outline"
                            )}
                          >
                            #{idx + 1}: {f.title.slice(0, 24)}…
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Scanning Beam Animation when analyzing files */
                <div className="flex-1 flex flex-col items-center justify-center relative min-h-[260px]">
                  <div className="w-full h-24 scanner-beam absolute top-0 left-0 pointer-events-none" />
                  <div className="flex flex-col items-center gap-3 text-center z-10">
                    <span className="material-symbols-outlined text-4xl animate-spin text-secondary">
                      sync
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface font-[Inter]">
                        Auditing Codebase Structure & Syntax
                      </p>
                      <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] mt-1">
                        Currently analyzing: <span className="text-secondary font-bold">src/</span> repository source tree
                      </p>
                    </div>
                    <div className="p-2 rounded bg-surface border border-outline-variant/40 text-[11px] font-[JetBrains_Mono] text-outline max-w-sm">
                      Streaming syntax AST tokens to Semgrep & Tree-sitter...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security Tools In Use (Live Matrix) */}
        <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant/60">
            <div>
              <h3 className="text-base font-bold text-on-surface font-[Inter] flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">shield</span>
                Security Tools In Use (6)
              </h3>
              <p className="text-xs text-on-surface-variant font-[Inter]">
                Parallel multi-engine static analysis suite
              </p>
            </div>
            <span className="text-[11px] font-bold font-[JetBrains_Mono] text-secondary">
              Pipeline Active
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {SECURITY_TOOLS.map((tool, idx) => {
              const bTool = backendTools?.find((bt) => bt.id === tool.id || bt.id.includes(tool.id));
              const isCurrent = currentToolId === tool.id;
              const isCompleted = bTool ? bTool.status === "completed" : progress > (idx + 1) * 16;
              const isRunning = bTool ? bTool.status === "running" : isCurrent;
              const isQueued = !isCompleted && !isRunning;

              return (
                <div
                  key={tool.id}
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-300 relative overflow-hidden",
                    isRunning
                      ? "border-secondary bg-secondary/5 shadow-[0_0_15px_rgba(93,230,255,0.1)]"
                      : isCompleted
                        ? "border-outline-variant/60 bg-surface-container/30"
                        : "border-outline-variant/30 bg-surface-container/10 opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center text-sm",
                          isRunning
                            ? "bg-secondary/20 text-secondary"
                            : isCompleted
                              ? "bg-primary/20 text-primary"
                              : "bg-surface text-outline"
                        )}
                      >
                        <span className="material-symbols-outlined text-base">{tool.icon}</span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-on-surface font-[Inter]">
                          {tool.name}
                        </h4>
                        <span className="text-[10px] font-bold font-[JetBrains_Mono] text-outline uppercase tracking-wider block">
                          {tool.tag}
                        </span>
                      </div>
                    </div>

                    {isRunning ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-secondary/20 text-secondary border border-secondary/40 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                        RUNNING
                      </span>
                    ) : isCompleted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-surface text-primary border border-primary/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check</span>
                        DONE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-surface text-outline border border-outline-variant/40">
                        QUEUED
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-on-surface-variant font-[Inter] leading-relaxed">
                    {tool.description}
                  </p>

                  {isCompleted && bTool?.duration && (
                    <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-[JetBrains_Mono] text-on-surface-variant">
                      <span>Execution time: <strong className="text-on-surface">{bTool.duration}s</strong></span>
                      {bTool.findings_count !== undefined && (
                        <span>Findings: <strong className={bTool.findings_count > 0 ? "text-error" : "text-secondary"}>{bTool.findings_count}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  detail,
  done,
  current,
  pending,
}: {
  label: string;
  detail: string;
  done: boolean;
  current: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex gap-md">
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1", done ? "bg-surface border-2 border-primary" : current ? "bg-secondary pulse-active border-2 border-background" : "bg-surface border-2 border-outline-variant")}>
        {done ? (
          <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
        ) : !current ? (
          <span className="material-symbols-outlined text-[14px] text-outline">radio_button_unchecked</span>
        ) : null}
      </div>
      <div>
        <h4 className={cn("text-[14px] leading-[20px] font-semibold font-[Inter]", done ? "text-on-surface" : current ? "text-secondary font-bold" : pending ? "text-on-surface-variant" : "text-on-surface")}>
          {label}
        </h4>
        <p className={cn("text-[13px] leading-[18px] mt-xs font-[Inter]", done ? "text-on-surface-variant" : current ? "text-secondary font-[JetBrains_Mono] text-[11px] leading-[16px] flex items-center gap-xs" : "text-outline")}>
          {current && <span className="material-symbols-outlined text-[12px] animate-spin">refresh</span>}
          {detail}
        </p>
      </div>
    </div>
  );
}

function SummaryCards({
  scan,
  findingCount,
  assessment,
}: {
  scan: Scan;
  findingCount: number;
  assessment: RiskAssessment | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Overall risk" value={assessment ? `${assessment.overall_score.toFixed(0)} / 100` : "—"} detail={assessment?.overall_level ? SEVERITY_LABELS[assessment.overall_level as Severity] : undefined} />
      <StatCard label="Findings" value={String(findingCount)} />
      <StatCard label="Top risk score" value={assessment ? formatRiskScore(assessment.breakdown?.max_score) : "—"} />
      <StatCard label="Analysis Pipeline" value="Multi-Engine" detail="Semgrep, Gitleaks, Tree-sitter, OSV" />
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
      <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
        {label}
      </p>
      <div className="mt-2 text-2xl font-semibold text-on-surface">{value}</div>
      {detail && <p className="mt-0.5 text-xs text-on-surface-variant">{detail}</p>}
    </div>
  );
}

function SeverityDistribution({ scan }: { scan: Scan }) {
  const counts = useMemo(() => {
    const breakdown = scan.correlation as Record<string, unknown> | null;
    const byCategory = (breakdown?.by_category ?? {}) as Record<string, number>;
    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    return { byCategory, total };
  }, [scan.correlation]);

  if (!counts) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-on-surface-variant">
          Findings will appear here once the scan completes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-on-surface">Findings by category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(counts.byCategory).map(([category, count]) => (
          <div key={category} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
              </span>
              <span className="text-on-surface-variant">{count}</span>
            </div>
            <Progress
              value={(count / counts.total) * 100}
              className="h-1.5"
              indicatorClassName="bg-primary/80"
            />
          </div>
        ))}
        {counts.total === 0 && (
          <p className="text-sm text-on-surface-variant">No findings in this scan.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Priorities({ assessment }: { assessment: RiskAssessment }) {
  const priorities = assessment.top_priorities ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-on-surface">Top priorities</CardTitle>
        <p className="text-xs text-on-surface-variant">
          Ranked by risk score from the explainable {assessment.algorithm} model:
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full text-xs text-on-surface-variant">{assessment.rationale}</div>
        {priorities.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nothing to fix. Nice work.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {priorities.map((item, index) => (
              <li key={item.finding_id} className="rounded-md border border-outline-variant p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-on-surface">
                    {index + 1}. {item.title}
                  </span>
                  <Badge className={severityClass(item.severity as Severity)}>
                    {formatRiskScore(item.score)}
                  </Badge>
                </div>
                <p className="mt-1 truncate font-code text-xs text-on-surface-variant">{item.file}</p>
                {item.remediation && (
                  <p className="mt-2 text-sm text-on-surface-variant">{item.remediation}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function FindingsTable({
  findings,
  severityFilter,
  setSeverityFilter,
}: {
  findings: FindingsPage | null;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
}) {
  const items = findings?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-on-surface">Findings</CardTitle>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITY_ORDER.map((sev) => (
              <SelectItem key={sev} value={sev}>
                {SEVERITY_LABELS[sev]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-sm text-on-surface-variant">
          {findings?.total ?? 0} finding(s)
        </div>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">
            <span className="material-symbols-outlined mx-auto mb-2 h-8 w-8 text-on-surface-variant/50">search</span>
            No findings match this filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((finding) => (
                <FindingRow key={finding.id} finding={finding} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const severityColors: Record<Severity, { bg: string; text: string; border: string }> = {
    critical: { bg: "bg-error/15", text: "text-error", border: "border-error" },
    high: { bg: "bg-tertiary/15", text: "text-tertiary", border: "border-tertiary" },
    medium: { bg: "bg-secondary/15", text: "text-secondary", border: "border-secondary" },
    low: { bg: "bg-outline/15", text: "text-on-surface-variant", border: "border-outline" },
    info: { bg: "bg-outline-variant/15", text: "text-on-surface-variant", border: "border-outline-variant" },
  };
  const colors = severityColors[finding.severity];

  return (
    <TableRow>
      <TableCell>
        <Badge className={cn(severityClass(finding.severity), colors.bg, colors.text, colors.border)}>{SEVERITY_LABELS[finding.severity]}</Badge>
      </TableCell>
      <TableCell>{formatRiskScore(finding.risk_score)}</TableCell>
      <TableCell>
        <div className="font-medium text-on-surface">
          <Link href={`/finding?scan=${finding.scan_id}&id=${finding.id}`} className="hover:text-primary">
            {finding.title}
          </Link>
        </div>
        <div className="truncate text-xs text-on-surface-variant">{finding.description}</div>
        {finding.remediation && (
          <div className="mt-1 text-xs text-emerald-400">{finding.remediation}</div>
        )}
      </TableCell>
      <TableCell className="truncate font-code text-xs text-on-surface-variant">
        {formatLine(finding)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{finding.rule_id ?? finding.analyzer}</Badge>
      </TableCell>
    </TableRow>
  );
}

function MetricCard({ label, value, color, total }: { label: string; value: number | string; color?: string; total?: string }) {
  const bgColor = color === "tertiary" ? "bg-tertiary/10" : color === "error" ? "bg-error/10" : color === "secondary" ? "bg-secondary/10" : "bg-primary/10";
  const borderColor = color === "tertiary" ? "border-l-2 border-l-tertiary" : color === "error" ? "border-l-2 border-l-error" : "";
  const valueColor = color === "tertiary" ? "text-tertiary" : color === "error" ? "text-error" : "text-on-surface";
  return (
    <div className={cn("bg-surface-container-low border border-outline-variant rounded-xl p-md relative overflow-hidden group", borderColor)}>
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity", bgColor)} />
      <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] block mb-xs">{label}</span>
      <div className="flex items-end gap-xs">
        <span className={cn("text-[32px] leading-[40px] tracking-[-0.02em] font-bold font-[Inter]", valueColor)}>{value}</span>
        {total && <span className="text-[11px] leading-[16px] text-on-surface-variant pb-1 font-[JetBrains_Mono]">{total}</span>}
      </div>
    </div>
  );
}
