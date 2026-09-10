"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Project, Scan } from "@codesentinel/shared";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewScanDialog } from "@/components/new-scan-dialog";
import { ProjectDetail } from "@/components/project-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatDate, SCAN_STATUS_LABELS, SCAN_STATUS_STYLES } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get("project")) || null;

  if (projectId) {
    return <ProjectDetail projectId={projectId} />;
  }
  return <ProjectsAndScansHub />;
}

interface ScanWithProject {
  scan: Scan;
  projectName: string;
  projectSource: string;
}

function ProjectsAndScansHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "scans" ? "scans" : "projects";

  const [activeTab, setActiveTab] = useState<"projects" | "scans">(initialTab);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [allScans, setAllScans] = useState<ScanWithProject[] | null>(null);
  const [loadingScans, setLoadingScans] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  useEffect(() => {
    if (activeTab === "scans" && projects && projects.length > 0) {
      setLoadingScans(true);
      Promise.all(
        projects.map(async (project) => {
          try {
            const projectScans = await api.listProjectScans(project.id);
            return projectScans.map((s) => ({
              scan: s,
              projectName: project.name,
              projectSource: project.source_type,
            }));
          } catch {
            return [];
          }
        })
      )
        .then((nested) => {
          const flat = nested.flat().sort((a, b) => {
            const timeA = new Date(a.scan.started_at || a.scan.created_at || 0).getTime();
            const timeB = new Date(b.scan.started_at || b.scan.created_at || 0).getTime();
            return timeB - timeA;
          });
          setAllScans(flat);
        })
        .finally(() => setLoadingScans(false));
    }
  }, [activeTab, projects]);

  async function handleQuickScan(project: Project) {
    setStartingProjectId(project.id);
    try {
      toast.info(`Starting security scan for ${project.name}...`);
      const scan = await api.createScan(project.id);
      toast.success(`Scan #${scan.id} launched`);
      router.push(`/scan?scan=${scan.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to launch scan");
      setStartingProjectId(null);
    }
  }

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.repo_url?.toLowerCase().includes(q) ||
        p.local_path?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const filteredScans = useMemo(() => {
    if (!allScans) return [];
    if (!search.trim()) return allScans;
    const q = search.toLowerCase();
    return allScans.filter(
      (item) =>
        item.projectName.toLowerCase().includes(q) ||
        String(item.scan.id).includes(q) ||
        item.scan.status.toLowerCase().includes(q)
    );
  }, [allScans, search]);

  if (projects === null) {
    return (
      <div className="max-w-[1440px] mx-auto space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Header with Title and Unified Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 pb-4 border-b border-outline-variant/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="material-symbols-outlined text-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              folder_open
            </span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Projects & Scans
            </h2>
          </div>
          <p className="text-on-surface-variant text-[13px] leading-[18px] font-[Inter]">
            Manage source repositories, launch on-demand scans, and inspect security health in one unified workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NewScanDialog
            trigger={
              <button className="bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-primary text-[18px]">radar</span>
                Quick Scan
              </button>
            }
          />
          <NewProjectDialog
            onCreated={() => setRefreshKey((k) => k + 1)}
            trigger={
              <button className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cyber-glow cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Project
              </button>
            }
          />
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-surface-container-low border border-outline-variant rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("projects")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "projects"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            Projects
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-[JetBrains_Mono] font-bold",
                activeTab === "projects" ? "bg-white/20 text-white" : "bg-surface-container text-on-surface-variant"
              )}
            >
              {projects.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("scans")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "scans"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">radar</span>
            Scan History
            {allScans && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-[JetBrains_Mono] font-bold",
                  activeTab === "scans" ? "bg-white/20 text-white" : "bg-surface-container text-on-surface-variant"
                )}
              >
                {allScans.length}
              </span>
            )}
          </button>
        </div>

        <div className="w-full sm:w-72">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              search
            </span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === "projects" ? "Filter projects..." : "Filter scans..."}
              className="pl-9 h-9 bg-surface-container-low border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant/60"
            />
          </div>
        </div>
      </div>

      {/* Projects Grid Tab */}
      {activeTab === "projects" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isScanning={startingProjectId === project.id}
              onRunScan={() => handleQuickScan(project)}
            />
          ))}
          <AddProjectGhostCard onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}

      {/* Scans Timeline Tab */}
      {activeTab === "scans" && (
        <div className="space-y-4">
          {loadingScans ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mx-auto">
                <span className="material-symbols-outlined text-[28px]">radar</span>
              </div>
              <h3 className="text-lg font-semibold text-on-surface font-[Inter]">No Scans Recorded</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto font-[Inter]">
                Run your first security scan on one of your target projects to generate vulnerability reports.
              </p>
              {projects.length > 0 && (
                <button
                  onClick={() => handleQuickScan(projects[0])}
                  className="bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 cyber-glow cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  Scan {projects[0].name}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
              <div className="divide-y divide-outline-variant/50">
                {filteredScans.map(({ scan, projectName, projectSource }) => {
                  const statusStyle =
                    SCAN_STATUS_STYLES[scan.status] ??
                    "bg-surface-container text-on-surface-variant border-outline-variant";
                  const statusLabel = SCAN_STATUS_LABELS[scan.status] ?? scan.status;

                  return (
                    <div
                      key={scan.id}
                      className="p-4 hover:bg-surface-container/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 text-primary group-hover:border-primary/50 transition-colors">
                          <span className="material-symbols-outlined text-[20px]">radar</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-on-surface font-[Inter]">
                              {projectName}
                            </span>
                            <span className="text-xs text-on-surface-variant font-[JetBrains_Mono]">
                              Scan #{scan.id}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase border",
                                statusStyle
                              )}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1 font-[JetBrains_Mono]">
                            <span className="capitalize">{projectSource}</span>
                            <span>•</span>
                            <span>{formatDate(scan.started_at || scan.created_at)}</span>
                            {scan.findings_count !== undefined && (
                              <>
                                <span>•</span>
                                <span className={cn(scan.findings_count > 0 ? "text-error" : "text-secondary")}>
                                  {scan.findings_count} {scan.findings_count === 1 ? "finding" : "findings"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <Link
                          href={`/scan?scan=${scan.id}`}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-container border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          {scan.status === "completed" ? "Inspect Findings" : "View Live Progress"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isScanning,
  onRunScan,
}: {
  project: Project;
  isScanning: boolean;
  onRunScan: () => void;
}) {
  const router = useRouter();
  const score = project.last_scan_score !== null ? Math.round(project.last_scan_score) : "—";
  const findingsCount = project.last_scan_findings_count ?? 0;

  return (
    <div
      onClick={() => router.push(`?project=${project.id}`)}
      className="bg-surface-container-low border border-outline-variant rounded-xl p-5 tech-shadow hover:border-primary/50 transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />

      <div>
        {/* Card Header */}
        <div className="flex justify-between items-start mb-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant text-primary shrink-0 group-hover:border-primary/50 transition-colors">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] leading-[22px] font-semibold text-on-background group-hover:text-primary transition-colors font-[Inter] truncate">
                {project.name}
              </h3>
              <p className="text-on-surface-variant text-[12px] leading-[16px] font-[Inter] truncate max-w-[200px]">
                {project.repo_url ?? `local: ${project.local_path}`}
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold font-[JetBrains_Mono] uppercase px-2 py-0.5 rounded border border-outline-variant bg-surface-container text-on-surface-variant shrink-0">
            {project.source_type === "github" ? "GitHub" : "Local"}
          </span>
        </div>

        {/* Metrics Box */}
        <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
          <div className="bg-background/80 border border-outline-variant rounded-lg p-2.5">
            <span className="text-on-surface-variant text-[10px] font-bold font-[JetBrains_Mono] uppercase block mb-1">
              Security Score
            </span>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[15px] font-bold font-[JetBrains_Mono]",
                  typeof project.last_scan_score === "number" && project.last_scan_score >= 85
                    ? "text-secondary"
                    : typeof project.last_scan_score === "number"
                    ? "text-tertiary"
                    : "text-on-surface-variant"
                )}
              >
                {score}
              </span>
              <span className="text-[10px] text-on-surface-variant font-[JetBrains_Mono]">/100</span>
            </div>
          </div>

          <div className="bg-background/80 border border-outline-variant rounded-lg p-2.5">
            <span className="text-on-surface-variant text-[10px] font-bold font-[JetBrains_Mono] uppercase block mb-1">
              Issues
            </span>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[15px] font-bold font-[JetBrains_Mono]",
                  findingsCount > 0 ? "text-error" : "text-secondary"
                )}
              >
                {project.last_scan_status ? findingsCount : "—"}
              </span>
              <span className="text-[10px] text-on-surface-variant font-[JetBrains_Mono]">total</span>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-between text-xs text-on-surface-variant mb-4 font-[JetBrains_Mono]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">history</span>
            <span className="text-[11px]">
              Last scan:{" "}
              {project.last_scan_status ? (
                <span className="text-on-surface font-semibold capitalize">{project.last_scan_status}</span>
              ) : (
                "Never"
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: 1-Click Scan vs View Details */}
      <div
        className="pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={isScanning}
          onClick={onRunScan}
          className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cyber-glow disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {isScanning ? (
            <>
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              <span>Scanning…</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px]">bolt</span>
              <span>Run Scan</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          {project.last_scan_id && (
            <Link
              href={`/scan?scan=${project.last_scan_id}`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              <span>Findings</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => router.push(`?project=${project.id}`)}
            className="text-xs text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container"
            title="Project Details & Settings"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProjectGhostCard({ onCreated }: { onCreated: () => void }) {
  return (
    <NewProjectDialog
      onCreated={onCreated}
      trigger={
        <button
          type="button"
          className="border-2 border-dashed border-outline-variant rounded-xl p-5 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[240px] group w-full outline-none focus:border-primary"
        >
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3 text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">add</span>
          </div>
          <h3 className="text-[16px] leading-[22px] font-semibold text-on-surface mb-1 font-[Inter] group-hover:text-primary transition-colors">
            New Project
          </h3>
          <p className="text-on-surface-variant text-[12px] leading-[16px] font-[Inter] max-w-[200px]">
            Connect local workspace or git repository to start scanning.
          </p>
        </button>
      }
    />
  );
}

