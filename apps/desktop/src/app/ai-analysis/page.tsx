"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Finding, Project } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { openTerminal } from "@/lib/terminal-state";
import { DifferentialComparisonView } from "@/components/scan/differential-comparison-view";
import { cn } from "@/lib/utils";

export interface AIInsightItem {
  id: string;
  category: "vulnerability" | "architecture" | "secret" | "refactor" | "configuration";
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  summary: string;
  affectedFiles: string[];
  rootCause: string;
  remediationSnippet: string;
  tokenCost: number;
}

const SEVERITY_CHIPS: Record<string, string> = {
  critical: "bg-error/15 text-error border-error/30",
  high: "bg-tertiary/15 text-tertiary border-tertiary/30",
  medium: "bg-secondary/15 text-secondary border-secondary/30",
  low: "bg-outline/15 text-on-surface-variant border-outline/30",
};

const CATEGORY_ICONS: Record<string, string> = {
  vulnerability: "shield_with_heart",
  architecture: "account_tree",
  secret: "key",
  refactor: "auto_fix_high",
  configuration: "tune",
};

export default function AIAnalysisPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [provider, setProvider] = useState<"opencode" | "agy">("opencode");
  const [insights, setInsights] = useState<AIInsightItem[] | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<AIInsightItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [customPrompt, setCustomPrompt] = useState("");
  const [comparison, setComparison] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
      if (!status.opencode?.available && status.agy?.available) {
        setProvider("agy");
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const projList = await api.listProjects();
      setProjects(projList);

      let targetProject = projList.find((p) => p.id === selectedProjectId);
      if (!targetProject && projList.length > 0) {
        targetProject = projList.find((p) => p.last_scan_id != null) || projList[0];
        setSelectedProjectId(targetProject.id);
      }

      if (targetProject) {
        // Attempt loading comparative benchmark data
        try {
          const scans = await api.listProjectScans(targetProject.id);
          const aiScan = scans.find((s) => s.correlation?.scan_type === "ai");
          if (aiScan) {
            const comp = await api.getScanComparison(aiScan.id);
            setComparison(comp);
          } else {
            setComparison(null);
          }
        } catch {
          setComparison(null);
        }
      }

      if (targetProject && targetProject.last_scan_id != null) {
        const page = await api.getFindings(targetProject.last_scan_id, {});
        const aiFindings = page.items.filter(
          (f) => f.analyzer === "opencode" || f.analyzer === "agy" || f.metadata?.ai_summary || f.remediation
        );
        if (aiFindings.length > 0) {
          const mapped: AIInsightItem[] = aiFindings.map((f: Finding, i: number) => ({
            id: f.id || `ai-${i}`,
            category: (f.category as any) || "vulnerability",
            title: f.title || "Untitled AI Finding",
            severity: (f.severity as any) || "medium",
            confidence: (f.confidence as any) || "high",
            summary: f.description || "No description provided.",
            affectedFiles: [f.file].filter(Boolean),
            rootCause: (f.metadata?.root_cause as string) || `Identified by ${f.analyzer} analysis engine.`,
            remediationSnippet:
              (f.metadata?.remediation_example as string) ||
              f.remediation ||
              "// Validate and sanitize user input before passing to execution sinks.",
            tokenCost: 280,
          }));
          setInsights(mapped);
          setSelectedInsight(mapped[0]);
          return;
        }
      }
      setInsights([]);
      setSelectedInsight(null);
    } catch {
      setInsights([]);
      setSelectedInsight(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadStatus();
    load();
  }, [loadStatus, load]);

  if (insights === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleRunAIReview = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project to analyze");
      return;
    }
    setAnalyzing(true);
    toast.info(`Invoking local ${provider === "opencode" ? "OpenCode" : "Antigravity CLI"} assessment...`);
    try {
      const scan = await api.runAIScan(selectedProjectId, {
        provider,
        prompt: customPrompt.trim() || undefined,
      });
      toast.success(
        `AI Scan #${scan.id} queued! Redirecting to live scan dashboard...`
      );
      router.push(`/scan?scan=${scan.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI Scan failed to execute");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLaunchTerminal = (prompt?: string) => {
    openTerminal({
      cmd: provider,
      projectId: selectedProjectId ?? undefined,
      initialPrompt: prompt,
    });
    toast.success(`Launched interactive ${provider === "opencode" ? "OpenCode" : "Antigravity"} session`);
  };

  const filtered = insights.filter(
    (ins) => categoryFilter === "all" || ins.category === categoryFilter
  );

  const activeProviderStatus = aiStatus?.[provider];

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">psychology</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              AI Security Analysis & CLI Orchestration
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Deep reasoning vulnerability detection and automated patch generation powered by local AI CLIs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          {/* Provider Toggle */}
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant text-xs font-[JetBrains_Mono]">
            <button
              onClick={() => setProvider("opencode")}
              className={cn(
                "px-3 py-1 rounded transition-colors flex items-center gap-1.5",
                provider === "opencode"
                  ? "bg-primary text-on-primary font-bold shadow"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
              OpenCode
              {aiStatus?.opencode?.available && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </button>
            <button
              onClick={() => setProvider("agy")}
              className={cn(
                "px-3 py-1 rounded transition-colors flex items-center gap-1.5",
                provider === "agy"
                  ? "bg-primary text-on-primary font-bold shadow"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              Antigravity (agy)
              {aiStatus?.agy?.available && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </button>
          </div>

          {/* Interactive Terminal Trigger */}
          <button
            onClick={() => handleLaunchTerminal()}
            className="bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface px-3 py-1.5 rounded text-[12px] font-[JetBrains_Mono] flex items-center gap-1.5 transition-colors"
            title="Launch live interactive terminal session inside CodeSentinel"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
            Interactive Session
          </button>

          {/* Automated Headless Scan Trigger */}
          <button
            onClick={handleRunAIReview}
            disabled={analyzing}
            className="bg-primary text-on-primary px-4 py-1.5 rounded text-[12px] font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors flex items-center gap-xs shadow-[0_0_12px_rgba(208,188,255,0.2)] disabled:opacity-60 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {analyzing ? "sync" : "security"}
            </span>
            {analyzing ? "Auditing Codebase..." : "Run AI Audit"}
          </button>
        </div>
      </header>

      {/* Target Project & Local CLI Status Banner */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col md:flex-row items-start md:items-center justify-between gap-md tech-shadow">
        <div className="flex items-center gap-md flex-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[13px] font-bold text-on-surface font-[Inter]">
                Active Engine: {provider === "opencode" ? "OpenCode CLI" : "Google Antigravity CLI (agy)"}
              </h4>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-[JetBrains_Mono] font-bold uppercase",
                  activeProviderStatus?.available
                    ? "bg-secondary/15 text-secondary border border-secondary/30"
                    : "bg-error/15 text-error border border-error/30"
                )}
              >
                {activeProviderStatus?.available ? "Binary Detected" : "Not Found"}
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant font-[JetBrains_Mono] mt-0.5 truncate max-w-xl">
              {activeProviderStatus?.path || "Install CLI or check PATH"}
            </p>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-[11px] font-[JetBrains_Mono] text-on-surface-variant uppercase font-semibold">
            Target Project:
          </span>
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="bg-background border border-outline-variant rounded px-3 py-1 text-xs font-[JetBrains_Mono] text-on-surface focus:outline-none focus:border-primary"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (#{p.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard
          label="AI FINDINGS"
          value={insights.length}
          icon="psychology"
          desc="Identified security issues"
          highlight="text-primary"
        />
        <StatCard
          label="ACTIVE CLI"
          value={provider.toUpperCase()}
          icon="terminal"
          desc={activeProviderStatus?.version || "Local execution"}
          highlight="text-secondary"
        />
        <StatCard
          label="REMEDIATIONS"
          value={insights.filter((i) => i.remediationSnippet).length}
          icon="healing"
          desc="Patches ready to apply"
          highlight="text-tertiary"
        />
        <StatCard
          label="EXECUTION"
          value="100% LOCAL"
          icon="lock"
          desc="Zero code sent to cloud"
          highlight="text-outline"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-wrap justify-between items-center gap-sm">
        <div className="flex flex-wrap gap-xs">
          {["all", "vulnerability", "architecture", "secret", "refactor"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-3 py-1 rounded text-[12px] font-[JetBrains_Mono] uppercase transition-colors border",
                categoryFilter === cat
                  ? "bg-primary/15 text-primary border-primary/40 font-bold"
                  : "bg-background text-on-surface-variant border-outline-variant hover:text-on-surface"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-on-surface-variant font-[JetBrains_Mono]">
          Showing {filtered.length} insights
        </span>
      </div>

      {/* Main Grid: Feed (7 cols) + Detail/Diff Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Insight Feed (7 cols) */}
        <div className="lg:col-span-7 space-y-md">
          {filtered.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-xl text-center space-y-3">
              <span className="material-symbols-outlined text-primary text-4xl">psychology</span>
              <h3 className="text-base font-semibold text-on-surface font-[Inter]">No AI Insights Yet</h3>
              <p className="text-xs text-on-surface-variant font-[Inter] max-w-md mx-auto">
                Click <strong>Run AI Audit</strong> to execute a headless evaluation of this project using{" "}
                {provider === "opencode" ? "OpenCode" : "Antigravity CLI"}, or launch an interactive session.
              </p>
              <button
                onClick={handleRunAIReview}
                disabled={analyzing}
                className="mt-2 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">security</span>
                Run Automated Audit Now
              </button>
            </div>
          ) : (
            filtered.map((ins) => {
              const isSelected = selectedInsight?.id === ins.id;
              return (
                <div
                  key={ins.id}
                  onClick={() => setSelectedInsight(ins)}
                  className={cn(
                    "bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow cursor-pointer transition-all hover:border-primary/50",
                    isSelected && "border-primary bg-surface-container-high border-l-4 border-l-primary"
                  )}
                >
                  <div className="flex justify-between items-start mb-sm">
                    <div className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        {CATEGORY_ICONS[ins.category] ?? "psychology"}
                      </span>
                      <span className="text-[10px] font-bold tracking-wider font-[JetBrains_Mono] uppercase text-on-surface-variant">
                        {ins.category}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-[JetBrains_Mono]",
                        SEVERITY_CHIPS[ins.severity]
                      )}
                    >
                      {ins.severity}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-bold text-on-surface font-[Inter] mb-xs">
                    {ins.title}
                  </h3>
                  <p className="text-[13px] leading-[18px] text-on-surface-variant line-clamp-2 font-[Inter] mb-sm">
                    {ins.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-sm pt-sm border-t border-outline-variant/50 text-[11px] font-[JetBrains_Mono]">
                    <span className="text-outline truncate max-w-[280px]">
                      Files: {ins.affectedFiles.join(", ") || "General Codebase"}
                    </span>
                    <span className="text-secondary font-semibold flex items-center gap-1">
                      Inspect & Remediate →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Patch & Reasoning Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-md">
          {selectedInsight ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md sticky top-20">
              <div className="flex justify-between items-start border-b border-outline-variant pb-sm">
                <div>
                  <span className="text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                    AI Remediation Engine
                  </span>
                  <h3 className="text-[16px] font-bold text-on-surface font-[Inter] mt-0.5">
                    {selectedInsight.title}
                  </h3>
                </div>
              </div>

              {/* Root Cause Card */}
              <div className="bg-background p-sm rounded border border-outline-variant/60 space-y-1">
                <span className="text-[10px] font-bold text-secondary font-[JetBrains_Mono] uppercase flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">troubleshoot</span>
                  Root Cause Diagnosis
                </span>
                <p className="text-[12px] leading-[17px] text-on-surface font-[Inter]">
                  {selectedInsight.rootCause}
                </p>
              </div>

              {/* Remediation Diff Snippet */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                  <span>Suggested Code Patch / Remediation</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedInsight.remediationSnippet);
                      toast.success("Copied patch diff to clipboard");
                    }}
                    className="text-primary hover:underline flex items-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    Copy
                  </button>
                </div>
                <div className="bg-background border border-outline-variant rounded p-sm overflow-x-auto text-[11px] font-[JetBrains_Mono] text-on-surface max-h-56">
                  <pre className="m-0 leading-[18px]">
                    <code>
                      {selectedInsight.remediationSnippet.split("\n").map((line, i) => (
                        <span
                          key={i}
                          className={cn(
                            "block",
                            line.startsWith("-") && "bg-error/15 text-error px-1 rounded",
                            line.startsWith("+") && "bg-secondary/15 text-secondary px-1 rounded"
                          )}
                        >
                          {line}
                        </span>
                      ))}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Affected Files List */}
              <div className="text-[11px] font-[JetBrains_Mono] space-y-1">
                <span className="text-on-surface-variant uppercase font-bold block">
                  Targeted File Paths
                </span>
                {selectedInsight.affectedFiles.map((file) => (
                  <div
                    key={file}
                    className="px-2 py-1 bg-surface-container rounded border border-outline-variant/40 text-on-surface flex items-center justify-between"
                  >
                    <span className="truncate">{file}</span>
                    <Link href={`/finding?search=${encodeURIComponent(file)}`} className="text-primary hover:underline text-[10px]">
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>

              {/* 1-Click Interactive CLI Fix Actions */}
              <div className="pt-sm border-t border-outline-variant space-y-2">
                <button
                  onClick={() =>
                    handleLaunchTerminal(
                      `Fix security vulnerability "${selectedInsight.title}" in ${selectedInsight.affectedFiles.join(
                        ", "
                      )}`
                    )
                  }
                  className="w-full py-2 bg-primary text-on-primary rounded text-[12px] font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-xs shadow-[0_0_10px_rgba(208,188,255,0.15)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">terminal</span>
                  Fix in {provider === "opencode" ? "OpenCode" : "Antigravity CLI"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-xl text-center text-on-surface-variant">
              Select an AI insight from the feed to inspect reasoning and suggested patches.
            </div>
          )}
        </div>
      </div>

      {/* Differential Benchmark: AI vs Static Scan */}
      {comparison && (
        <div className="space-y-4 pt-6 border-t border-outline-variant/60">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-on-surface font-[Inter] flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">compare_arrows</span>
                Cross-Engine Differential Benchmark
              </h2>
              <p className="text-xs text-on-surface-variant font-[Inter] mt-0.5">
                Automated comparison between deterministic static rules (Semgrep, Gitleaks, Tree-sitter) and local AI reasoning.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold font-[JetBrains_Mono] bg-primary/15 text-primary border border-primary/30">
              Cross-Validated Findings
            </span>
          </div>

          <DifferentialComparisonView comparison={comparison} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  desc,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: string;
  desc: string;
  highlight: string;
}) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow flex flex-col justify-between">
      <div className="flex justify-between items-start mb-xs">
        <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
          {label}
        </span>
        <span className={cn("material-symbols-outlined text-lg", highlight)}>{icon}</span>
      </div>
      <div className={cn("text-[28px] leading-[36px] font-bold font-[Inter]", highlight)}>
        {value}
      </div>
      <p className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono] mt-xs">
        {desc}
      </p>
    </div>
  );
}
