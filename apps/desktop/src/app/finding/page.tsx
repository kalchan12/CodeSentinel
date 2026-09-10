"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Finding, Project, Severity } from "@codesentinel/shared";
import { CATEGORY_LABELS } from "@codesentinel/shared";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

  if (findingId) {
    return <SingleFindingDetailView scanId={scanId} findingId={findingId} />;
  }

  return <FindingsExplorerView initialScanId={scanId} />;
}

// ----------------------------------------------------------------------------
// Findings Explorer View (Displayed when /finding is opened directly from nav)
// ----------------------------------------------------------------------------

function FindingsExplorerView({ initialScanId }: { initialScanId: number | null }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);

      const targetProjectId = selectedProjectId !== "all" ? Number(selectedProjectId) : undefined;
      const targetScanId = initialScanId ?? undefined;

      try {
        const page = await api.listAllFindings({
          scanId: targetScanId,
          projectId: targetProjectId,
          limit: 1000,
        });
        setFindings(page.items);
      } catch {
        // Fallback: load findings for the most recent scan available
        const projectWithScan = projectList.find((p) => p.last_scan_id !== null);
        if (projectWithScan && projectWithScan.last_scan_id) {
          const fallbackPage = await api.getFindings(projectWithScan.last_scan_id, {});
          setFindings(fallbackPage.items);
        } else {
          setFindings([]);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load findings");
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, initialScanId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter findings based on text search, severity, and category
  const filteredFindings = useMemo(() => {
    if (!findings) return [];
    return findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(q);
        const matchesRule = (f.rule_id ?? "").toLowerCase().includes(q);
        const matchesFile = f.file.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRule && !matchesFile && !matchesDesc) return false;
      }
      return true;
    });
  }, [findings, severityFilter, categoryFilter, search]);

  // Calculate live severity counts
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    if (!findings) return counts;
    counts.total = findings.length;
    for (const f of findings) {
      if (f.severity in counts) {
        counts[f.severity as keyof typeof counts]++;
      }
    }
    return counts;
  }, [findings]);

  if (loading && findings === null) {
    return (
      <div className="max-w-[1440px] mx-auto space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 pb-4 border-b border-outline-variant/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="material-symbols-outlined text-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Findings Explorer
            </h2>
          </div>
          <p className="text-on-surface-variant text-[13px] leading-[18px] font-[Inter]">
            Inspect, filter, and prioritize security findings, code flaws, and vulnerabilities across your scans.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-56">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="bg-surface-container-low border-outline-variant text-xs h-9">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent className="bg-surface-container border-outline-variant text-xs">
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link
              href="/projects"
              className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cyber-glow whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Run New Scan
            </Link>
          </div>
        )}
      </div>

      {/* Severity KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase">
            Total Findings
          </span>
          <span className="text-2xl font-bold font-[JetBrains_Mono] text-on-surface mt-1">
            {severityCounts.total}
          </span>
        </div>
        <div className="bg-surface-container-low border border-error/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold font-[JetBrains_Mono] text-error uppercase">
            Critical
          </span>
          <span className="text-2xl font-bold font-[JetBrains_Mono] text-error mt-1">
            {severityCounts.critical}
          </span>
        </div>
        <div className="bg-surface-container-low border border-tertiary/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold font-[JetBrains_Mono] text-tertiary uppercase">
            High
          </span>
          <span className="text-2xl font-bold font-[JetBrains_Mono] text-tertiary mt-1">
            {severityCounts.high}
          </span>
        </div>
        <div className="bg-surface-container-low border border-secondary/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold font-[JetBrains_Mono] text-secondary uppercase">
            Medium
          </span>
          <span className="text-2xl font-bold font-[JetBrains_Mono] text-secondary mt-1">
            {severityCounts.medium}
          </span>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold font-[JetBrains_Mono] text-on-surface-variant uppercase">
            Low / Info
          </span>
          <span className="text-2xl font-bold font-[JetBrains_Mono] text-on-surface-variant mt-1">
            {severityCounts.low + severityCounts.info}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {(["all", "critical", "high", "medium", "low"] as const).map((sev) => {
            const count =
              sev === "all"
                ? severityCounts.total
                : severityCounts[sev as keyof typeof severityCounts];
            const isSelected = severityFilter === sev;

            return (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 capitalize cursor-pointer",
                  isSelected
                    ? sev === "critical"
                      ? "bg-error text-on-error shadow-sm"
                      : sev === "high"
                      ? "bg-tertiary text-on-tertiary shadow-sm"
                      : sev === "medium"
                      ? "bg-secondary text-on-secondary shadow-sm"
                      : "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/60"
                )}
              >
                <span>{sev}</span>
                <span
                  className={cn(
                    "px-1 py-0.2 rounded text-[10px] font-[JetBrains_Mono] font-bold",
                    isSelected ? "bg-white/20 text-white" : "bg-background text-on-surface-variant"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="w-40">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-surface-container border-outline-variant text-xs h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-surface-container border-outline-variant text-xs">
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
                  <SelectItem key={catKey} value={catKey}>
                    {catLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              search
            </span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rule, file, issue..."
              className="pl-8 h-8 bg-surface-container border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant/60"
            />
          </div>
        </div>
      </div>

      {/* Findings Table or Empty State */}
      {filteredFindings.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mx-auto">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>
          <h3 className="text-lg font-bold text-on-surface font-[Inter]">
            {findings && findings.length > 0
              ? "No findings match your active filters"
              : "No Security Findings Recorded"}
          </h3>
          <p className="max-w-md text-xs text-on-surface-variant font-[Inter] mx-auto">
            {findings && findings.length > 0
              ? "Try clearing your search keyword or switching severity filters to view other findings."
              : "CodeSentinel has not detected any vulnerabilities yet. Run a scan on your projects to discover exposed secrets, dependencies, and code flaws."}
          </p>
          {(!findings || findings.length === 0) && (
            <Link
              href="/projects"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-on-primary transition-all hover:bg-primary/90 cyber-glow cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Go to Projects & Scans
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden tech-shadow">
          <Table>
            <TableHeader className="bg-surface-container/50">
              <TableRow className="border-outline-variant/60 hover:bg-transparent">
                <TableHead className="w-[120px] text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
                  Severity
                </TableHead>
                <TableHead className="text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
                  Vulnerability & Rule
                </TableHead>
                <TableHead className="text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
                  Location
                </TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant">
                  Engine
                </TableHead>
                <TableHead className="w-[100px] text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant text-right">
                  Score
                </TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold font-[JetBrains_Mono] uppercase text-on-surface-variant text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-outline-variant/40 font-[Inter]">
              {filteredFindings.map((item) => {
                const sevBadge = cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase border",
                  item.severity === "critical" && "bg-error/15 text-error border-error/30",
                  item.severity === "high" && "bg-tertiary/15 text-tertiary border-tertiary/30",
                  item.severity === "medium" && "bg-secondary/15 text-secondary border-secondary/30",
                  item.severity === "low" && "bg-outline/15 text-on-surface-variant border-outline/30",
                  item.severity === "info" && "bg-outline-variant/15 text-on-surface-variant border-outline-variant/30"
                );

                return (
                  <TableRow
                    key={item.id}
                    onClick={() => router.push(`/finding?scan=${item.scan_id}&id=${item.id}`)}
                    className="hover:bg-surface-container/40 transition-colors cursor-pointer group"
                  >
                    <TableCell>
                      <span className={sevBadge}>{item.severity}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-on-surface-variant font-[JetBrains_Mono] mt-0.5">
                        {item.rule_id ?? item.category}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="text-xs text-on-surface font-[JetBrains_Mono] truncate max-w-[260px]"
                        title={`${item.file}:${item.line_start ?? "\u2014"}`}
                      >
                        <span className="text-outline">{item.file}</span>
                        {item.line_start != null && (
                          <span className="text-primary font-bold">:{item.line_start}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold font-[JetBrains_Mono] uppercase px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant">
                        {item.analyzer}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.risk_score != null ? (
                        <span className={cn("text-xs font-bold font-[JetBrains_Mono]", SEVERITY_TEXT_CLASSES[item.severity])}>
                          {Math.round(item.risk_score)}
                          <span className="text-[10px] text-on-surface-variant font-normal">/100</span>
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant font-[JetBrains_Mono]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/finding?scan=${item.scan_id}&id=${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>Inspect</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Single Finding Detail View (Displayed when /finding?scan=X&id=Y is loaded)
// ----------------------------------------------------------------------------

function SingleFindingDetailView({
  scanId,
  findingId,
}: {
  scanId: number | null;
  findingId: string;
}) {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (scanId !== null) {
        const page = await api.getFindings(scanId, {});
        const match = page.items.find((f) => f.id === findingId) ?? null;
        if (match) {
          setFinding(match);
          return;
        }
      }
      // If scanId was not provided or finding wasn't found in that scan, try global list
      const allPage = await api.listAllFindings({ limit: 1000 });
      const match = allPage.items.find((f) => f.id === findingId) ?? null;
      setFinding(match);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load finding details");
    } finally {
      setLoading(false);
    }
  }, [scanId, findingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <span className="material-symbols-outlined h-12 w-12 text-primary">security</span>
        <h3 className="text-lg font-semibold text-on-surface font-[Inter]">Finding Not Found</h3>
        <p className="max-w-md text-xs text-on-surface-variant font-[Inter]">
          The finding ID does not match any current vulnerabilities recorded for this scan.
        </p>
        <Link
          href="/finding"
          className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to All Findings
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
    <div className="max-w-[1200px] mx-auto space-y-lg overflow-hidden">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-sm border-b border-outline-variant pb-md">
        <div className="flex items-center gap-2">
          <Link
            href="/finding"
            className="inline-flex items-center gap-xs text-[13px] leading-[18px] text-on-surface-variant hover:text-primary transition-colors font-[Inter] w-fit"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            All Findings
          </Link>
          {scanId && (
            <>
              <span className="text-on-surface-variant text-xs">/</span>
              <Link
                href={`/scan?scan=${scanId}`}
                className="text-[13px] leading-[18px] text-on-surface-variant hover:text-primary transition-colors font-[Inter]"
              >
                Scan #{scanId}
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-start justify-between gap-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-sm mb-1">
              <span className={cn(severityBadgeClass, "shadow-[0_0_8px_currentColor]")}>
                {SEVERITY_LABELS[finding.severity]}
              </span>
              <span className="text-[13px] leading-[18px] text-on-surface-variant font-[JetBrains_Mono]">
                {finding.rule_id ?? "CWE-89"}
              </span>
            </div>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter] break-words">
              {finding.title}
            </h2>
          </div>

          <div className="flex gap-sm shrink-0 w-full sm:w-auto">
            <Link
              href={`/ai-analysis?finding=${finding.id}`}
              className="flex-1 sm:flex-none px-md py-sm bg-primary hover:bg-primary/90 text-on-primary text-[13px] leading-[20px] rounded border border-primary luminous-glow transition-colors flex items-center justify-center gap-xs font-[JetBrains_Mono]"
            >
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              AI Remediation
            </Link>
          </div>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Left Column: Meta + Code (8 cols) */}
        <div className="lg:col-span-8 space-y-md">
          {/* Meta Info Card */}
          <div
            className={cn(
              "bg-surface-container-low border border-outline-variant rounded-lg p-md flex gap-xl flex-wrap tech-shadow",
              finding.severity === "critical" && "finding-critical",
              finding.severity === "high" && "border-l-2 border-l-tertiary"
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">
                Risk Score
              </p>
              <p className={cn("text-[18px] leading-[24px] font-semibold font-[Inter]", SEVERITY_TEXT_CLASSES[finding.severity])}>
                {finding.risk_score != null ? finding.risk_score.toFixed(0) : "—"}
                <span className="text-[13px] leading-[18px] text-on-surface-variant">/100</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">
                Confidence
              </p>
              <p className="text-[18px] leading-[24px] font-semibold text-secondary font-[Inter]">
                {formatConfidence(finding)}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] mb-1">
                Location
              </p>
              <p className="text-[13px] leading-[20px] text-on-surface font-[JetBrains_Mono] truncate" title={`${finding.file}:${finding.line_start ?? "—"}`}>
                <span className="text-outline truncate">{finding.file}:</span>
                {finding.line_start ?? "—"}
              </p>
            </div>
          </div>

          {/* Code Snippet */}
          <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden max-w-full tech-shadow">
            <div className="bg-surface-container px-md py-sm border-b border-outline-variant flex justify-between items-center">
              <span className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">
                Vulnerable Code Snippet
              </span>
              <button
                onClick={() => finding.code_snippet && navigator.clipboard.writeText(finding.code_snippet)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
            <div className="p-0 text-[13px] leading-[20px] text-on-surface bg-background overflow-x-auto font-[JetBrains_Mono] max-w-full">
              {snippetLines.length === 0 ? (
                <p className="text-on-surface-variant p-4">No code snippet available.</p>
              ) : (
                <pre className="m-0 min-w-max">
                  <code className="block">
                    {snippetLines.map((line, i) => {
                      const lineNumber = startLine + i;
                      const isVuln = i === vulnLineIndex;
                      return (
                        <span
                          key={lineNumber}
                          className={cn(
                            "flex",
                            isVuln ? "bg-error/15 border-l-4 border-l-error" : "border-l-4 border-l-transparent"
                          )}
                        >
                          <span className="text-on-surface-variant select-none px-4 py-0.5 bg-surface-container/50 border-r border-outline-variant/30 text-right w-12 shrink-0">
                            {String(lineNumber)}
                          </span>
                          <span className="text-on-surface px-4 py-0.5 whitespace-pre">
                            {renderCode(line)}
                          </span>
                        </span>
                      );
                    })}
                  </code>
                </pre>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow">
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface flex items-center gap-sm mb-sm font-[Inter]">
              <span className="material-symbols-outlined text-tertiary">info</span> Why it matters
            </h3>
            <p className="text-[13px] leading-[18px] text-on-surface-variant leading-relaxed font-[Inter] break-words">
              {finding.description}
            </p>
          </div>
        </div>

        {/* Right Column: AI Analysis + Metadata (4 cols) */}
        <div className="lg:col-span-4 space-y-md">
          {/* AI Analysis Panel */}
          <div className="bg-surface-container-low border border-primary/20 rounded-lg overflow-hidden tech-shadow relative group hover:border-primary/40 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="bg-primary/5 px-md py-sm border-b border-primary/10 flex items-center gap-sm relative z-10">
              <span className="material-symbols-outlined text-primary">psychology</span>
              <span className="text-[18px] leading-[24px] font-semibold text-primary font-[Inter]">
                AI Analysis
              </span>
            </div>
            <div className="p-md relative z-10 space-y-sm overflow-hidden">
              <p className="text-[13px] leading-[18px] text-on-surface-variant font-[Inter] break-words">
                {getAiSummary(finding)}
              </p>
              <div className="mt-md pt-md border-t border-outline-variant">
                <h4 className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant mb-sm uppercase font-[JetBrains_Mono]">
                  Recommended Fix
                </h4>
                <p className="text-[13px] leading-[18px] text-on-surface-variant mb-sm font-[Inter] break-words">
                  {finding.remediation ?? "Use parameterized queries to safely bind variables."}
                </p>
                <div className="bg-background border border-outline-variant rounded p-sm overflow-x-auto max-w-full">
                  <pre className="m-0 text-[11px] leading-[16px] text-secondary font-[JetBrains_Mono] min-w-max">
                    <code className="block">{getRemediationExample(finding)}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Panel */}
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow">
            <h3 className="mb-3 text-[11px] leading-[16px] font-bold tracking-wider text-on-surface-variant uppercase font-[JetBrains_Mono]">
              Metadata
            </h3>
            <div className="space-y-0 text-[13px] leading-[18px] border border-outline-variant/50 rounded overflow-hidden">
              <MetaRow label="Discovered" value={formatDate(finding.created_at)} />
              <MetaRow label="Scanner Engine" value={finding.analyzer} mono className="bg-surface-container/30" />
              <MetaRow label="Rule" value={finding.rule_id ?? "—"} mono />
              <MetaRow label="Category" value={finding.category} mono className="bg-surface-container/30" />
              <MetaRow label="Confidence" value={finding.confidence} mono />
              <MetaRow label="Severity" value={SEVERITY_LABELS[finding.severity]} className="bg-surface-container/30" />
              <MetaRow label="Line" value={finding.line_start != null ? String(finding.line_start) : "—"} mono />
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
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-2 py-1.5", className)}>
      <span className="text-on-surface-variant shrink-0 mr-2">{label}</span>
      <span className={cn("text-on-surface truncate min-w-0 max-w-[200px] text-right", mono && "font-[JetBrains_Mono] text-xs", accent)} title={value}>
        {value}
      </span>
    </div>
  );
}

/** Syntax highlighter for the snippet */
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
