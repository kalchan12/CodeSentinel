"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Project } from "@codesentinel/shared";

import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectDetail } from "@/components/project-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { DEMO_PROJECTS } from "@/lib/demo-data";
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
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (projects === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="flex justify-between items-end mb-lg">
        <div>
          <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface mb-xs font-[Inter]">Projects</h2>
          <p className="text-on-surface-variant text-[13px] leading-[18px] font-[Inter]">Manage and monitor your security targets.</p>
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
  const router = useRouter();
  const score = project.last_scan_score !== null ? Math.round(project.last_scan_score) : "—";
  const findingsCount = project.last_scan_findings_count ?? 0;

  return (
    <div 
      onClick={() => router.push(`?project=${project.id}`)}
      className="bg-surface-container-low border border-outline-variant rounded-xl p-lg tech-shadow hover:border-primary/50 transition-colors group cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />
      <div className="flex justify-between items-start mb-md relative z-10">
        <div className="flex items-center gap-sm">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant text-primary">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div>
            <h3 className="text-[18px] leading-[24px] font-semibold text-on-background group-hover:text-primary transition-colors font-[Inter]">{project.name}</h3>
            <p className="text-on-surface-variant text-[13px] leading-[18px] font-[Inter]">{project.repo_url ?? `local: ${project.local_path}`}</p>
          </div>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-md mb-lg relative z-10">
        <div className="bg-background border border-outline-variant rounded-lg p-sm">
          <span className="text-on-surface-variant text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono] uppercase block mb-1">Tech Stack</span>
          <span className="text-[13px] leading-[20px] text-secondary font-[JetBrains_Mono]">Python &middot; FastAPI</span>
        </div>
        <div className="bg-background border border-outline-variant rounded-lg p-sm flex items-center justify-between">
          <span className="text-on-surface-variant text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono] uppercase">Security Score</span>
          <div className="flex items-center gap-1">
            <span className={cn("text-[13px] leading-[20px] font-[JetBrains_Mono]", project.last_scan_score && project.last_scan_score >= 85 ? "text-secondary" : "text-tertiary")}>{score}</span>
            <span className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">/100</span>
          </div>
        </div>
      </div>
      <div className="mb-md relative z-10">
        <span className="text-on-surface-variant text-[10px] leading-[12px] tracking-[0.08em] font-bold font-[JetBrains_Mono] uppercase block mb-2">Findings</span>
        <div className="flex gap-2">
          {project.last_scan_status ? (
            <div className="flex items-center gap-1 bg-primary/20 px-2 py-1 rounded border border-primary/50">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-primary font-[JetBrains_Mono]">{findingsCount} TOTAL</span>
            </div>
          ) : (
            <span className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono]">No scans yet</span>
          )}
        </div>
      </div>
      <div className="border-t border-outline-variant pt-sm mt-md flex justify-between items-center relative z-10">
        <div className="flex items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">history</span>
          <span className="text-[11px] leading-[16px] font-[JetBrains_Mono]">Last scan: {project.last_scan_status ? project.last_scan_status : "never"}</span>
        </div>
        <span className="text-primary text-[13px] leading-[18px] font-[Inter] group-hover:underline">View Details &rarr;</span>
      </div>
    </div>
  );
}

function AddProjectGhostCard() {
  return (
    <NewProjectDialog
      onCreated={() => window.location.reload()}
      trigger={
        <button
          type="button"
          className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[280px] group w-full outline-none focus:border-primary"
        >
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-md text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[24px]">add</span>
          </div>
          <h3 className="text-[18px] leading-[24px] font-semibold text-on-surface mb-xs font-[Inter] group-hover:text-primary transition-colors">
            New Project
          </h3>
          <p className="text-on-surface-variant text-[13px] leading-[18px] font-[Inter] max-w-[200px]">
            Connect a repository or upload local source code.
          </p>
        </button>
      }
    />
  );
}
