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
  const [provider, setProvider] = useState<"opencode" | "agy">("agy");
  const [model, setModel] = useState<string>("default");
  const [insights, setInsights] = useState<AIInsightItem[] | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<AIInsightItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"insights" | "benchmark">("insights");
  const [comparison, setComparison] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
      if (status.agy?.available) {
        setProvider("agy");
      } else if (status.opencode?.available) {
        setProvider("opencode");
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
      <div className="space-y-4 max-w-[1440px] mx-auto">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleSelectProvider = (p: "opencode" | "agy") => {
    setProvider(p);
    const models = aiStatus?.[p]?.models;
    if (models && models.length > 0) {
      setModel(models[0]);
    } else {
      setModel("default");
    }
  };

  const availableModels: string[] =
    aiStatus?.[provider]?.models ||
    (provider === "agy"
      ? ["default", "gemini-2.5-pro", "gemini-2.5-flash"]
      : ["anthropic/claude-3-7-sonnet", "openai/gpt-4o", "ollama/qwen2.5-coder"]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

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
        model: model !== "default" ? model : undefined,
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
    <div className="max-w-[1440px] mx-auto space-y-4">
      {/* Streamlined Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">psychology</span>
            <h1 className="text-lg font-bold text-on-surface font-[Inter]">
              AI Security Analysis
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant font-[Inter] mt-0.5">
            Local deep reasoning & automated patch generation powered by CLI agents.
          </p>
        </div>

        {/* Compact Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Selector */}
          <div className="flex items-center gap-1.5 bg-surface-container border border-outline-variant rounded px-2.5 py-1 text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[15px]">folder</span>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className="bg-transparent text-xs font-[JetBrains_Mono] text-on-surface focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-container text-on-surface">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Provider Toggle */}
          <div className="flex bg-surface-container rounded p-0.5 border border-outline-variant text-xs font-[JetBrains_Mono]">
            <button
              onClick={() => handleSelectProvider("opencode")}
              className={cn(
                "px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer",
                provider === "opencode"
                  ? "bg-primary text-on-primary font-bold shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span>OpenCode</span>
              {aiStatus?.opencode?.available && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </button>
            <button
              onClick={() => handleSelectProvider("agy")}
              className={cn(
                "px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer",
                provider === "agy"
                  ? "bg-primary text-on-primary font-bold shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span>Antigravity</span>
              {aiStatus?.agy?.available && (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              )}
            </button>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-surface-container rounded-lg px-2.5 py-1.5 border border-outline-variant text-xs font-[JetBrains_Mono]">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">tune</span>
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold">Model:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent text-xs font-[JetBrains_Mono] text-on-surface focus:outline-none cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m} value={m} className="bg-surface-container-high text-on-surface">
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Terminal */}
          <button
            onClick={() => handleLaunchTerminal()}
            className="bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface px-3 py-1.5 rounded text-xs font-[JetBrains_Mono] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Launch live interactive terminal session inside CodeSentinel"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">terminal</span>
            Terminal
          </button>

          {/* Run AI Scan */}
          <button
            onClick={handleRunAIReview}
            disabled={analyzing}
            className="bg-primary text-on-primary px-3.5 py-1.5 rounded text-xs font-[JetBrains_Mono] font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">
              {analyzing ? "sync" : "security"}
            </span>
            {analyzing ? "Auditing..." : "Run AI Audit"}
          </button>
        </div>
      </header>

      {/* Warning banner if OpenCode selected but no credentials configured */}
      {provider === "opencode" && activeProviderStatus?.available && !activeProviderStatus?.authenticated && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md text-on-surface tech-shadow">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0 mt-0.5">warning</span>
            <div>
              <p className="text-xs font-bold font-[Inter] text-amber-300">
                OpenCode CLI is not authenticated
              </p>
              <p className="text-[11px] text-on-surface-variant font-[Inter] mt-0.5 max-w-2xl">
                OpenCode has 0 API keys configured in ~/.local/share/opencode/auth.json. Automated headless runs will fail. Run interactive login or switch to Google Antigravity CLI.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openTerminal({ cmd: "opencode-auth", projectId: selectedProjectId ?? undefined })}
              className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-[JetBrains_Mono] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              Run `opencode auth`
            </button>
            <button
              onClick={() => handleSelectProvider("agy")}
              className="px-3 py-1.5 rounded bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-[JetBrains_Mono] font-semibold transition-colors cursor-pointer"
            >
              Switch to Antigravity
            </button>
          </div>
        </div>
      )}

      {/* Tabs & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-outline-variant pb-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("insights")}
            className={cn(
              "px-3 py-1 text-xs font-[JetBrains_Mono] font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === "insights"
                ? "bg-primary/20 text-primary border border-primary/40"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="material-symbols-outlined text-[15px]">psychology</span>
            AI Findings & Patches
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary border border-primary/30">
              {insights.length}
            </span>
          </button>

          {comparison && (
            <button
              onClick={() => setActiveTab("benchmark")}
              className={cn(
                "px-3 py-1 text-xs font-[JetBrains_Mono] font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer",
                activeTab === "benchmark"
                  ? "bg-secondary/20 text-secondary border border-secondary/40"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[15px]">compare_arrows</span>
              Differential Benchmark
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary/20 text-secondary border border-secondary/30">
                AI vs Static
              </span>
            </button>
          )}
        </div>

        {/* Engine Status & Execution Pill */}
        <div className="flex items-center gap-2 text-[11px] font-[JetBrains_Mono] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container border border-outline-variant">
            <span className={cn("w-1.5 h-1.5 rounded-full", activeProviderStatus?.available ? "bg-secondary" : "bg-error")} />
            {activeProviderStatus?.available ? `${provider === "opencode" ? "OpenCode" : "Antigravity"} Ready` : "CLI Not Found"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container border border-outline-variant">
            <span className="material-symbols-outlined text-[13px] text-tertiary">lock</span>
            Local Execution
          </span>
        </div>
      </div>

      {/* TAB CONTENT: INSIGHTS & PATCHES */}
      {activeTab === "insights" && (
        <div className="space-y-3">
          {/* Category Filter Pills & Count */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {["all", "vulnerability", "architecture", "secret", "refactor"].map((cat) => {
                const count = cat === "all" ? insights.length : insights.filter((i) => i.category === cat).length;
                if (cat !== "all" && count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "px-2.5 py-0.5 rounded text-[11px] font-[JetBrains_Mono] uppercase transition-colors border cursor-pointer",
                      categoryFilter === cat
                        ? "bg-primary/20 text-primary border-primary/50 font-bold"
                        : "bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface hover:bg-surface-container-high"
                    )}
                  >
                    {cat}
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-on-surface-variant font-[JetBrains_Mono]">
              Showing {filtered.length} of {insights.length}
            </span>
          </div>

          {/* Main Content: Streamlined List (7 cols) + Focused Inspector (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* Finding List */}
            <div className="lg:col-span-7 space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-surface-container-low border border-outline-variant rounded-lg p-8 text-center space-y-2">
                  <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                  <h3 className="text-sm font-semibold text-on-surface font-[Inter]">No AI Insights Found</h3>
                  <p className="text-xs text-on-surface-variant font-[Inter] max-w-sm mx-auto">
                    Execute an automated AI security scan or launch an interactive terminal session to assess this repository.
                  </p>
                  <button
                    onClick={handleRunAIReview}
                    disabled={analyzing}
                    className="mt-2 px-3 py-1.5 bg-primary text-on-primary rounded text-xs font-[JetBrains_Mono] font-semibold hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">security</span>
                    Run AI Audit
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
                        "p-3 rounded-lg border transition-all cursor-pointer bg-surface-container-low hover:border-primary/50",
                        isSelected
                          ? "border-primary bg-surface-container-high border-l-4 border-l-primary shadow-xs"
                          : "border-outline-variant"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-primary text-[16px] shrink-0">
                            {CATEGORY_ICONS[ins.category] ?? "psychology"}
                          </span>
                          <span className="text-xs font-bold text-on-surface font-[Inter] truncate">
                            {ins.title}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-[JetBrains_Mono] shrink-0",
                            SEVERITY_CHIPS[ins.severity]
                          )}
                        >
                          {ins.severity}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant line-clamp-1 font-[Inter] mb-1.5">
                        {ins.summary}
                      </p>

                      <div className="flex items-center justify-between text-[11px] font-[JetBrains_Mono] text-outline">
                        <span className="truncate max-w-[320px]">
                          {ins.affectedFiles.join(", ") || "General Codebase"}
                        </span>
                        <span
                          className={cn(
                            "text-xs flex items-center gap-0.5 shrink-0",
                            isSelected ? "text-primary font-semibold" : "text-on-surface-variant"
                          )}
                        >
                          Inspect <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Inspector Panel */}
            <div className="lg:col-span-5">
              {selectedInsight ? (
                <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3.5 space-y-3 sticky top-20 shadow-sm">
                  {/* Header & Meta */}
                  <div className="border-b border-outline-variant pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-wider">
                        {selectedInsight.category} • {selectedInsight.confidence} confidence
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-[JetBrains_Mono]",
                          SEVERITY_CHIPS[selectedInsight.severity]
                        )}
                      >
                        {selectedInsight.severity}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-on-surface font-[Inter] mt-1">
                      {selectedInsight.title}
                    </h3>
                  </div>

                  {/* Root Cause Diagnosis */}
                  <div className="bg-background p-2.5 rounded border border-outline-variant/60 space-y-1">
                    <span className="text-[10px] font-bold text-secondary font-[JetBrains_Mono] uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">troubleshoot</span>
                      Root Cause Diagnosis
                    </span>
                    <p className="text-xs leading-[17px] text-on-surface font-[Inter]">
                      {selectedInsight.rootCause}
                    </p>
                  </div>

                  {/* Remediation Snippet */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                      <span>Suggested Code Patch</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedInsight.remediationSnippet);
                          toast.success("Copied patch diff to clipboard");
                        }}
                        className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        Copy
                      </button>
                    </div>
                    <div className="bg-background border border-outline-variant rounded p-2 overflow-x-auto text-[11px] font-[JetBrains_Mono] text-on-surface max-h-52">
                      <pre className="m-0 leading-[17px]">
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

                  {/* Affected Files */}
                  <div className="text-[11px] font-[JetBrains_Mono] space-y-1">
                    <span className="text-on-surface-variant uppercase font-bold text-[10px] block">
                      Targeted Files
                    </span>
                    {selectedInsight.affectedFiles.map((file) => (
                      <div
                        key={file}
                        className="px-2 py-1 bg-surface-container rounded border border-outline-variant/40 text-on-surface flex items-center justify-between text-xs"
                      >
                        <span className="truncate">{file}</span>
                        <Link
                          href={`/finding?search=${encodeURIComponent(file)}`}
                          className="text-primary hover:underline text-[10px] shrink-0 ml-2"
                        >
                          Inspect
                        </Link>
                      </div>
                    ))}
                  </div>

                  {/* 1-Click Fix Button */}
                  <div className="pt-2 border-t border-outline-variant">
                    <button
                      onClick={() =>
                        handleLaunchTerminal(
                          `Fix security vulnerability "${selectedInsight.title}" in ${selectedInsight.affectedFiles.join(
                            ", "
                          )}`
                        )
                      }
                      className="w-full py-2 bg-primary text-on-primary rounded text-xs font-[JetBrains_Mono] font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">terminal</span>
                      Fix in {provider === "opencode" ? "OpenCode" : "Antigravity"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-low border border-outline-variant rounded-lg p-6 text-center text-xs text-on-surface-variant">
                  Select a finding to inspect diagnosis and patch diff.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DIFFERENTIAL BENCHMARK */}
      {activeTab === "benchmark" && comparison && (
        <div className="space-y-4">
          <DifferentialComparisonView comparison={comparison} />
        </div>
      )}
    </div>
  );
}
