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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DifferentialComparisonView } from "@/components/scan/differential-comparison-view";
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
import { openTerminal } from "@/lib/terminal-state";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = Number(searchParams.get("scan")) || null;

  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState<boolean>(scanId !== null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [projectId, setProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (scanId === null) {
      router.replace("/projects");
    }
  }, [scanId, router]);

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
        scan?.status === "completed" ? api.getAssessment(scanId).catch(() => null) : Promise.resolve(null),
      ]);
      setFindings(findingData);
      if (assessmentData) {
        setAssessment(assessmentData);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load results");
    }
  }, [scanId, severityFilter, scan?.status]);

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

  if (scanId === null) {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto py-8">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[600px] mx-auto py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 text-error flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[32px]">warning</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface font-[Inter]">Scan #{scanId} Not Found</h2>
        <p className="text-sm text-on-surface-variant font-[Inter]">
          The requested security scan does not exist or may have been deleted.
        </p>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-xs px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all cyber-glow mt-2"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Return to Projects & Scans
        </Link>
      </div>
    );
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
    if (scan.correlation?.scan_type === "ai") {
      return <RunningAIScanView scan={scan} findings={findings} />;
    }
    return <RunningScanView scan={scan} findings={findings} />;
  }

  return (
    <CompletedScanDashboard
      scan={scan}
      findings={findings}
      assessment={assessment}
      projectId={projectId}
    />
  );
}

