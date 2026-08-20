"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@codesentinel/shared";

import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectDetail } from "@/components/project-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
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
  return <ProjectList />;
}

function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setProjects(await api.listProjects());
    } catch (error) {
      toast.error(`Could not reach the CodeSentinel API: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (projects === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Projects</h1>
          <p className="text-sm text-on-surface-variant">
            Analyze a local directory or a GitHub repository. Analysis runs on your machine.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-lg border border-outline-variant bg-surface-container p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <NewProjectDialog onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container py-16 text-center">
          <FolderOpen className="h-10 w-10 text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">
            No projects yet. Create your first project to run a security scan.
          </p>
          <NewProjectDialog onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <a key={project.id} href={`/projects?project=${project.id}`} className="group">
              <div className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container p-5 transition-all group-hover:border-primary/50">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-surface-bright text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <h2 className="truncate text-base font-semibold text-on-surface">{project.name}</h2>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 font-code text-[10px] font-bold text-on-surface-variant uppercase">
                      {project.source_type}
                    </span>
                    {project.last_scan_status && (
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 font-code text-[10px] font-bold",
                          SCAN_STATUS_STYLES[project.last_scan_status]
                        )}
                      >
                        {SCAN_STATUS_LABELS[project.last_scan_status]}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-code text-xs text-on-surface-variant">
                    {project.local_path ?? project.repo_url}
                  </p>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>{project.scan_count} scan(s)</span>
                    <span>{project.last_scan_id ? `#${project.last_scan_id}` : "no scans yet"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <Plus className="h-3 w-3" />
                    <span>Created {formatDate(project.created_at)}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}