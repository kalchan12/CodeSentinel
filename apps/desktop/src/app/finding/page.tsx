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

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (scanId === null || findingId === null) {
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
        <span className="material-symbols-outlined h-10 w-10 text-error" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
        <h3 className="text-lg font-semibold text-on-surface">Finding not found</h3>
        <Link href={`/scan?scan=${scanId ?? ""}`} className="text-sm text-primary hover:underline">
          Back to scan results
        </Link>
      </div>
    );
  }

  const sevClass = SEVERITY_TEXT_CLASSES[finding.severity];
  const snippetLines = (finding.code_snippet ?? "").split("\n");
  const startLine = finding.line_start ?? 1;
  const vulnLineIndex = finding.line_start != null ? finding.line_start - startLine : -1;

  return (
    <div className="cyber-bg h-screen overflow-hidden flex">
      {/* SideNavBar is handled by AppShell - we're in main content area */}
      <main className="w-full md:ml-[280px] md:mt-16 h-[calc(100vh-64px)] overflow-y-auto bg-[#080A0F] p-4 md:p-xl custom-scrollbar">
        <div className="max-w-[1200px] mx-auto space-y-lg">
          {/* Breadcrumb & Header */}
          <div className="flex flex-col gap-sm border-b border-outline-variant pb-md">
            <a className="inline-flex items-center gap-xs text-body-sm text-on-surface-variant hover:text-primary transition-colors" href={`/scan?scan=${scanId ?? ""}`}>
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Findings
            </a>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-sm mb-1">
                  <span className={cn("bg-error/15 text-error px-2 py-0.5 rounded font-label-caps text-label-caps uppercase border border-error/30", SEVERITY_BG[finding.severity], SEVERITY_BORDER[finding.severity])}>
                    {SEVERITY_LABELS[finding.severity]}
                  </span>
                  <span className="bg-surface-container-highest text-on-surface-variant font-label-caps text-label-caps px-sm py-[2px] rounded border border-outline-variant flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[14px]">assessment</span>
                    Risk Score: {finding.risk_score != null ? finding.risk_score.toFixed(1) : "—"}/10
                  </span>
                  <span className="text-outline text-label-sm font-label-sm">ID: {finding.id.slice(0, 13)}</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">{finding.title}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">Detected in <code className="font-code-sm text-code-sm bg-surface-container px-xs rounded">{finding.file}</code></p>
              </div>
              <div className="flex items-center gap-sm">
                <button className="bg-transparent border border-outline-variant text-on-surface font-label-caps text-label-caps px-md py-sm rounded hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                  Ignore
                </button>
                <button className="bg-surface-container-highest border border-primary/50 text-primary font-label-caps text-label-caps px-md py-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  Re-scan with AI
                </button>
                <button className="bg-primary text-on-primary font-label-caps text-label-caps px-md py-sm rounded hover:brightness-110 transition-all flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            {/* Left Column: Code Viewer (Span 8) */}
            <div className="lg:col-span-8 flex flex-col gap-lg">
              {/* Code Panel */}
              <div className="bg-card border border-outline-variant rounded-lg overflow-hidden flex flex-col">
                <div className="bg-surface-container-low px-md py-sm border-b border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline text-sm">description</span>
                    <span className="font-label-caps text-label-caps text-on-surface">{finding.file}</span>
                  </div>
                  <button
                    onClick={() => finding.code_snippet && navigator.clipboard.writeText(finding.code_snippet)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                  </button>
                </div>
                <div className="bg-surface-container-lowest p-md overflow-x-auto font-code-sm text-code-sm text-on-surface leading-relaxed">
                  {snippetLines.length === 0 && (
                    <p className="text-on-surface-variant">No code snippet available.</p>
                  )}
                  {snippetLines.map((line, i) => {
                    const lineNumber = startLine + i;
                    const isVuln = i === vulnLineIndex;
                    return (
                      <div
                        key={lineNumber}
                        className={cn(
                          "flex hover:bg-surface-container-highest/50 px-sm py-[2px] rounded-sm group relative",
                          isVuln && "bg-error/10"
                        )}
                      >
                        {isVuln && <div className="absolute left-0 top-0 bottom-0 w-1 bg-error" />}
                        <span className="text-outline w-8 select-none text-right mr-md">{String(lineNumber).padStart(2, "0")}</span>
                        <code className="text-secondary">{renderCode(line)}</code>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trace Context */}
              <div className="bg-card border border-outline-variant rounded-lg p-md">
                <h3 className="font-title-sm text-title-sm text-on-surface mb-sm border-b border-outline-variant pb-xs">Execution Trace</h3>
                <div className="font-code-sm text-code-sm text-on-surface-variant">
                  <div className="flex items-start gap-sm py-xs">
                    <span className="material-symbols-outlined text-[16px] text-primary mt-[2px]">subdirectory_arrow_right</span>
                    <div>
                      <span className="text-on-surface">EntryPoint:</span> src/index.js:14
                    </div>
                  </div>
                  <div className="flex items-start gap-sm py-xs ml-md border-l border-outline-variant pl-md">
                    <span className="material-symbols-outlined text-[16px] text-primary mt-[2px]">subdirectory_arrow_right</span>
                    <div>
                      <span className="text-on-surface">Call:</span> initAuthModule()
                    </div>
                  </div>
                  <div className="flex items-start gap-sm py-xs ml-xl border-l border-outline-variant pl-md">
                    <span className="material-symbols-outlined text-[16px] text-error mt-[2px]">warning</span>
                    <div className="text-error">
                      <span>Sink:</span> Hardcoded secret loaded into memory.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: AI Analysis & Metadata (Span 4) */}
            <div className="lg:col-span-4 flex flex-col gap-lg">
              {/* AI Analysis Panel */}
              <div className="luminous-glow relative overflow-hidden rounded-lg bg-card border border-primary/30 p-md group hover:border-primary/60 transition-colors">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-sm mb-md border-b border-outline-variant pb-sm">
                    <span className="material-symbols-outlined text-primary text-xl animate-pulse">psychology</span>
                    <h3 className="font-title-sm text-title-sm text-primary">Local Llama-3</h3>
                    <span className="ml-auto font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-xs rounded">Analyzing</span>
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface space-y-md">
                    <p>{finding.description}</p>
                    <div className="bg-surface-container-low p-sm rounded border border-outline-variant border-l-2 border-l-primary">
                      <strong className="text-primary font-label-caps text-label-caps block mb-xs">Remediation Suggestion:</strong>
                      <p className="text-on-surface-variant">{finding.remediation ?? "Use parameterized queries to safely bind variables."}</p>
                    </div>
                    <div className="bg-[#080A0F] border border-outline-variant rounded p-sm overflow-x-auto">
                      <pre className="m-0 font-code-sm text-code-sm text-secondary"><code className="block">query = "SELECT * FROM users WHERE id = %s"
cursor.execute(query, (user_id,))</code></pre>
                    </div>
                    <button className="mt-sm w-full py-1.5 border border-primary text-primary font-code-sm text-code-sm rounded hover:bg-primary/10 transition-colors">Apply Fix via CLI</button>
                  </div>
                </div>
              </div>

              {/* Metadata Panel */}
              <div className="bg-card border border-outline-variant rounded-lg p-md">
                <h3 className="mb-3 font-code text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                  Metadata
                </h3>
                <div className="space-y-3 text-sm">
                  <MetaRow label="Discovered" value={formatDate(finding.created_at)} />
                  <MetaRow label="Scanner Engine" value={finding.analyzer} mono />
                  <MetaRow label="Rule" value={finding.rule_id ?? "—"} mono />
                  <MetaRow label="Category" value={finding.category} mono />
                  <MetaRow label="Confidence" value={finding.confidence} mono />
                  <MetaRow label="Severity" value={SEVERITY_LABELS[finding.severity]} accent={sevClass} />
                  <MetaRow label="Line" value={finding.line_start != null ? String(finding.line_start) : "—"} mono />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const SEVERITY_BG: Record<string, string> = {
  error: "bg-error/15",
  tertiary: "bg-tertiary/15",
  secondary: "bg-secondary/15",
  outline: "bg-outline/15",
  "outline-variant": "bg-outline-variant/15",
};

const SEVERITY_BORDER: Record<string, string> = {
  error: "border-error/30",
  tertiary: "border-tertiary/30",
  secondary: "border-secondary/30",
  outline: "border-outline/30",
  "outline-variant": "border-outline-variant/30",
};

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