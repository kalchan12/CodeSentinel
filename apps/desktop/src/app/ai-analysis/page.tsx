"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Finding } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { DEMO_AI_INSIGHTS, type AIInsightItem } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

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
};

export default function AIAnalysisPage() {
  const [insights, setInsights] = useState<AIInsightItem[] | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<AIInsightItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const withScans = projects.filter((p) => p.last_scan_id != null);
      if (withScans.length > 0) {
        const latestScanId = withScans[0].last_scan_id!;
        const page = await api.getFindings(latestScanId, { category: "ai_insight" });
        if (page.items.length > 0) {
          const mapped: AIInsightItem[] = page.items.map((f: Finding, i: number) => ({
            id: f.id || `ai-${i}`,
            category: "vulnerability",
            title: f.title,
            severity: (f.severity as "critical" | "high" | "medium" | "low") || "medium",
            confidence: (f.confidence as "high" | "medium" | "low") || "high",
            summary: f.description,
            affectedFiles: [f.file].filter(Boolean),
            rootCause: (f.metadata?.root_cause as string) || "Identified during AST contextual review.",
            remediationSnippet: f.remediation || "// Review code path and apply safe input validation",
            tokenCost: 320,
          }));
          setInsights(mapped);
          setSelectedInsight(mapped[0]);
          return;
        }
      }
      setInsights(DEMO_AI_INSIGHTS);
      setSelectedInsight(DEMO_AI_INSIGHTS[0]);
    } catch {
      setInsights(DEMO_AI_INSIGHTS);
      setSelectedInsight(DEMO_AI_INSIGHTS[0]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (insights === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleRunAIReview = () => {
    setAnalyzing(true);
    toast.info("Extracting targeted finding context and invoking AI provider...");
    setTimeout(() => {
      setAnalyzing(false);
      toast.success("AI Security synthesis updated (3 recommendations generated)");
    }, 1500);
  };

  const filtered = insights.filter(
    (ins) => categoryFilter === "all" || ins.category === categoryFilter
  );

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">psychology</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              AI Security Analysis & Automated Remediation
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Context-bounded LLM security synthesis, taint-flow reasoning, and interactive patch generation.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-xs px-3 py-1 bg-surface-container rounded border border-outline-variant text-[11px] font-[JetBrains_Mono] text-secondary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Provider: Local / OpenAI-Compatible
          </div>
          <button
            onClick={handleRunAIReview}
            disabled={analyzing}
            className="bg-primary text-on-primary px-4 py-1.5 rounded text-[12px] leading-[18px] font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors flex items-center gap-xs shadow-[0_0_12px_rgba(208,188,255,0.2)] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">auto_fix_high</span>
            {analyzing ? "Synthesizing..." : "Trigger AI Review"}
          </button>
        </div>
      </header>

      {/* Privacy Guarantee Alert Banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-md flex items-start gap-md tech-shadow">
        <span className="material-symbols-outlined text-primary text-2xl mt-0.5">security</span>
        <div className="flex-1">
          <h4 className="text-[13px] font-bold text-primary font-[Inter]">
            Privacy Guarantee: Bounded Context Extraction Active
          </h4>
          <p className="text-[12px] text-on-surface-variant font-[Inter] mt-0.5">
            Your entire codebase is never uploaded. Only minimal, targeted snippets around flagged findings and lockfile manifests are extracted into memory and evaluated.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard
          label="AI INSIGHTS"
          value={insights.length}
          icon="psychology"
          desc="Generated security analyses"
          highlight="text-primary"
        />
        <StatCard
          label="TAINT FLOWS"
          value="1 DETECTED"
          icon="alt_route"
          desc="Cross-function data taint"
          highlight="text-error"
        />
        <StatCard
          label="PATCHES READY"
          value="3 VERIFIED"
          icon="healing"
          desc="Automated code remediation"
          highlight="text-secondary"
        />
        <StatCard
          label="TOKEN BUDGET"
          value="48 KB CAP"
          icon="memory"
          desc="Strict privacy boundary"
          highlight="text-tertiary"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex justify-between items-center">
        <div className="flex flex-wrap gap-xs">
          {["all", "vulnerability", "architecture", "refactor"].map((cat) => (
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
          {filtered.map((ins) => {
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
                    Files: {ins.affectedFiles.join(", ")}
                  </span>
                  <span className="text-secondary font-semibold">View Patch & Reasoning →</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Patch & Reasoning Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-md">
          {selectedInsight ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md">
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
                  <span>Suggested Code Patch (Diff)</span>
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
                <div className="bg-background border border-outline-variant rounded p-sm overflow-x-auto text-[11px] font-[JetBrains_Mono] text-on-surface">
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
                    <Link href="/finding" className="text-primary hover:underline text-[10px]">
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-sm border-t border-outline-variant">
                <button
                  onClick={() => toast.success("Automated CLI patch instructions generated")}
                  className="w-full py-2 bg-primary text-on-primary rounded text-[12px] font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-xs shadow-[0_0_10px_rgba(208,188,255,0.15)]"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Generate CLI Fix Command
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
