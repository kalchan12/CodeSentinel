"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project } from "@codesentinel/shared";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { api, ApiError } from "@/lib/api";
import { SCAN_STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NewScanDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (setControlledOpen ?? (() => {})) : setInternalOpen;

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .listProjects()
        .then((data) => setProjects(data))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to load projects");
          setProjects([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  async function handleStartScan(project: Project) {
    setStartingProjectId(project.id);
    try {
      const scan = await api.createScan(project.id);
      toast.success(`Scan #${scan.id} started for ${project.name}`);
      setIsOpen(false);
      router.push(`/scan?scan=${scan.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start scan");
    } finally {
      setStartingProjectId(null);
    }
  }

  const filteredProjects = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.local_path && p.local_path.toLowerCase().includes(search.toLowerCase())) ||
    (p.repo_url && p.repo_url.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-outline-variant pb-3">
          <DialogTitle className="text-xl font-bold text-on-surface font-[Inter] flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              radar
            </span>
            Run New Security Scan
          </DialogTitle>
          <DialogDescription className="text-sm text-on-surface-variant font-[Inter] mt-1">
            Select a project from your workspace to run static analysis, secrets detection, and dependency audits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 flex-1 min-h-0">
          {/* Search bar */}
          {(projects && projects.length > 0) && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-[JetBrains_Mono]"
                placeholder="Search projects by name or path..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Project list */}
          <div className="overflow-y-auto space-y-2 max-h-[420px] pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
                <p className="text-sm font-[Inter]">Loading projects...</p>
              </div>
            ) : projects && projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-2xl">folder_off</span>
                </div>
                <h4 className="text-base font-semibold text-on-surface font-[Inter]">No Projects Found</h4>
                <p className="text-xs text-on-surface-variant font-[Inter] max-w-sm">
                  Add your first local codebase or GitHub repository before launching a scan.
                </p>
                <div className="mt-2">
                  <NewProjectDialog
                    onCreated={() => {
                      api.listProjects().then(setProjects);
                    }}
                    trigger={
                      <button className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cyber-glow cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Add Project
                      </button>
                    }
                  />
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-on-surface-variant font-[Inter]">
                No projects match &ldquo;{search}&rdquo;.
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isStarting = startingProjectId === project.id;
                const isLocal = project.source_type === "local";

                return (
                  <div
                    key={project.id}
                    className="p-3 bg-surface-container border border-outline-variant rounded-xl hover:border-primary/50 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 text-primary group-hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">
                          {isLocal ? "folder_open" : "code"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-on-surface font-[Inter] truncate">
                            {project.name}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase bg-surface-container-high border border-outline-variant text-on-surface-variant">
                            {isLocal ? "Local" : "GitHub"}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-[JetBrains_Mono] truncate mt-0.5">
                          {project.local_path ?? project.repo_url}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-outline font-[JetBrains_Mono]">
                          <span>
                            {project.scan_count === 0
                              ? "Never scanned"
                              : `${project.scan_count} scan${project.scan_count > 1 ? "s" : ""} · ${
                                  project.last_scan_status
                                    ? SCAN_STATUS_LABELS[project.last_scan_status] ?? project.last_scan_status
                                    : "completed"
                                }`}
                          </span>
                          {project.last_scan_score !== null && (
                            <span className="text-secondary font-bold">
                              Score: {Math.round(project.last_scan_score)}/100
                            </span>
                          )}
                          {project.last_scan_findings_count !== null && (
                            <span className="text-error font-bold">
                              {project.last_scan_findings_count} findings
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartScan(project)}
                      disabled={isStarting || startingProjectId !== null}
                      className="shrink-0 bg-primary hover:bg-primary/90 text-on-primary font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cyber-glow disabled:opacity-50 cursor-pointer"
                    >
                      {isStarting ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          <span>Starting…</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">play_arrow</span>
                          <span>Run Scan</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-outline-variant pt-3 flex items-center justify-between mt-auto">
          <NewProjectDialog
            onCreated={() => {
              api.listProjects().then(setProjects);
            }}
            trigger={
              <button className="text-xs text-primary hover:underline font-semibold font-[Inter] flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-sm">add</span>
                Add another project
              </button>
            }
          />
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
