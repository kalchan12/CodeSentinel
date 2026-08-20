"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Copy, FileText, Sparkles, Terminal } from "lucide-react";
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
        <AlertTriangle className="h-10 w-10 text-error" />
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
    <div className="cyber-bg space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded border border-error/40 bg-error-container/40 px-2 py-0.5 font-code text-[10px] font-bold text-error">
              {SEVERITY_LABELS[finding.severity]}
            </span>
            <span className="flex items-center gap-1 rounded border border-outline-variant bg-surface-container-highest px-2 py-0.5 font-code text-[10px] font-bold text-on-surface-variant">
              Risk Score: {finding.risk_score != null ? finding.risk_score.toFixed(1) : "—"}/10
            </span>
            <span className="font-code text-[11px] text-outline">
              ID: {finding.id.slice(0, 13)}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-on-surface">{finding.title}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Detected in{" "}
            <code className="rounded bg-surface-container px-1.5 py-0.5 font-code text-xs text-secondary">
              {finding.file}
            </code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-outline-variant bg-surface-container px-3 py-1.5 font-code text-[10px] font-bold text-on-surface-variant">
            Ignore
          </span>
          <span className="flex items-center gap-1.5 rounded border border-primary/50 bg-surface-container-highest px-3 py-1.5 font-code text-[10px] font-bold text-primary">
            <Sparkles className="h-4 w-4" />
            AI Insight
          </span>
          <span className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-code text-[10px] font-bold text-on-primary">
            <CheckCircle2 className="h-4 w-4" />
            Mark Resolved
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Left: code + description */}
        <div className="flex flex-col gap-6 md:col-span-8">
          {/* Code panel */}
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-outline" />
                <span className="font-code text-[11px] font-bold text-on-surface">{finding.file}</span>
              </div>
              <button
                onClick={() => finding.code_snippet && navigator.clipboard.writeText(finding.code_snippet)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto bg-surface-container-lowest p-4 font-code text-sm leading-relaxed text-on-surface">
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
                      "group relative rounded-sm px-2 py-px",
                      isVuln ? "bg-error/10" : "hover:bg-surface-container"
                    )}
                  >
                    {isVuln && <span className="absolute top-0 bottom-0 left-0 w-1 bg-error" />}
                    <span className="mr-4 w-8 text-right text-outline select-none">{String(lineNumber).padStart(2, "0")}</span>
                    <code className="text-secondary">{renderCode(line)}</code>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description / remediation */}
          <div className="rounded-xl border border-outline-variant bg-surface p-4">
            <h3 className="mb-2 border-b border-outline-variant pb-2 text-lg font-semibold text-on-surface">
              Details
            </h3>
            <p className="text-sm leading-relaxed text-on-surface-variant">{finding.description}</p>
          </div>

          {/* Trace context */}
          <div className="rounded-xl border border-outline-variant bg-surface p-4">
            <h3 className="mb-2 border-b border-outline-variant pb-2 text-lg font-semibold text-on-surface">
              Evidence
            </h3>
            <div className="space-y-2 font-code text-sm text-on-surface-variant">
              {finding.evidence &&
                Object.entries(finding.evidence).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-primary">{key}:</span>
                    <span className="truncate text-on-surface">{String(value)}</span>
                  </div>
                ))}
              {(!finding.evidence || Object.keys(finding.evidence).length === 0) && (
                <div className="flex items-start gap-2">
                  <Terminal className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <span className="text-on-surface">Location:</span> {finding.file}
                    {finding.line_start != null ? `:${finding.line_start}` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: metadata */}
        <div className="flex flex-col gap-6 md:col-span-4">
          {/* AI analysis panel */}
          <div className="ai-analyzing relative overflow-hidden rounded-xl border bg-surface p-4">
            <div className="dot-grid-sm pointer-events-none absolute inset-0 opacity-10" />
            <div className="relative z-10">
              <div className="mb-3 flex items-center gap-2 border-b border-outline-variant pb-2">
                <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                <h3 className="text-base font-semibold text-primary">Local AI Insight</h3>
                <span className="ml-auto rounded bg-surface-container px-2 py-0.5 font-code text-[10px] font-bold text-on-surface-variant">
                  Analyzing
                </span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface">{finding.description}</p>
              {finding.remediation && (
                <div className="mt-3 rounded border border-outline-variant border-l-2 border-l-primary bg-surface-container-low p-3">
                  <strong className="mb-1 block font-code text-[10px] font-bold tracking-wider text-primary uppercase">
                    Remediation Suggestion
                  </strong>
                  <p className="text-sm text-on-surface-variant">{finding.remediation}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface p-4">
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
  );
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
  // strings
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