"use client";

/* eslint-disable react-hooks/set-state-in-effect -- polling page; state synced to fetched scan state */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { DEMO_ACTIVE_SCAN } from "@/lib/demo-data";
import { formatLine, formatRiskScore, SEVERITY_LABELS, severityClass } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS = [
  { label: "Repository Discovery", detail: "201 files indexed in 1.2s" },
  { label: "Source Analysis", detail: "AST parsing complete" },
  { label: "Secret Detection", detail: "2 high-entropy strings found", hasAlert: true },
  { label: "Dependency Analysis", detail: "Checking package.json..." },
  { label: "Report Generation", detail: "Pending" },
];

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

  const [scan, setScan] = useState<Scan | null>(scanId === null ? DEMO_ACTIVE_SCAN : null);
  const [findings, setFindings] = useState<FindingsPage | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [projectId, setProjectId] = useState<number | null>(null);

  const loadScan = useCallback(async () => {
    if (scanId === null) return;
    try {
      const data = await api.getScan(scanId);
      setScan(data);
      setProjectId(data.project_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setScan(DEMO_ACTIVE_SCAN);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Failed to load scan");
    }
  }, [scanId]);

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
    if (scanId !== null) loadScan();
  }, [loadScan, scanId]);

  const active = scanId !== null && scan !== null && (scan.status === "pending" || scan.status === "running");
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
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-xl">
          <div>
            <div className="flex items-center gap-sm mb-xs">
              <span className="material-symbols-outlined text-secondary animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
              <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">Active Scan: #CS-{scan.id}</h2>
            </div>
            <p className="text-[13px] leading-[18px] text-on-surface-variant flex items-center gap-sm font-[Inter]">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary pulse-active" />
              Scan ID #CS-{scan.id} · Initiated locally · {scan.started_at ? "00:02:41 elapsed" : "starting..."}
            </p>
          </div>
          <button className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-lg bg-surface-container text-error hover:bg-surface-container-high transition-colors text-[18px] leading-[24px] font-semibold font-[Inter]">
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            Abort Scan
          </button>
        </div>

        <div className="mb-xl bg-surface-container-low border border-outline-variant rounded-xl p-md">
          <div className="flex justify-between items-end mb-sm">
            <div className="flex items-center gap-sm">
              <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">Global Pipeline Progress</span>
            </div>
            <span className="text-[13px] leading-[20px] text-secondary font-bold font-[JetBrains_Mono]">{Math.round(scan.progress)}%</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-secondary progress-glow transition-all duration-1000 ease-out" style={{ width: `${scan.progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg h-[500px]">
          <div className="lg:col-span-8 flex flex-col gap-lg h-full">
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col relative shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                <div className="bg-surface-container-high border-b border-outline-variant px-md py-sm flex justify-between items-center z-10">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-on-surface-variant text-[16px]">code</span>
                    <span className="text-[11px] leading-[16px] text-on-surface font-[JetBrains_Mono]">src/api/auth.py</span>
                  </div>
                  <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-secondary flex items-center gap-xs font-[JetBrains_Mono]">
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  ANALYZING
                </span>
              </div>
              <div className="flex-1 p-md overflow-hidden relative text-[13px] leading-[20px] text-on-surface-variant whitespace-pre font-[JetBrains_Mono] bg-background">
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  <div className="w-full h-16 scanner-beam absolute top-0 left-0" />
                </div>
                <div className="flex h-full">
                  <div className="w-8 flex-shrink-0 text-on-surface-variant opacity-30 select-none text-right pr-sm border-r border-outline-variant h-full mr-sm text-[11px] leading-[16px] font-[JetBrains_Mono]">
                    42<br/>43<br/>44<br/>45<br/>46<br/>47<br/>48<br/>49<br/>50<br/>51<br/>52<br/>53<br/>54
                  </div>
                  <div className="flex-1 text-on-surface-variant whitespace-pre text-[11px] leading-[16px] overflow-hidden font-[JetBrains_Mono]">
                    <span className="text-primary-fixed">def</span> <span className="text-secondary-fixed">validate_jwt</span>(token: str):
                    <span className="text-outline"># Decode the incoming token</span>
                    <span className="text-primary-fixed">try</span>:
                        payload = jwt.decode(
                            token, 
                            <span className="bg-error-container/20 text-error border-b border-error/50 pb-[1px]">os.getenv(&#34;JWT_SECRET_KEY&#34;, &#34;&lt;redacted&gt;&#34;)</span>, 
                            algorithms=[<span className="text-tertiary-fixed">&#34;HS256&#34;</span>]
                        )
                        <span className="text-primary-fixed">return</span> payload
                    <span className="text-primary-fixed">except</span> jwt.ExpiredSignatureError:
                        <span className="text-primary-fixed">raise</span> HTTPException(status_code=401, detail=<span className="text-tertiary-fixed">&#34;Token expired&#34;</span>)
                    <span className="text-primary-fixed">except</span> jwt.InvalidTokenError:
                        <span className="text-primary-fixed">raise</span> HTTPException(status_code=401, detail=<span className="text-tertiary-fixed">&#34;Invalid token&#34;</span>)
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-sm">
              <MetricCard label="FILES" value="84" total="/201" />
              <MetricCard label="FINDINGS" value={scan.findings_count} color="tertiary" />
              <MetricCard label="SECRETS" value="2" color="error" />
              <MetricCard label="DEPENDENCIES" value="38" />
            </div>
          </div>
          <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant rounded-xl p-lg flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface mb-xl flex items-center gap-sm font-[Inter]">
              <span className="material-symbols-outlined">checklist</span>
              Live Pipeline
            </h3>
            <div className="flex-1 relative">
              <div className="absolute left-[11px] top-4 bottom-8 w-[2px] bg-outline-variant" />
              <div className="flex flex-col gap-lg relative z-10">
                {PIPELINE_STEPS.map((step, index) => (
                  <PipelineStep
                    key={step.label}
                    label={step.label}
                    detail={step.detail}
                    hasAlert={step.hasAlert}
                    done={index < 3}
                    current={index === 3 && scan.status === "running"}
                    pending={index > 3}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-sm mb-xl">
        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
        <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
          Scan Completed: #CS-{scan.id}
        </h2>
      </div>
      <SummaryCards scan={scan} findingCount={findings?.total ?? 0} assessment={assessment} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SeverityDistribution scan={scan} />
        {assessment && <Priorities assessment={assessment} />}
      </div>
      <FindingsTable findings={findings} severityFilter={severityFilter} setSeverityFilter={setSeverityFilter} />
    </div>
  );
}

function PipelineStep({
  label,
  detail,
  hasAlert,
  done,
  current,
  pending,
}: {
  label: string;
  detail: string;
  hasAlert?: boolean;
  done: boolean;
  current: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex gap-md">
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1", done ? "bg-surface border-2 border-primary" : current ? "bg-secondary pulse-active border-2 border-background" : "bg-surface border-2 border-outline-variant")}>
        {done ? (
          <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
        ) : !current ? (
          <span className="material-symbols-outlined text-[14px] text-outline">radio_button_unchecked</span>
        ) : null}
      </div>
      <div>
        <h4 className={cn("text-[14px] leading-[20px] font-semibold font-[Inter]", done ? "text-on-surface" : current ? "text-secondary font-bold" : pending ? "text-on-surface-variant" : "text-on-surface")}>
          {label}
        </h4>
        <p className={cn("text-[13px] leading-[18px] mt-xs font-[Inter]", hasAlert && done ? "text-error" : done ? "text-on-surface-variant" : current ? "text-secondary font-[JetBrains_Mono] text-[11px] leading-[16px] flex items-center gap-xs" : "text-outline")}>
          {current && <span className="material-symbols-outlined text-[12px] animate-spin">refresh</span>}
          {detail}
        </p>
      </div>
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
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
      <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
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
            <span className="material-symbols-outlined mx-auto mb-2 h-8 w-8 text-on-surface-variant/50">search</span>
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
  const severityColors: Record<Severity, { bg: string; text: string; border: string }> = {
    critical: { bg: "bg-error/15", text: "text-error", border: "border-error" },
    high: { bg: "bg-tertiary/15", text: "text-tertiary", border: "border-tertiary" },
    medium: { bg: "bg-secondary/15", text: "text-secondary", border: "border-secondary" },
    low: { bg: "bg-outline/15", text: "text-on-surface-variant", border: "border-outline" },
    info: { bg: "bg-outline-variant/15", text: "text-on-surface-variant", border: "border-outline-variant" },
  };
  const colors = severityColors[finding.severity];

  return (
    <TableRow>
      <TableCell>
        <Badge className={cn(severityClass(finding.severity), colors.bg, colors.text, colors.border)}>{SEVERITY_LABELS[finding.severity]}</Badge>
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

function MetricCard({ label, value, color, total }: { label: string; value: number | string; color?: string; total?: string }) {
  const bgColor = color === "tertiary" ? "bg-tertiary/10" : color === "error" ? "bg-error/10" : color === "secondary" ? "bg-secondary/10" : "bg-primary/10";
  const borderColor = color === "tertiary" ? "border-l-2 border-l-tertiary" : color === "error" ? "border-l-2 border-l-error" : "";
  const valueColor = color === "tertiary" ? "text-tertiary" : color === "error" ? "text-error" : "text-on-surface";
  return (
    <div className={cn("bg-surface-container-low border border-outline-variant rounded-xl p-md relative overflow-hidden group", borderColor)}>
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity", bgColor)} />
      <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] block mb-xs">{label}</span>
      <div className="flex items-end gap-xs">
        <span className={cn("text-[32px] leading-[40px] tracking-[-0.02em] font-bold font-[Inter]", valueColor)}>{value}</span>
        {total && <span className="text-[11px] leading-[16px] text-on-surface-variant pb-1 font-[JetBrains_Mono]">{total}</span>}
      </div>
    </div>
  );
}