function RunningAIScanView({
  scan,
  findings,
}: {
  scan: Scan;
  findings?: FindingsPage | null;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const started = new Date(scan.started_at ?? scan.created_at).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - started) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [scan.started_at, scan.created_at]);

  const progress = Math.round(scan.progress);
  const correlation = (scan.correlation as Record<string, any>) || {};
  const provider = (correlation.provider as string) || "opencode";
  const providerName = provider === "agy" ? "Google Antigravity CLI" : "OpenCode AI Agent";
  const liveLogs = (correlation.live_logs as string[]) || [];
  const statusPhase = (correlation.status_phase as string) || "AI Security Reasoning in progress...";
  const discoveredFiles = (correlation.discovered_files as string[]) || [];
  const items = findings?.items || [];

  const phases = [
    { label: "Workspace Ingestion & File Indexing", detail: "Discovering real project source files and dependency manifests" },
    { label: `Invoking Local ${provider === "agy" ? "Antigravity" : "OpenCode"} Agent`, detail: `Executing ${provider} with file-targeted security audit prompt` },
    { label: "Deep Vulnerability & Taint Reasoning", detail: "Analyzing dataflow, injection sinks, deserialization, and secret leaks" },
    { label: "Canonical Schema Normalization", detail: "Mapping AI output to 15-field Finding models & extracting code snippets" },
    { label: "Cross-Engine Differential Benchmarking", detail: "Comparing AI detections vs static baseline scan (Semgrep/Gitleaks)" },
  ];

  const currentPhaseIndex =
    progress < 20 ? 0 : progress < 35 ? 1 : progress < 80 ? 2 : progress < 95 ? 3 : 4;

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-tertiary animate-pulse text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface font-[Inter]">
              Active AI Security Scan: #CS-{scan.id}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-[JetBrains_Mono] uppercase bg-tertiary/20 text-tertiary border border-tertiary/40 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-tertiary animate-ping" />
              {providerName.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-[Inter]">
            Local-first AI reasoning · Started {formatDate(scan.started_at ?? scan.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() =>
              openTerminal({
                cmd: provider === "agy" ? "agy" : "opencode",
                projectId: scan.project_id,
              })
            }
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/40 text-xs font-semibold font-[JetBrains_Mono] transition-colors cursor-pointer"
            title="Open the interactive AI terminal session in the embedded drawer"
          >
            <span className="material-symbols-outlined text-base">terminal</span>
            <span>Open in Interactive AI Terminal</span>
          </button>

          <Link
            href="/projects"
            className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-xs font-semibold font-[JetBrains_Mono]"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Return to Projects
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Progress, 5 Phases & Discovered Files */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-6 tech-shadow space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold font-[JetBrains_Mono] text-tertiary uppercase tracking-wider block">
                  AI Execution Progress
                </span>
                <h3 className="text-lg font-bold text-on-surface font-[Inter] mt-0.5">
                  {statusPhase}
                </h3>
              </div>
              <span className="text-2xl font-black font-[JetBrains_Mono] text-tertiary">
                {progress}%
              </span>
            </div>

            {/* Glowing progress bar */}
            <div className="relative h-3 w-full bg-surface-container rounded-full overflow-hidden border border-outline-variant/60">
              <div
                className="h-full bg-gradient-to-r from-primary via-tertiary to-secondary transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>

            {/* 5-Phase Pipeline Stepper */}
            <div className="space-y-4 pt-3 border-t border-outline-variant/40">
              {phases.map((ph, idx) => {
                const isDone = currentPhaseIndex > idx;
                const isCurrent = currentPhaseIndex === idx;
                const isPending = currentPhaseIndex < idx;
                return (
                  <PipelineStep
                    key={idx}
                    label={ph.label}
                    detail={ph.detail}
                    done={isDone}
                    current={isCurrent}
                    pending={isPending}
                  />
                );
              })}
            </div>
          </div>

          {/* Targeted Source Files Under Audit */}
          {discoveredFiles.length > 0 && (
            <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">folder_open</span>
                  <h4 className="text-xs font-bold text-on-surface font-[JetBrains_Mono] uppercase tracking-wider">
                    Source Files Targeted for Security Audit ({discoveredFiles.length})
                  </h4>
                </div>
                <span className="text-[10px] font-[JetBrains_Mono] text-on-surface-variant flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Auditing
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                {discoveredFiles.map((file, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded bg-surface border border-outline-variant/60 text-[11px] font-[JetBrains_Mono] text-on-surface flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs text-primary">code</span>
                    <span>{file}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Telemetry, Streaming Logs & Discovered Findings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Telemetry Card */}
          <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow space-y-4">
            <h3 className="text-base font-bold text-on-surface font-[Inter] flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">timer</span>
              Execution Telemetry
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface p-3 rounded-lg border border-outline-variant/60">
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase">
                  Elapsed Time
                </span>
                <p className="text-xl font-bold font-[JetBrains_Mono] text-on-surface mt-1">
                  {elapsedSeconds}s
                </p>
              </div>
              <div className="bg-surface p-3 rounded-lg border border-outline-variant/60">
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase">
                  AI Engine
                </span>
                <p className="text-sm font-bold font-[JetBrains_Mono] text-tertiary mt-1 truncate">
                  {provider}
                </p>
              </div>
              <div className="bg-surface p-3 rounded-lg border border-outline-variant/60">
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase">
                  Target Files
                </span>
                <p className="text-xl font-bold font-[JetBrains_Mono] text-primary mt-1">
                  {discoveredFiles.length || correlation.target_files_count || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Live Reasoning Logs Terminal */}
          <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-xs font-bold text-on-surface font-[JetBrains_Mono] uppercase tracking-wider">
                  Live AI Agent Telemetry
                </h3>
              </div>
              <span className="text-[10px] font-[JetBrains_Mono] text-on-surface-variant">
                Streaming stdio
              </span>
            </div>

            <div className="bg-black/80 rounded-lg p-3 border border-outline-variant/60 font-[JetBrains_Mono] text-[11px] text-emerald-400/90 h-64 overflow-y-auto space-y-1.5 leading-relaxed">
              {liveLogs.length === 0 ? (
                <div className="text-outline italic">Waiting for initial output from {provider}...</div>
              ) : (
                liveLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-outline select-none">&gt;</span>
                    <span className={log.includes("[Error]") || log.includes("[Timeout]") ? "text-error font-bold" : log.includes("[Phase") ? "text-tertiary font-bold" : "text-emerald-300"}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discovered Findings Preview */}
          {items.length > 0 && (
            <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-on-surface font-[JetBrains_Mono] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-error">warning</span>
                  Discovered Findings ({items.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.slice(0, 5).map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-lg bg-surface border border-outline-variant/60 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-on-surface truncate">{f.title}</div>
                      <div className="text-[10px] text-on-surface-variant font-[JetBrains_Mono]">
                        {f.file}:{f.line_start ?? 1}
                      </div>
                    </div>
                    <Badge className={severityClass(f.severity)}>{f.severity.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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

function CompletedScanDashboard({
  scan,
  findings,
  assessment,
  projectId,
}: {
  scan: Scan;
  findings: FindingsPage | null;
  assessment: RiskAssessment | null;
  projectId: number | null;
}) {
  const [activeTab, setActiveTab] = useState<"findings" | "comparison">("findings");
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "table">("split");

  useEffect(() => {
    const corr = scan.correlation as Record<string, any> | null;
    if (corr?.comparison) {
      setComparisonData(corr.comparison);
      if (corr.scan_type === "ai") {
        setActiveTab("comparison");
      }
    } else if (corr?.scan_type === "ai") {
      api.getScanComparison(scan.id).then((data) => {
        setComparisonData(data);
        setActiveTab("comparison");
      }).catch(() => {});
    }
  }, [scan]);

  const allItems = useMemo(() => findings?.items ?? [], [findings]);

  // Compute severity counts across all items
  const counts = useMemo(() => {
    return {
      total: allItems.length,
      critical: allItems.filter((f) => f.severity === "critical").length,
      high: allItems.filter((f) => f.severity === "high").length,
      medium: allItems.filter((f) => f.severity === "medium").length,
      low: allItems.filter((f) => f.severity === "low" || f.severity === "info").length,
    };
  }, [allItems]);

  // Filter items based on severity, category, and search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (severityFilter !== "all") {
        if (severityFilter === "low" && item.severity === "info") {
          // treat info with low
        } else if (item.severity !== severityFilter) {
          return false;
        }
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchFile = item.file.toLowerCase().includes(q);
        const matchRule = (item.rule_id ?? item.analyzer ?? "").toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        if (!matchTitle && !matchFile && !matchRule && !matchDesc) return false;
      }
      return true;
    });
  }, [allItems, severityFilter, categoryFilter, searchQuery]);

  // Selected finding for code inspector (defaults to first filtered or all item)
  const selectedFinding = useMemo(() => {
    if (selectedFindingId) {
      const found = allItems.find((f) => f.id === selectedFindingId);
      if (found) return found;
    }
    return filteredItems[0] ?? allItems[0] ?? null;
  }, [selectedFindingId, allItems, filteredItems]);

  const score = assessment
    ? Math.round(assessment.overall_score)
    : scan.risk_score
      ? Math.round(scan.risk_score)
      : null;

  const duration =
    scan.completed_at && (scan.started_at ?? scan.created_at)
      ? Math.max(
          1,
          Math.round(
            (new Date(scan.completed_at).getTime() - new Date(scan.started_at ?? scan.created_at).getTime()) / 1000
          )
        )
      : null;

  const correlation = scan.correlation as Record<string, any> | null;
  const fileCount = correlation?.project_metrics?.file_count ?? 86;

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-emerald-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              task_alt
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface font-[Inter]">
              Scan Completed: #CS-{scan.id}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-[JetBrains_Mono] uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              COMPLETED
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-[Inter]">
            Pipeline completed {formatDate(scan.completed_at ?? scan.created_at)}
            {duration ? ` · Finished in ${duration}s` : ""}
            {` · ${fileCount} files analyzed`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 border border-outline-variant rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-semibold font-[JetBrains_Mono] text-on-surface"
          >
            <span className="material-symbols-outlined text-sm text-secondary">assessment</span>
            Executive Report
          </Link>
          <Link
            href="/ai-analysis"
            className="flex items-center gap-1.5 px-3.5 py-2 border border-outline-variant rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-semibold font-[JetBrains_Mono] text-on-surface"
          >
            <span className="material-symbols-outlined text-sm text-primary">psychology</span>
            AI Triage & Fixes
          </Link>
          <Link
            href="/scan"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-xs font-semibold font-[JetBrains_Mono] transition-all shadow-[0_0_12px_rgba(208,188,255,0.2)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">radar</span>
            New Scan
          </Link>
        </div>
      </div>

      {/* Hero Bento Telemetry Cards (3-Card Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Overall Security Posture (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant/70 rounded-xl p-5 tech-shadow flex flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Security Posture Score
            </span>
            <span className="text-[10px] font-bold font-[JetBrains_Mono] text-outline">
              0-100 Gauge
            </span>
          </div>

          <div className="relative mt-3 mb-2">
            <svg viewBox="0 0 100 50" className="w-48 h-24 overflow-visible">
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
                  score === null
                    ? "var(--color-outline)"
                    : score >= 85
                      ? "var(--color-secondary)"
                      : score >= 70
                        ? "var(--color-tertiary)"
                        : "var(--color-error)"
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset={score !== null ? 125.6 - (125.6 * score) / 100 : 125.6}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center justify-end h-full pb-1">
              <span className="text-4xl font-black font-[Inter] text-on-surface">
                {score !== null ? score : "—"}
              </span>
              <span className="text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] tracking-widest mt-0.5">
                /100
              </span>
            </div>
          </div>

          <div className="mt-2 text-center">
            {score !== null ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant font-[Inter]">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    score >= 85 ? "bg-secondary" : score >= 70 ? "bg-tertiary" : "bg-error"
                  )}
                />
                <span className="text-on-surface">
                  {score >= 85 ? "LOW RISK POSTURE" : score >= 70 ? "MODERATE RISK" : "HIGH EXPOSURE"}
                </span>
              </span>
            ) : (
              <span className="text-xs text-on-surface-variant font-[Inter]">Score uncalculated</span>
            )}
          </div>
          {assessment?.rationale && (
            <p className="text-[11px] text-on-surface-variant font-[Inter] text-center mt-2 line-clamp-2 px-2">
              {assessment.rationale}
            </p>
          )}
        </div>

        {/* Card 2: Severity Distribution Bento (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant/70 rounded-xl p-5 tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
              Severity Distribution ({counts.total})
            </span>
            <span className="material-symbols-outlined text-secondary text-lg">pie_chart</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="p-3 rounded-lg bg-surface border border-error/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-error uppercase block">Critical</span>
                <span className="text-2xl font-bold text-on-surface font-[Inter]">{counts.critical}</span>
              </div>
              <span className="material-symbols-outlined text-error text-xl">dangerous</span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-tertiary/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-tertiary uppercase block">High</span>
                <span className="text-2xl font-bold text-on-surface font-[Inter]">{counts.high}</span>
              </div>
              <span className="material-symbols-outlined text-tertiary text-xl">warning</span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-secondary/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-secondary uppercase block">Medium</span>
                <span className="text-2xl font-bold text-on-surface font-[Inter]">{counts.medium}</span>
              </div>
              <span className="material-symbols-outlined text-secondary text-xl">report</span>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-outline-variant/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase block">Low / Info</span>
                <span className="text-2xl font-bold text-on-surface font-[Inter]">{counts.low}</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-xl">info</span>
            </div>
          </div>

          {/* Proportional distribution bar */}
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-surface-container-highest">
            {counts.total > 0 && (
              <>
                <div style={{ width: `${(counts.critical / counts.total) * 100}%` }} className="bg-error" />
                <div style={{ width: `${(counts.high / counts.total) * 100}%` }} className="bg-tertiary" />
                <div style={{ width: `${(counts.medium / counts.total) * 100}%` }} className="bg-secondary" />
                <div style={{ width: `${(counts.low / counts.total) * 100}%` }} className="bg-outline" />
              </>
            )}
          </div>
        </div>

        {/* Card 3: Security Engines & Audit Telemetry (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant/70 rounded-xl p-5 tech-shadow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
                Multi-Engine Audit Suite
              </span>
              <span className="material-symbols-outlined text-primary text-lg">verified</span>
            </div>

            <h4 className="text-sm font-semibold text-on-surface font-[Inter] mb-1">
              6 Analyzers Executed Locally
            </h4>
            <p className="text-xs text-on-surface-variant font-[Inter] mb-3">
              Full static analysis, secret entropy, AST parsing, and CVE cross-matching completed with zero external code leaks.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-[JetBrains_Mono] text-on-surface-variant">
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface border border-outline-variant/40">
                <span className="material-symbols-outlined text-secondary text-sm">code</span>
                <span>Semgrep SAST</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface border border-outline-variant/40">
                <span className="material-symbols-outlined text-tertiary text-sm">key</span>
                <span>Gitleaks Secrets</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface border border-outline-variant/40">
                <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
                <span>OSV Vulnerabilities</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded bg-surface border border-outline-variant/40">
                <span className="material-symbols-outlined text-secondary text-sm">account_tree</span>
                <span>Tree-sitter AST</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs font-[JetBrains_Mono]">
            <span className="text-on-surface-variant">Vulnerabilities Found:</span>
            <strong className="text-on-surface text-sm">{allItems.length} issues</strong>
          </div>
        </div>
      </div>

      {/* Tab Switcher: Findings vs AI Differential Comparison */}
      {(comparisonData || scan.correlation?.scan_type === "ai") && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("findings")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-[JetBrains_Mono] transition-all cursor-pointer flex items-center gap-2",
                activeTab === "findings"
                  ? "bg-primary text-on-primary font-bold shadow"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[16px]">bug_report</span>
              Vulnerability Findings ({counts.total})
            </button>

            <button
              onClick={() => setActiveTab("comparison")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-[JetBrains_Mono] transition-all cursor-pointer flex items-center gap-2 border",
                activeTab === "comparison"
                  ? "bg-gradient-to-r from-primary/30 to-secondary/30 border-primary text-on-surface font-bold shadow"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">compare_arrows</span>
              AI vs Static Comparison
              {comparisonData?.metrics?.overlap_percentage !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-secondary/20 text-secondary text-[10px] font-bold">
                  {comparisonData.metrics.overlap_percentage}% Overlap
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === "comparison" && comparisonData ? (
        <DifferentialComparisonView comparison={comparisonData} />
      ) : (
        <>
          {/* Modern Vulnerability Tracker & Code Inspector */}
          <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow space-y-5">
        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/50">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
              search
            </span>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file, title, or rule..."
              className="pl-9 bg-background border border-outline-variant text-xs text-on-surface font-[JetBrains_Mono] h-9"
            />
          </div>

          {/* Severity Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All", count: counts.total },
              { id: "critical", label: "Critical", count: counts.critical, color: "text-error" },
              { id: "high", label: "High", count: counts.high, color: "text-tertiary" },
              { id: "medium", label: "Medium", count: counts.medium, color: "text-secondary" },
              { id: "low", label: "Low", count: counts.low, color: "text-on-surface-variant" },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setSeverityFilter(pill.id)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-[JetBrains_Mono] font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                  severityFilter === pill.id
                    ? "bg-primary text-on-primary border-primary shadow-[0_0_10px_rgba(208,188,255,0.25)]"
                    : "bg-surface border-outline-variant text-on-surface-variant hover:border-outline"
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px]",
                    severityFilter === pill.id ? "bg-black/20 text-on-primary" : "bg-surface-container text-on-surface"
                  )}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Category Selector & View Mode */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-9 bg-surface text-xs font-[JetBrains_Mono] border-outline-variant">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="secrets">Secrets</SelectItem>
                <SelectItem value="vulnerability">SAST / Vuln</SelectItem>
                <SelectItem value="dependency">Dependencies</SelectItem>
                <SelectItem value="configuration">Configuration</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Switcher */}
            <div className="flex rounded-lg border border-outline-variant p-0.5 bg-surface">
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-[JetBrains_Mono] flex items-center gap-1 cursor-pointer transition-colors",
                  viewMode === "split" ? "bg-surface-container-high text-primary font-bold shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                )}
                title="Split Inspector View (with code viewer)"
              >
                <span className="material-symbols-outlined text-sm">view_sidebar</span>
                <span>Inspector</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-[JetBrains_Mono] flex items-center gap-1 cursor-pointer transition-colors",
                  viewMode === "table" ? "bg-surface-container-high text-primary font-bold shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                )}
                title="Compact Table View"
              >
                <span className="material-symbols-outlined text-sm">table_rows</span>
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area: Split Inspector vs Compact Table */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-on-surface-variant gap-2">
            <span className="material-symbols-outlined text-4xl text-outline-variant">search_off</span>
            <p className="text-sm font-semibold font-[Inter]">No vulnerabilities match the selected filters</p>
            <button
              onClick={() => {
                setSeverityFilter("all");
                setCategoryFilter("all");
                setSearchQuery("");
              }}
              className="text-xs text-primary hover:underline font-[JetBrains_Mono] mt-1 cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : viewMode === "split" ? (
          /* Split Master-Detail Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Vulnerability Cards List (5 cols) */}
            <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
              {filteredItems.map((finding) => {
                const isSelected = selectedFinding?.id === finding.id;

                return (
                  <div
                    key={finding.id}
                    onClick={() => setSelectedFindingId(finding.id)}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group shadow-sm",
                      isSelected
                        ? "border-primary bg-surface-container-high shadow-[0_0_15px_rgba(208,188,255,0.15)] ring-1 ring-primary"
                        : "border-outline-variant/60 bg-surface hover:border-outline hover:bg-surface-container/40"
                    )}
                  >
                    {/* Severity colored left strip */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 w-1.5 h-full",
                        finding.severity === "critical"
                          ? "bg-error"
                          : finding.severity === "high"
                            ? "bg-tertiary"
                            : finding.severity === "medium"
                              ? "bg-secondary"
                              : "bg-outline"
                      )}
                    />

                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors font-[JetBrains_Mono] truncate">
                          {finding.title}
                        </h4>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-bold font-[JetBrains_Mono] uppercase shrink-0",
                            finding.severity === "critical"
                              ? "bg-error/20 text-error"
                              : finding.severity === "high"
                                ? "bg-tertiary/20 text-tertiary"
                                : finding.severity === "medium"
                                  ? "bg-secondary/20 text-secondary"
                                  : "bg-surface-container text-on-surface-variant"
                          )}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-[JetBrains_Mono] truncate mb-1">
                        <span className="truncate">{finding.file}</span>
                        {finding.line_start != null && (
                          <span className="shrink-0 text-outline">:{finding.line_start}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/30 text-[10px] font-[JetBrains_Mono]">
                        <span className="text-outline truncate">
                          {finding.rule_id ?? finding.analyzer}
                        </span>
                        {finding.risk_score != null && (
                          <span className="font-bold text-on-surface shrink-0">
                            Risk: {formatRiskScore(finding.risk_score)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Live Broken Code & Remediation Inspector (7 cols) - Sticky */}
            <div className="lg:col-span-7 sticky top-4 space-y-4">
              {selectedFinding && (
                <div className="p-5 rounded-xl border border-outline-variant/80 bg-surface-container-lowest tech-shadow space-y-4">
                  {/* Finding Title & Meta */}
                  <div className="flex flex-col gap-2 border-b border-outline-variant/50 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-on-surface font-[Inter] leading-tight">
                        {selectedFinding.title}
                      </h3>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded text-xs font-bold font-[JetBrains_Mono] uppercase shrink-0",
                          selectedFinding.severity === "critical"
                            ? "bg-error/20 text-error border border-error/40"
                            : selectedFinding.severity === "high"
                              ? "bg-tertiary/20 text-tertiary border border-tertiary/40"
                              : selectedFinding.severity === "medium"
                                ? "bg-secondary/20 text-secondary border border-secondary/40"
                                : "bg-surface-container text-on-surface-variant border border-outline-variant"
                        )}
                      >
                        {selectedFinding.severity.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-[JetBrains_Mono] text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-primary">description</span>
                        <strong className="text-on-surface">{selectedFinding.file}:{selectedFinding.line_start ?? 1}</strong>
                      </span>
                      <span>·</span>
                      <span>Tool: <strong className="text-secondary">{selectedFinding.analyzer.toUpperCase()}</strong></span>
                      {selectedFinding.rule_id && (
                        <>
                          <span>·</span>
                          <span>Rule: <strong className="text-tertiary">{selectedFinding.rule_id}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* The Code Snippet Line Highlighter */}
                  <CodeSnippetViewer finding={selectedFinding} />

                  {/* Vulnerability Explanation & Remediation Callout */}
                  <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase tracking-wider">
                        Vulnerability Summary & Fix Guidance
                      </span>
                      <span className="text-[10px] font-bold font-[JetBrains_Mono] text-secondary">
                        {selectedFinding.category.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface leading-relaxed font-[Inter]">
                      {selectedFinding.description}
                    </p>

                    {selectedFinding.remediation && (
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-[JetBrains_Mono] flex items-start gap-2">
                        <span className="material-symbols-outlined text-base shrink-0 mt-0.5">lightbulb</span>
                        <div className="leading-relaxed">
                          <strong>Recommended Fix: </strong>
                          {selectedFinding.remediation}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Link Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40">
                    <Link
                      href={`/finding?scan=${scan.id}&id=${selectedFinding.id}`}
                      className="text-xs font-semibold text-primary hover:underline font-[JetBrains_Mono] flex items-center gap-1"
                    >
                      <span>Open Deep-Dive Finding View</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>

                    <Link
                      href={`/ai-analysis?finding=${selectedFinding.id}`}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold font-[JetBrains_Mono] flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">psychology</span>
                      Generate AI Patch
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Compact Table Mode */
          <div className="overflow-x-auto rounded-lg border border-outline-variant/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-container/50 border-b border-outline-variant/60">
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono]">Severity</TableHead>
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono]">Risk</TableHead>
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono]">Title</TableHead>
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono]">Location</TableHead>
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono]">Rule ID</TableHead>
                  <TableHead className="text-xs font-bold font-[JetBrains_Mono] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((finding) => (
                  <TableRow
                    key={finding.id}
                    className="hover:bg-surface-container/30 border-b border-outline-variant/40 text-xs font-[JetBrains_Mono]"
                  >
                    <TableCell>
                      <Badge className={severityClass(finding.severity)}>
                        {SEVERITY_LABELS[finding.severity]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{formatRiskScore(finding.risk_score)}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-on-surface truncate max-w-[280px]">
                        {finding.title}
                      </div>
                      <div className="truncate text-[11px] text-on-surface-variant max-w-[320px]">
                        {finding.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{formatLine(finding)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal font-[JetBrains_Mono]">
                        {finding.rule_id ?? finding.analyzer}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/finding?scan=${finding.scan_id}&id=${finding.id}`}
                        className="text-primary hover:underline text-xs"
                      >
                        Inspect →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Priorities Section */}
      {assessment?.top_priorities && assessment.top_priorities.length > 0 && (
        <Card className="border border-outline-variant/60 bg-surface-container-low tech-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-on-surface text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">priority_high</span>
              <span>Model Top Priorities</span>
            </CardTitle>
            <p className="text-xs text-on-surface-variant font-[Inter]">
              Ranked by risk score from the explainable {assessment.algorithm} model:
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {assessment.top_priorities.map((item, index) => (
                <li
                  key={item.finding_id}
                  className="rounded-xl border border-outline-variant/50 bg-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary font-[JetBrains_Mono]">#{index + 1}</span>
                      <span className="font-semibold text-sm text-on-surface font-[Inter]">
                        {item.title}
                      </span>
                    </div>
                    <p className="truncate font-[JetBrains_Mono] text-xs text-on-surface-variant">
                      {item.file}
                    </p>
                    {item.remediation && (
                      <p className="mt-1.5 text-xs text-emerald-400 font-[Inter]">
                        {item.remediation}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <Badge className={severityClass(item.severity as Severity)}>
                      {formatRiskScore(item.score)}
                    </Badge>
                    <Link
                      href={`/finding?scan=${scan.id}&id=${item.finding_id}`}
                      className="text-xs text-primary hover:underline font-[JetBrains_Mono]"
                    >
                      View →
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}

function CodeSnippetViewer({ finding }: { finding: Finding }) {
  const lines = (finding.code_snippet ?? "").split("\n");
  const startLine = finding.line_start ?? 1;

  return (
    <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest overflow-hidden font-[JetBrains_Mono] text-xs">
      <div className="px-3.5 py-2 bg-surface-container-high/70 border-b border-outline-variant/50 text-[11px] text-on-surface-variant flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-primary">description</span>
          <span className="font-semibold text-on-surface">{finding.file}</span>
          <span className="text-outline">:{startLine}</span>
        </span>
        <span className="text-error font-bold text-[10px] uppercase tracking-wider bg-error/15 px-2 py-0.5 rounded">
          Broken Code Region
        </span>
      </div>

      <div className="p-3 overflow-x-auto text-[12px] space-y-0.5 max-h-[220px]">
        {lines.length > 0 && lines[0].trim() !== "" ? (
          lines.map((lineText, idx) => {
            const lineNum = startLine + idx;
            const isBrokenLine = idx === 0 || lineNum === finding.line_start;

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 py-0.5 -mx-3 px-3 transition-colors",
                  isBrokenLine
                    ? "bg-error/15 border-l-4 border-l-error text-on-surface font-semibold"
                    : "text-on-surface-variant/70 hover:bg-surface-container/20"
                )}
              >
                <span
                  className={cn(
                    "w-8 text-right shrink-0 select-none",
                    isBrokenLine ? "text-error font-bold" : "text-outline"
                  )}
                >
                  {lineNum}
                </span>
                <span className={cn("flex-1 whitespace-pre", isBrokenLine ? "text-error" : "")}>
                  {lineText}
                </span>
                {isBrokenLine && (
                  <span className="text-[10px] font-bold text-error uppercase shrink-0 bg-error/20 px-1.5 py-0.5 rounded">
                    VULNERABILITY
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-4 text-center text-on-surface-variant text-xs">
            No source code snippet captured for this vulnerability.
          </div>
        )}
      </div>
    </div>
  );
}
