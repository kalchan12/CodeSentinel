"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Project } from "@codesentinel/shared";

import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectDetail } from "@/components/project-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, SCAN_STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_BG: Record<string, string> = {
  error: "bg-error/20",
  tertiary: "bg-tertiary/20",
  secondary: "bg-secondary/20",
};

const SEVERITY_BORDER: Record<string, string> = {
  error: "border-error/50",
  tertiary: "border-tertiary/50",
  secondary: "border-secondary/50",
};

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
      <div className="flex justify-between items-end mb-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Projects</h2>
          <p className="text-on-surface-variant text-body-sm font-body-sm">Manage and monitor your security targets.</p>
        </div>
        <NewProjectDialog onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-lg">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <AddProjectGhostCard />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const score = project.last_scan_status === "completed" ? 85 : 72;
  const scoreColor = score >= 85 ? "text-secondary" : "text-tertiary";
  const findings = project.last_scan_status === "completed" ? {
    critical: 2,
    high: 4,
    medium: 6,
  } : { critical: 0, high: 0, medium: 0 };

  return (
    <div className="bg-card border border-outline-variant rounded-xl p-lg tech-shadow hover:border-primary/50 transition-colors group cursor-pointer relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />
      <div className="flex justify-between items-start mb-md relative z-10">
        <div className="flex items-center gap-sm">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant text-primary">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div>
            <h3 className="font-title-sm text-title-sm text-on-background group-hover:text-primary transition-colors">{project.name}</h3>
            <p className="text-on-surface-variant text-body-sm font-body-sm">{project.repo_url ?? `local: ${project.local_path}`}</p>
          </div>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-md mb-lg relative z-10">
        <div className="bg-[#080A0F] border border-outline-variant rounded-lg p-sm">
          <span className="text-on-surface-variant font-label-caps text-label-caps uppercase block mb-1">Tech Stack</span>
          <span className="font-code-base text-code-base text-secondary">Python · FastAPI</span>
        </div>
        <div className="bg-[#080A0F] border border-outline-variant rounded-lg p-sm flex items-center justify-between">
          <span className="text-on-surface-variant font-label-caps text-label-caps uppercase">Security Score</span>
          <div className="flex items-center gap-1">
            <span className={cn("font-code-base text-code-base", score >= 85 ? "text-secondary" : "text-tertiary")}>{score}</span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">/100</span>
          </div>
        </div>
      </div>
      <div className="mb-md relative z-10">
        <span className="text-on-surface-variant font-label-caps text-label-caps uppercase block mb-2">Findings</span>
        <div className="flex gap-2">
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded border", "bg-error/20", "border-error/50")}>
            <span className="w-2 h-2 rounded-full bg-error" />
            <span className="font-label-caps text-label-caps text-error">{findings.critical} CRIT</span>
          </div>
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded border", "bg-tertiary/20", "border-tertiary/50")}>
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            <span className="font-label-caps text-label-caps text-tertiary">{findings.high} HIGH</span>
          </div>
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded border", "bg-secondary/20", "border-secondary/50")}>
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-caps text-label-caps text-secondary">{findings.medium} MED</span>
          </div>
        </div>
      </div>
      <div className="border-t border-outline-variant pt-sm mt-md flex justify-between items-center relative z-10">
        <div className="flex items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">history</span>
          <span className="font-code-sm text-code-sm">Last scan: {project.last_scan_status ? "12m ago" : "never"}</span>
        </div>
        <span className="text-primary font-body-sm text-body-sm group-hover:underline">View Details →</span>
      </div>
    </div>
  );
}

function AddProjectGhostCard() {
  return (
    <div className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[280px]">
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-md text-on-surface-variant">
        <span className="material-symbols-outlined text-[24px]">add</span>
      </div>
      <h3 className="font-title-sm text-title-sm text-on-surface mb-xs">New Project</h3>
      <p className="text-on-surface-variant text-body-sm font-body-sm max-w-[200px]">Connect a repository or upload local source code.</p>
      <NewProjectDialog onCreated={() => window.location.reload()} />
    </div>
  );
}