"use client";

/* eslint-disable react-hooks/set-state-in-effect -- polling page; state synced to fetched scan state */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileSearch, Loader2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return <ScanDashboard scan={scan} findings={findings} assessment={assessment} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter} projectId={projectId} />;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects?project=${projectId ?? scan.project_id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Project
          </Link>
          <h1 className="text-2xl font-semibold">Scan #{scan.id}</h1>
        </div>
        <StatusBadge status={scan.status} />
      </div>

      {running && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing… this may take a moment.
            </div>
            <Progress value={scan.progress} />
            <p className="text-xs text-muted-foreground">{Math.round(scan.progress)}% complete</p>
          </CardContent>
        </Card>
      )}

      {scan.status === "failed" && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Scan failed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">
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

function StatusBadge({ status }: { status: Scan["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  const labels: Record<string, string> = { pending: "Pending", running: "Running", completed: "Completed", failed: "Failed" };
  return <Badge className={styles[status] ?? styles.pending}>{labels[status] ?? status}</Badge>;
}

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
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
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Findings will appear here once the scan completes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings by category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(counts.byCategory).map(([category, count]) => (
          <div key={category} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}</span>
              <span className="text-muted-foreground">{count}</span>
            </div>
            <Progress
              value={(count / counts.total) * 100}
              className="h-1.5"
              indicatorClassName="bg-primary/80"
            />
          </div>
        ))}
        {counts.total === 0 && (
          <p className="text-sm text-muted-foreground">No findings in this scan.</p>
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
        <CardTitle>Top priorities</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ranked by risk score from the explainable codesentinel-risk-v1 model:
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full text-xs text-muted-foreground">{assessment.rationale}</div>
        {priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to fix. Nice work.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {priorities.map((item, index) => (
              <li key={item.finding_id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {index + 1}. {item.title}
                  </span>
                  <Badge className={severityClass(item.severity as Severity)}>
                    {formatRiskScore(item.score)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.file}
                </p>
                {item.remediation && (
                  <p className="mt-2 text-sm text-muted-foreground">{item.remediation}</p>
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
        <CardTitle>Findings</CardTitle>
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
        <div className="mb-3 text-sm text-muted-foreground">
          {findings?.total ?? 0} finding(s)
        </div>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileSearch className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
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
        <div className="font-medium">{finding.title}</div>
        <div className="truncate text-xs text-muted-foreground">{finding.description}</div>
        {finding.remediation && (
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            {finding.remediation}
          </div>
        )}
      </TableCell>
      <TableCell className="truncate text-muted-foreground">
        {formatLine(finding)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{finding.rule_id ?? finding.analyzer}</Badge>
      </TableCell>
    </TableRow>
  );
}