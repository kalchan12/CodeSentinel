"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Finding } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, SEVERITY_LABELS, SEVERITY_TEXT_CLASSES } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function FindingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <FindingContent />
    </Suspense>
  );
}

function FindingContent() {
  const searchParams = useSearchParams();
  const scanId = Number(searchParams.get("scan")) || null;
  const findingId = searchParams.get("id") ?? null;

  const hasLiveFinding = scanId !== null && findingId !== null;
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(hasLiveFinding);

  const load = useCallback(async () => {
    if (scanId === null || findingId === null) {
      setFinding(null);
      setLoading(false);
      return;
    }
    try {
      const page = await api.getFindings(scanId, {});
      const match = page.items.find((f) => f.id === findingId) ?? null;
      setFinding(match);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load finding");
    } finally {
      setLoading(false);
    }
  }, [scanId, findingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!finding) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <span className="material-symbols-outlined h-10 w-10 text-primary">security</span>
        <h3 className="text-lg font-semibold text-on-surface font-[Inter]">No Finding Selected</h3>
        <p className="max-w-md text-xs text-on-surface-variant font-[Inter]">
          Select a finding from your scan results to inspect the vulnerable code line, AI analysis, and remediation steps.
        </p>
        <Link href={`/scan${scanId ? `?scan=${scanId}` : ""}`} className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          {scanId ? "Back to Scan Results" : "Browse Scans & Findings"}
        </Link>
      </div>
    );
  }

  const snippetLines = (finding.code_snippet ?? "").split("\n");
  const snippetStart = finding.metadata.snippet_start_line;
  const startLine = typeof snippetStart === "number" ? snippetStart : finding.line_start ?? 1;
  const vulnLineIndex = finding.line_start != null ? finding.line_start - startLine : -1;

  const severityBadgeClass = cn(
    "px-2 py-0.5 rounded text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono] uppercase border",
    finding.severity === "critical" && "bg-error/15 text-error border-error/30",
    finding.severity === "high" && "bg-tertiary/15 text-tertiary border-tertiary/30",
    finding.severity === "medium" && "bg-secondary/15 text-secondary border-secondary/30",
    finding.severity === "low" && "bg-outline/15 text-on-surface-variant border-outline/30",
    finding.severity === "info" && "bg-outline-variant/15 text-on-surface-variant border-outline-variant/30"
  );

  return (
    <div className="max-w-[1200px] mx-auto space-y-lg">
          {/* Breadcrumb & Header */}
          <div className="flex flex-col gap-sm border-b border-outline-variant pb-md">
            <Link href={`/scan?scan=${scanId ?? ""}`} className="inline-flex items-center gap-xs text-[13px] leading-[18px] text-on-surface-variant hover:text-primary transition-colors font-[Inter]">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Findings
            </Link>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-sm mb-1">
                  <span className={severityBadgeClass}>
                    {SEVERITY_LABELS[finding.severity]}
                  </span>
                  <span className="text-[13px] leading-[18px] text-on-surface-variant font-[JetBrains_Mono]">
                    {finding.rule_id ?? "CWE-89"}
                  </span>
                </div>
                <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">{finding.title}</h2>
              </div>
              <div className="flex gap-sm">
                <button className="px-md py-sm bg-surface-container-high hover:bg-surface-bright text-on-surface text-[13px] leading-[20px] rounded border border-outline-variant transition-colors flex items-center gap-xs font-[JetBrains_Mono]">
                  <span className="material-symbols-outlined text-[16px]">visibility_off</span> Ignore
                </button>
                <button className="px-md py-sm bg-primary text-on-primary text-[13px] leading-[20px] rounded border border-primary luminous-glow transition-colors flex items-center gap-xs font-[JetBrains_Mono]">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span> Mark Resolved
                </button>
              </div>
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
            {/* Left Column: Meta + Code (8 cols) */}
            <div className="lg:col-span-8 space-y-md">
              {/* Meta Info Card */}
              <div className={cn(
                "bg-surface-container-low border border-outline-variant rounded-lg p-md flex gap-xl",
                finding.severity === "critical" && "finding-critical",
                finding.severity === "high" && "border-l-2 border-l-tertiary"
              )}>
                <div>
                  <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">Risk Score</p>
                  <p className={cn("text-[18px] leading-[24px] font-semibold font-[Inter]", SEVERITY_TEXT_CLASSES[finding.severity])}>
                    {finding.risk_score != null ? finding.risk_score.toFixed(0) : "\u2014"}
                    <span className="text-[13px] leading-[18px] text-on-surface-variant">/100</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">Confidence</p>
                  <p className="text-[18px] leading-[24px] font-semibold text-secondary font-[Inter]">
                    {formatConfidence(finding)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">Location</p>
                  <p className="text-[13px] leading-[20px] text-on-surface font-[JetBrains_Mono]">
                    <span className="text-outline">{finding.file}:</span>{finding.line_start ?? "\u2014"}
                  </p>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
                <div className="bg-surface-container px-md py-sm border-b border-outline-variant flex justify-between items-center">
                  <span className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">Vulnerable Code Snippet</span>
                  <button onClick={() => finding.code_snippet && navigator.clipboard.writeText(finding.code_snippet)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
                <div className="p-4 text-[13px] leading-[20px] text-on-surface bg-background overflow-x-auto font-[JetBrains_Mono]">
                  {snippetLines.length === 0 ? (
                    <p className="text-on-surface-variant">No code snippet available.</p>
                  ) : (
                    <pre className="m-0"><code className="block">
                      {snippetLines.map((line, i) => {
                        const lineNumber = startLine + i;
                        const isVuln = i === vulnLineIndex;
                        return (
                          <span key={lineNumber} className={cn("block", isVuln && "bg-error/10 border-l-2 border-l-error")}>
                            <span className="text-on-surface-variant select-none pr-4">{String(lineNumber).padStart(2, " ")}</span>
                            <span className="text-on-surface">{renderCode(line)}</span>
                          </span>
                        );
                      })}
                    </code></pre>
                  )}
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
                <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface flex items-center gap-sm mb-sm font-[Inter]">
                  <span className="material-symbols-outlined text-tertiary">info</span> Why it matters
                </h3>
                <p className="text-[13px] leading-[18px] text-on-surface-variant leading-relaxed font-[Inter]">
                  {finding.description}
                </p>
              </div>
            </div>

            {/* Right Column: AI Analysis + Metadata (4 cols) */}
            <div className="lg:col-span-4 space-y-md">
              {/* AI Analysis Panel */}
              <div className="bg-surface-container-low border border-primary/30 rounded-lg overflow-hidden tech-shadow relative group hover:border-primary/60 transition-colors">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                <div className="bg-primary/10 px-md py-sm border-b border-primary/20 flex items-center gap-sm relative z-10">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  <span className="text-[18px] leading-[24px] font-semibold text-primary font-[Inter]">AI Analysis</span>
                </div>
                <div className="p-md relative z-10 space-y-sm">
                  <p className="text-[13px] leading-[18px] text-on-surface-variant font-[Inter]">
                    {getAiSummary(finding)}
                  </p>
                  <div className="mt-md pt-md border-t border-outline-variant">
                    <h4 className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant mb-sm uppercase font-[JetBrains_Mono]">Recommended Fix</h4>
                    <p className="text-[13px] leading-[18px] text-on-surface-variant mb-sm font-[Inter]">{finding.remediation ?? "Use parameterized queries to safely bind variables."}</p>
                    <div className="bg-background border border-outline-variant rounded p-sm overflow-x-auto">
                      <pre className="m-0 text-[11px] leading-[16px] text-secondary font-[JetBrains_Mono]"><code className="block">{getRemediationExample(finding)}</code></pre>
                    </div>
                    <button className="mt-sm w-full py-1.5 border border-primary text-primary text-[11px] leading-[16px] font-[JetBrains_Mono] rounded hover:bg-primary/10 transition-colors">Apply Fix via CLI</button>
                  </div>
                </div>
              </div>

              {/* Metadata Panel */}
              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
                <h3 className="mb-3 text-[11px] leading-[16px] font-bold tracking-wider text-on-surface-variant uppercase font-[JetBrains_Mono]">Metadata</h3>
                <div className="space-y-3 text-[13px] leading-[18px]">
                  <MetaRow label="Discovered" value={formatDate(finding.created_at)} />
                  <MetaRow label="Scanner Engine" value={finding.analyzer} mono />
                  <MetaRow label="Rule" value={finding.rule_id ?? "\u2014"} mono />
                  <MetaRow label="Category" value={finding.category} mono />
                  <MetaRow label="Confidence" value={finding.confidence} mono />
                  <MetaRow label="Severity" value={SEVERITY_LABELS[finding.severity]} />
                  <MetaRow label="Line" value={finding.line_start != null ? String(finding.line_start) : "\u2014"} mono />
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}

function formatConfidence(finding: Finding): string {
  const score = finding.metadata.confidence_score;
  return typeof score === "number" ? `${score}%` : finding.confidence;
}

function getAiSummary(finding: Finding): string {
  const summary = finding.metadata.ai_summary;
  return typeof summary === "string"
    ? summary
    : `The analyzer identified ${finding.title} and recommends reviewing the affected code path.`;
}

function getRemediationExample(finding: Finding): string {
  const example = finding.metadata.remediation_example;
  return typeof example === "string" ? example : "// See recommended remediation above";
}

function MetaRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant/50 pb-1.5">
      <span className="text-on-surface-variant">{label}</span>
      <span className={cn("text-on-surface", mono && "font-code text-xs", accent)}>{value}</span>
    </div>
  );
}

/** Tiny syntax highlighter for the snippet (Sublime-dark-ish tokens). */
function renderCode(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const stringRegex = /(["'`])(?:\\.|(?!\1).)*\1/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = stringRegex.exec(line)) !== null) {
    if (m.index > last) parts.push(<span key={`s${last}`}>{line.slice(last, m.index)}</span>);
    parts.push(<span key={`str${m.index}`} className="text-tertiary">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  parts.push(<span key="tail">{line.slice(last)}</span>);
  return parts;
}
