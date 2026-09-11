"use client";

import { useState } from "react";
import { openTerminal } from "@/lib/terminal-state";
import { cn } from "@/lib/utils";

export interface DifferentialItem {
  id: string;
  title: string;
  severity: string;
  category: string;
  file: string;
  line_start?: number | null;
  description: string;
  remediation?: string;
  analyzer?: string;
  badge?: string;
}

export interface CorroboratedPair {
  static: DifferentialItem;
  ai: DifferentialItem;
  agreement: string;
  file: string;
  line?: number | null;
}

export interface ComparisonData {
  static_scan_id?: number | null;
  ai_scan_id?: number | null;
  metrics: {
    total_static: number;
    total_ai: number;
    corroborated_count: number;
    ai_only_count: number;
    static_only_count: number;
    overlap_percentage: number;
    ai_discovery_percentage: number;
  };
  executive_summary: string;
  corroborated: CorroboratedPair[];
  ai_only: DifferentialItem[];
  static_only: DifferentialItem[];
}

export function DifferentialComparisonView({
  comparison,
  className,
}: {
  comparison: ComparisonData;
  className?: string;
}) {
  const [filter, setFilter] = useState<"all" | "corroborated" | "ai_only" | "static_only">("all");

  const { metrics, executive_summary, corroborated, ai_only, static_only } = comparison;

  const totalItems = (corroborated?.length || 0) + (ai_only?.length || 0) + (static_only?.length || 0);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Executive Summary Card */}
      <div className="bg-surface-container-low border border-outline-variant/80 rounded-xl p-5 tech-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">compare_arrows</span>
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-on-surface font-[Inter]">
                Cross-Engine Differential Analysis
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-[JetBrains_Mono] uppercase bg-secondary/15 text-secondary border border-secondary/30">
                {metrics?.overlap_percentage ?? 0}% Overlap Rate
              </span>
            </div>
            <p className="text-sm text-on-surface-variant font-[Inter] leading-relaxed">
              {executive_summary ||
                "Comparison between deterministic static analysis (Semgrep, Gitleaks, Tree-sitter) and local AI reasoning (OpenCode / Antigravity CLI)."}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Comparison Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Corroborated */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
              Corroborated by Both
            </span>
            <span className="material-symbols-outlined text-primary text-xl">verified</span>
          </div>
          <div className="text-3xl font-bold font-[Inter] text-primary">
            {metrics?.corroborated_count ?? 0}
          </div>
          <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] mt-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            High Confidence ({metrics?.overlap_percentage ?? 0}%)
          </p>
        </div>

        {/* AI-Only Discoveries */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
              AI-Only Discoveries
            </span>
            <span className="material-symbols-outlined text-tertiary text-xl">psychology</span>
          </div>
          <div className="text-3xl font-bold font-[Inter] text-tertiary">
            {metrics?.ai_only_count ?? 0}
          </div>
          <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] mt-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-tertiary inline-block" />
            Logic & Context Flaws
          </p>
        </div>

        {/* Static-Only Discoveries */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
              Static-Only Rules
            </span>
            <span className="material-symbols-outlined text-secondary text-xl">rule</span>
          </div>
          <div className="text-3xl font-bold font-[Inter] text-secondary">
            {metrics?.static_only_count ?? 0}
          </div>
          <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] mt-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
            Exact Secrets & AST Sinks
          </p>
        </div>

        {/* Total Analyzed */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
              Total Scope
            </span>
            <span className="material-symbols-outlined text-on-surface-variant text-xl">inventory_2</span>
          </div>
          <div className="text-3xl font-bold font-[Inter] text-on-surface">
            {(metrics?.total_static ?? 0) + (metrics?.total_ai ?? 0)}
          </div>
          <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] mt-2">
            {metrics?.total_static ?? 0} Static · {metrics?.total_ai ?? 0} AI
          </p>
        </div>
      </div>

      {/* Filter Tabs Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low border border-outline-variant rounded-xl p-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-[JetBrains_Mono] transition-all cursor-pointer",
              filter === "all"
                ? "bg-primary text-on-primary font-bold shadow"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            All Results ({totalItems})
          </button>
          <button
            onClick={() => setFilter("corroborated")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-[JetBrains_Mono] transition-all flex items-center gap-1.5 cursor-pointer",
              filter === "corroborated"
                ? "bg-primary text-on-primary font-bold shadow"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-primary" />
            Corroborated by Both ({corroborated?.length || 0})
          </button>
          <button
            onClick={() => setFilter("ai_only")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-[JetBrains_Mono] transition-all flex items-center gap-1.5 cursor-pointer",
              filter === "ai_only"
                ? "bg-tertiary text-on-tertiary font-bold shadow"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            AI-Only ({ai_only?.length || 0})
          </button>
          <button
            onClick={() => setFilter("static_only")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-[JetBrains_Mono] transition-all flex items-center gap-1.5 cursor-pointer",
              filter === "static_only"
                ? "bg-secondary text-on-secondary font-bold shadow"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-secondary" />
            Static-Only ({static_only?.length || 0})
          </button>
        </div>

        <span className="text-xs text-on-surface-variant font-[JetBrains_Mono] px-2">
          Comparing Static vs AI Engines
        </span>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {/* Corroborated Section */}
        {(filter === "all" || filter === "corroborated") && (
          <>
            {(corroborated || []).map((pair, idx) => (
              <div
                key={`corr-${idx}`}
                className="bg-surface-container-low border border-primary/40 rounded-xl p-5 tech-shadow relative overflow-hidden group hover:border-primary transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-3 pb-3 border-b border-outline-variant/50">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-[JetBrains_Mono] uppercase bg-primary/20 text-primary border border-primary/40 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      Corroborated by Both
                    </span>
                    <span className="text-xs font-[JetBrains_Mono] text-on-surface-variant">
                      {pair.file}:{pair.line ?? "—"}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      openTerminal({
                        cmd: "opencode",
                        initialPrompt: `Fix cross-validated security vulnerability "${pair.ai.title}" in ${pair.file}:${pair.line || 1}`,
                      })
                    }
                    className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-primary rounded-lg border border-outline-variant hover:border-primary text-xs font-[JetBrains_Mono] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    Fix in AI Terminal
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Static Analyzer View */}
                  <div className="bg-background/80 border border-outline-variant/60 rounded-lg p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-[JetBrains_Mono] text-on-surface-variant uppercase">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-secondary">rule</span>
                        Static Rule ({pair.static.analyzer})
                      </span>
                      <span className="font-bold text-secondary">{pair.static.severity}</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface font-[Inter]">
                      {pair.static.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant font-[Inter] line-clamp-3">
                      {pair.static.description}
                    </p>
                  </div>

                  {/* AI Agent View */}
                  <div className="bg-background/80 border border-primary/30 rounded-lg p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-[JetBrains_Mono] text-on-surface-variant uppercase">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary">psychology</span>
                        AI Confirmation ({pair.ai.analyzer})
                      </span>
                      <span className="font-bold text-primary">{pair.ai.severity}</span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface font-[Inter]">
                      {pair.ai.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant font-[Inter] line-clamp-3">
                      {pair.ai.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* AI-Only Section */}
        {(filter === "all" || filter === "ai_only") && (
          <>
            {(ai_only || []).map((item, idx) => (
              <div
                key={`ai-only-${idx}`}
                className="bg-surface-container-low border border-tertiary/40 rounded-xl p-5 tech-shadow hover:border-tertiary transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-[JetBrains_Mono] uppercase bg-tertiary/20 text-tertiary border border-tertiary/40 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">psychology</span>
                      AI-Only Discovery (Missed by Static)
                    </span>
                    <span className="text-xs font-[JetBrains_Mono] text-on-surface-variant">
                      {item.file}:{item.line_start ?? "—"}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      openTerminal({
                        cmd: "opencode",
                        initialPrompt: `Fix security finding "${item.title}" in ${item.file}:${item.line_start || 1}`,
                      })
                    }
                    className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-tertiary rounded-lg border border-outline-variant hover:border-tertiary text-xs font-[JetBrains_Mono] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    Fix in AI Terminal
                  </button>
                </div>

                <h4 className="text-base font-bold text-on-surface font-[Inter] mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-on-surface-variant font-[Inter] leading-relaxed mb-3">
                  {item.description}
                </p>

                {item.remediation && (
                  <div className="bg-background border border-outline-variant/60 rounded-lg p-2.5 text-xs font-[JetBrains_Mono] text-on-surface">
                    <span className="text-tertiary font-bold block mb-1">Recommended Fix:</span>
                    <p className="text-on-surface-variant font-[Inter]">{item.remediation}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Static-Only Section */}
        {(filter === "all" || filter === "static_only") && (
          <>
            {(static_only || []).map((item, idx) => (
              <div
                key={`static-only-${idx}`}
                className="bg-surface-container-low border border-secondary/30 rounded-xl p-5 tech-shadow hover:border-secondary transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-[JetBrains_Mono] uppercase bg-secondary/15 text-secondary border border-secondary/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">rule</span>
                      Static-Only Rule (Missed by AI)
                    </span>
                    <span className="text-xs font-[JetBrains_Mono] text-on-surface-variant">
                      {item.file}:{item.line_start ?? "—"}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      openTerminal({
                        cmd: "opencode",
                        initialPrompt: `Fix security violation "${item.title}" in ${item.file}:${item.line_start || 1}`,
                      })
                    }
                    className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-secondary rounded-lg border border-outline-variant hover:border-secondary text-xs font-[JetBrains_Mono] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                    Fix in AI Terminal
                  </button>
                </div>

                <h4 className="text-base font-bold text-on-surface font-[Inter] mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-on-surface-variant font-[Inter] leading-relaxed mb-3">
                  {item.description}
                </p>

                {item.remediation && (
                  <div className="bg-background border border-outline-variant/60 rounded-lg p-2.5 text-xs font-[JetBrains_Mono] text-on-surface">
                    <span className="text-secondary font-bold block mb-1">Remediation Rule:</span>
                    <p className="text-on-surface-variant font-[Inter]">{item.remediation}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {totalItems === 0 && (
          <div className="p-12 text-center bg-surface-container-low border border-outline-variant rounded-xl text-on-surface-variant">
            No comparative findings recorded between these scans.
          </div>
        )}
      </div>
    </div>
  );
}
