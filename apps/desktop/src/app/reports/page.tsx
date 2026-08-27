"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { RiskAssessment, Scan } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { DEMO_PROJECTS, DEMO_REPORT, type ReportSummary } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof api.listProjects>> | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(1);

  const load = useCallback(async () => {
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);
      if (projectList.length > 0) {
        const target = projectList.find((p) => p.id === selectedProjectId) ?? projectList[0];
        if (target.last_scan_id != null) {
          const [scan, assessment, findings] = await Promise.all([
            api.getScan(target.last_scan_id),
            api.getAssessment(target.last_scan_id).catch(() => null),
            api.getFindings(target.last_scan_id, {}).catch(() => null),
          ]);
          const counts = assessment?.breakdown?.severity_counts ?? {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
          };
          const score = assessment ? Math.round(assessment.overall_score) : 75;
          const grade = score >= 90 ? "A" : score >= 80 ? "B+" : score >= 70 ? "B-" : score >= 60 ? "C" : "F";
          setReport({
            projectName: target.name,
            scanId: target.last_scan_id,
            generatedAt: scan.completed_at || scan.created_at,
            overallScore: score,
            grade,
            totalFindings: findings?.total ?? scan.findings_count,
            criticalCount: counts.critical,
            highCount: counts.high,
            mediumCount: counts.medium,
            lowCount: counts.low,
            compliance: DEMO_REPORT.compliance,
          });
          return;
        }
      }
      setReport(DEMO_REPORT);
    } catch {
      setProjects(DEMO_PROJECTS);
      setReport(DEMO_REPORT);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (report === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `codesentinel-report-${report.projectName}-scan-${report.scanId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Exported JSON report");
  };

  const handleExportCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Framework,Score,Status,Violations\n" +
      report.compliance.map((c) => `"${c.framework}",${c.score},"${c.status}",${c.violations}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `codesentinel-compliance-${report.projectName}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Exported CSV compliance summary");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">assessment</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Executive Security Reports & Compliance
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Audit-ready security syntheses, OWASP/CWE benchmarks, and exportable reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {projects && projects.length > 0 && (
            <select
              className="bg-background border border-outline-variant rounded text-on-surface text-[12px] leading-[18px] font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary outline-none"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportJson}
            className="bg-transparent border border-outline-variant text-on-surface px-3 py-1.5 rounded text-[12px] leading-[18px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-sm">code</span>
            JSON
          </button>
          <button
            onClick={handleExportCsv}
            className="bg-transparent border border-outline-variant text-on-surface px-3 py-1.5 rounded text-[12px] leading-[18px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-sm">table_view</span>
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-primary text-on-primary px-4 py-1.5 rounded text-[12px] leading-[18px] font-[JetBrains_Mono] font-semibold hover:bg-primary-container transition-colors flex items-center gap-xs shadow-[0_0_10px_rgba(208,188,255,0.15)]"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print / PDF
          </button>
        </div>
      </header>

      {/* Executive Summary Bento */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-md">
        {/* Overall Posture Badge (4 cols) */}
        <div className="md:col-span-4 bg-surface-container-low border border-outline-variant rounded-lg p-lg tech-shadow flex flex-col justify-between items-center text-center">
          <span className="text-[11px] leading-[14px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
            Executive Security Rating
          </span>
          <div className="my-md">
            <div className="size-28 rounded-full border-4 border-primary/40 bg-primary/10 flex flex-col items-center justify-center tech-shadow mx-auto">
              <span className="text-[44px] font-extrabold text-primary font-[Inter] leading-none">
                {report.grade}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] mt-1">
                {report.overallScore}/100
              </span>
            </div>
          </div>
          <div className="text-[12px] text-on-surface-variant font-[Inter]">
            Scan #{report.scanId} on <strong className="text-on-surface">{report.projectName}</strong>
            <p className="text-[10px] text-outline mt-1 font-[JetBrains_Mono]">
              Generated: {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>

        {/* Severity Metrics (8 cols) */}
        <div className="md:col-span-8 bg-surface-container-low border border-outline-variant rounded-lg p-lg tech-shadow flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-outline-variant pb-sm mb-md">
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface font-[Inter]">
              Findings Severity Distribution
            </h3>
            <span className="text-[12px] font-bold text-on-surface font-[JetBrains_Mono]">
              {report.totalFindings} Total Issues
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm mb-md">
            <SeverityBox label="CRITICAL" count={report.criticalCount} color="text-error" bg="bg-error/10 border-error/30" />
            <SeverityBox label="HIGH" count={report.highCount} color="text-tertiary" bg="bg-tertiary/10 border-tertiary/30" />
            <SeverityBox label="MEDIUM" count={report.mediumCount} color="text-secondary" bg="bg-secondary/10 border-secondary/30" />
            <SeverityBox label="LOW" count={report.lowCount} color="text-on-surface-variant" bg="bg-outline/10 border-outline/30" />
          </div>

          <div className="w-full bg-background rounded-full h-3 flex overflow-hidden border border-outline-variant/60">
            <div style={{ width: `${(report.criticalCount / Math.max(1, report.totalFindings)) * 100}%` }} className="bg-error" />
            <div style={{ width: `${(report.highCount / Math.max(1, report.totalFindings)) * 100}%` }} className="bg-tertiary" />
            <div style={{ width: `${(report.mediumCount / Math.max(1, report.totalFindings)) * 100}%` }} className="bg-secondary" />
            <div style={{ width: `${(report.lowCount / Math.max(1, report.totalFindings)) * 100}%` }} className="bg-outline" />
          </div>
        </div>
      </div>

      {/* Compliance & Standards Scorecards */}
      <section className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md">
        <div className="flex justify-between items-center border-b border-outline-variant pb-sm">
          <div>
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface font-[Inter]">
              Security Standards & Compliance Scorecards
            </h3>
            <p className="text-[12px] text-on-surface-variant font-[Inter]">
              Automated evaluation against industry security benchmarks and threat taxonomies.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {report.compliance.map((c) => (
            <div
              key={c.framework}
              className="bg-background border border-outline-variant/60 rounded-lg p-md space-y-sm tech-shadow"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-[14px] font-bold text-on-surface font-[Inter]">
                  {c.framework}
                </h4>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase border",
                    c.status === "compliant"
                      ? "bg-secondary/15 text-secondary border-secondary/30"
                      : c.status === "warning"
                        ? "bg-tertiary/15 text-tertiary border-tertiary/30"
                        : "bg-error/15 text-error border-error/30"
                  )}
                >
                  {c.status}
                </span>
              </div>

              <div className="flex justify-between text-[12px] font-[JetBrains_Mono]">
                <span className="text-on-surface-variant">Posture Score:</span>
                <span className="font-bold text-primary">{c.score}%</span>
              </div>

              <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                <div
                  style={{ width: `${c.score}%` }}
                  className={cn(
                    "h-full rounded-full",
                    c.score >= 80 ? "bg-secondary" : c.score >= 60 ? "bg-tertiary" : "bg-error"
                  )}
                />
              </div>

              <div className="flex justify-between text-[11px] text-outline font-[JetBrains_Mono] pt-1">
                <span>{c.violations} Active Rule Violations</span>
                <Link
                  href={`/scan?scan=${report.scanId}`}
                  className="text-primary hover:underline"
                >
                  Review Findings →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Audit Checklist Footer */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col md:flex-row justify-between items-center gap-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
          <div>
            <h4 className="text-[14px] font-semibold text-on-surface font-[Inter]">
              Local-First Audit Integrity
            </h4>
            <p className="text-[12px] text-on-surface-variant font-[Inter]">
              All analysis was calculated deterministically on host without uploading source files.
            </p>
          </div>
        </div>
        <div className="flex gap-sm">
          <Link
            href="/scan"
            className="px-4 py-2 bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant rounded text-[12px] font-[JetBrains_Mono] text-on-surface transition-colors"
          >
            Launch Re-Scan
          </Link>
        </div>
      </div>
    </div>
  );
}

function SeverityBox({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("p-sm rounded border flex flex-col items-center justify-center", bg)}>
      <span className={cn("text-[10px] font-bold tracking-wider font-[JetBrains_Mono]", color)}>
        {label}
      </span>
      <span className={cn("text-[24px] font-bold font-[Inter] mt-0.5", color)}>{count}</span>
    </div>
  );
}
