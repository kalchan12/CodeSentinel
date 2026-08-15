"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project, Scan, Severity } from "@codesentinel/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api, ApiError } from "@/lib/api";
import {
  formatDate,
  formatRiskScore,
  SCAN_STATUS_LABELS,
  SCAN_STATUS_STYLES,
  SEVERITY_LABELS,
  severityClass,
} from "@/lib/format";

export function ProjectDetail({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [projectData, scansData] = await Promise.all([
        api.getProject(projectId),
        api.listProjectScans(projectId),
      ]);
      setProject(projectData);
      setScans(scansData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load project");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function startScan() {
    setStarting(true);
    try {
      const scan = await api.createScan(projectId);
      toast.success(`Scan #${scan.id} started`);
      router.push(`/scan?scan=${scan.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start scan");
    } finally {
      setStarting(false);
    }
  }

  async function removeProject() {
    if (!window.confirm("Delete this project and all its scans?")) return;
    try {
      await api.deleteProject(projectId);
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete project");
    }
  }

  if (project === null) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{project.source_type}</Badge>
            <span className="truncate">{project.local_path ?? project.repo_url}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={removeProject}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button onClick={startScan} disabled={starting}>
            <Play className="h-4 w-4" />
            {starting ? "Starting…" : "Run new scan"}
          </Button>
        </div>
      </div>

      {scans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No scans yet. Run your first security scan to begin.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scan history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <Link
                        href={`/scan?scan=${scan.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        #{scan.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={SCAN_STATUS_STYLES[scan.status]}>
                        {SCAN_STATUS_LABELS[scan.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {scan.status === "running" ? (
                        <Progress value={scan.progress} className="w-24" />
                      ) : (
                        scan.findings_count
                      )}
                    </TableCell>
                    <TableCell>
                      {scan.risk_level ? (
                        <Badge className={severityClass(scan.risk_level as Severity)}>
                          {formatRiskScore(scan.risk_score)} ·{" "}
                          {SEVERITY_LABELS[scan.risk_level as Severity]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(scan.started_at ?? scan.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}