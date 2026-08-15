"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderPlus, FolderOpen, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectDetail } from "@/components/project-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { SCAN_STATUS_LABELS, SCAN_STATUS_STYLES } from "@/lib/format";
import type { Project } from "@codesentinel/shared";

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
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Analyze a local directory or a GitHub repository. Analysis runs on your machine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <NewProjectDialog onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No projects yet. Create your first project to run a security scan.
            </p>
            <NewProjectDialog onCreated={() => setRefreshKey((k) => k + 1)} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <a key={project.id} href={`/projects?project=${project.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderPlus className="h-4 w-4 text-muted-foreground" />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{project.source_type}</Badge>
                    {project.last_scan_status && (
                      <Badge className={SCAN_STATUS_STYLES[project.last_scan_status]}>
                        {SCAN_STATUS_LABELS[project.last_scan_status]}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-muted-foreground">
                    {project.local_path ?? project.repo_url}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.scan_count} scan(s)</span>
                    <span>{project.last_scan_id ? `#${project.last_scan_id}` : "no scans yet"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Plus className="h-3 w-3" />
                    <span>Created {formatDate(project.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}