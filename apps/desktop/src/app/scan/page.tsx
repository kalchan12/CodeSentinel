"use client";

/* eslint-disable react-hooks/set-state-in-effect -- polling page; state synced to fetched scan state */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, FileSearch, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type {
  Finding,
  FindingsPage,
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
import { api, ApiError } from "@/lib/api";
import { formatLine, formatRiskScore, SEVERITY_LABELS, severityClass } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ScanContent />
    </Suspense>
  );
}

const POLL_INTERVAL_MS = 2000;

function ScanContent() {
  const searchParams = useSearchParams();
  const scanId = Number(searchParams.get("scan")) || null;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [projectId, setProjectId] = useState<number | null>(null);
  const router = useRouter();

  const loadScan = useCallback(async () => {
    if (scanId === null) return;
    try {
      const data = await api.getScan(scanId);
      setScan(data);
      setProjectId(data.project_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        router.push("/projects");
      }
    }
  }, [router, scanId]);

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
    loadScan();
  }, [loadScan]);

  const active = scan !== null && (scan.status === "pending" || scan.status === "running");
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
    return <ScanInProgress scan={scan} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects?project=${projectId ?? scan.project_id}`}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
          >
            Project
          </Link>
          <h1 className="text-2xl font-semibold text-on-surface">Scan #{scan.id}</h1>
        </div>
        <span className={scanStatusBadge(scan.status)}>{scan.status}</span>
      </div>

      {scan.status === "failed" && (
        <Card className="border-error/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-error">
              <AlertTriangle className="h-5 w-5" />
              Scan failed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-error">
            {scan.error_message ?? "The analysis pipeline failed."}
          </CardContent>
        </Card>
      )}

      {scan.status === "completed" && (
        <>
          <SummaryCards scan={scan} findingCount={findings?.total ?? scan.findings_count} assessment={assessment} />
          <SeverityDistribution scan={scan} />
          {assessment && <Priorities assessment={assessment} />}
          <FindingsTable
            findings={findings}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
          />
        </>
      )}
    </div>
  );
}

function scanStatusBadge(status: Scan["status"]): string {
  const styles: Record<string, string> = {
    pending: "rounded border border-outline-variant bg-surface-container px-2 py-1 font-code text-[10px] font-bold text-on-surface-variant uppercase",
    running: "rounded border border-primary/30 bg-primary/10 px-2 py-1 font-code text-[10px] font-bold text-primary uppercase",
    completed: "rounded border border-secondary/30 bg-secondary/10 px-2 py-1 font-code text-[10px] font-bold text-secondary uppercase",
    failed: "rounded border border-error/30 bg-error/10 px-2 py-1 font-code text-[10px] font-bold text-error uppercase",
    canceled: "rounded border border-outline-variant bg-surface-container px-2 py-1 font-code text-[10px] font-bold text-on-surface-variant uppercase",
  };
  return styles[status] ?? styles.pending;
}

/* ---------- Scan in progress (codesentinel_scan_in_progress) ---------- */

const PIPELINE_STEPS = ["Discovery", "Source Analysis", "Dependencies", "Secrets"];

const TERMINAL_LOG = [
  "[INFO] Cloning / reading workspace…",
  "[INFO] Resolving source files…",
  "[INFO] Running analyzer: mock",
  "[WARN] Potential hardcoded credential in src/app.js",
  "[INFO] Correlating findings…",
  "[INFO] Computing risk scores…",
];

function ScanInProgress({ scan }: { scan: Scan }) {
  const pct = Math.round(scan.progress);
  const activeStep = Math.min(Math.floor(pct / 25), PIPELINE_STEPS.length - 1);

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center">
      <div className="tech-grid pointer-events-none absolute inset-0 z-0 opacity-20" />
      <div className="relative z-10 w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
        {/* Modal header */}
        <div className="flex justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Active Scan: <span className="font-code text-primary">scan-{scan.id}</span>
            </h2>
            <p className="mt-0.5 font-code text-sm text-on-surface-variant">
              ID: #{scan.id} · {scan.status}
            </p>
          </div>
          <span className="rounded border border-error/30 px-2.5 py-1 font-code text-[10px] font-bold text-error transition-colors hover:bg-error/10">
            Abort
          </span>
        </div>

        {/* Stepper */}
        <div className="border-b border-outline-variant px-6 py-4">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-surface-variant" />
            <div
              className="absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-secondary transition-all duration-1000"
              style={{ width: `${(activeStep / (PIPELINE_STEPS.length - 1)) * 100}%` }}
            />
            {PIPELINE_STEPS.map((label, index) => {
              const done = index < activeStep;
              const current = index === activeStep;
              const stepPct = index === 0 ? 100 : Math.min(100, (pct - index * 25) * 4);
              return (
                <div key={label} className="relative flex flex-col items-center gap-1 bg-surface-container px-2">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border",
                      done && "border-secondary bg-secondary/20 text-secondary",
                      current && "border-primary bg-primary/20 text-primary",
                      !done && !current && "border-outline-variant bg-surface-variant text-on-surface-variant"
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : current ? (
                      <>
                        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="font-code text-[10px]">{stepPct}%</span>
                      </>
                    ) : (
                      <span className="font-code text-[10px]">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-code text-[10px] font-bold uppercase",
                      current ? "text-primary" : done ? "text-secondary" : "text-on-surface-variant opacity-50"
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between">
              <span className="font-code text-sm text-on-surface-variant">
                Scanning repository files…
              </span>
              <span className="font-code text-[10px] font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-outline-variant/50 bg-surface-variant">
              <div
                className="progress-bar-animated glow-primary h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-code text-sm text-on-surface-variant">
                {scan.findings_count} findings discovered so far
              </span>
              <span className="font-code text-sm text-on-surface-variant">
                Est. time remaining: scanning…
              </span>
            </div>
          </div>

          {/* Metrics bento */}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center justify-center gap-1.5 rounded border border-outline-variant/50 bg-[#090c10] p-3">
              <span className="font-code text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                Progress
              </span>
              <span className="font-code text-3xl font-bold text-secondary">{pct}%</span>
              <span className="font-code text-[10px] text-on-surface-variant">scanning…</span>
            </div>
            <div className="relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded border border-error/30 bg-[#090c10] p-3">
              <div className="absolute inset-0 z-0 bg-error/5" />
              <span className="relative z-10 font-code text-[10px] font-bold tracking-wider text-error uppercase">
                Findings Discovered
              </span>
              <span className="relative z-10 flex items-center gap-1 font-code text-3xl font-bold text-error">
                {scan.findings_count}
                <TriangleAlert className="h-5 w-5 animate-pulse text-error" />
              </span>
            </div>
          </div>
        </div>

        {/* Terminal feed */}
        <div className="relative flex h-32 flex-col gap-0.5 overflow-hidden border-t border-outline-variant bg-[#090c10] p-3 font-code text-xs opacity-70">
          <div className="absolute bottom-0 left-0 z-10 h-8 w-full bg-gradient-to-t from-[#090c10] to-transparent" />
          {TERMINAL_LOG.slice(0, Math.min(TERMINAL_LOG.length, Math.floor(pct / 16) + 1)).map((line, i) => (
            <div key={i} className={cn("flex gap-1.5", line.startsWith("[WARN]") ? "text-tertiary" : "text-on-surface-variant")}>
              <span className={line.startsWith("[WARN]") ? "text-tertiary" : "text-secondary"}>{line.startsWith("[WARN]") ? "[WARN]" : "[INFO]"}</span>
              <span>{line.replace(/^\[(INFO|WARN)\] /, "")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/* ---------- Completed results ---------- */

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
      <StatCard label="Analyzer" value={scan.correlation ? "mock" : "—"} />
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-5">
      <p className="font-code text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
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
            <FileSearch className="mx-auto mb-2 h-8 w-8 text-on-surface-variant/50" />
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
  return (
    <TableRow>
      <TableCell>
        <Badge className={severityClass(finding.severity)}>{SEVERITY_LABELS[finding.severity]}</Badge>
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