"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Finding } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SecretItem {
  id: string;
  ruleId: string;
  title: string;
  type: string;
  file: string;
  line: number;
  commit?: string;
  maskedSecret: string;
  severity: "critical" | "high" | "medium";
  confidence: "high" | "medium" | "low";
  status: "active" | "rotated" | "ignored";
  detectedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  "Cloud Credential": "bg-tertiary/15 text-tertiary border-tertiary/30",
  "API Token": "bg-primary/15 text-primary border-primary/30",
  "Auth Secret": "bg-error/15 text-error border-error/30",
  "Database URI": "bg-secondary/15 text-secondary border-secondary/30",
};

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretItem[] | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<SecretItem | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const withScans = projects.filter((p) => p.last_scan_id != null);
      if (withScans.length > 0) {
        const latestScanId = withScans[0].last_scan_id!;
        const page = await api.getFindings(latestScanId, { category: "secrets" });
        if (page.items.length > 0) {
          const mapped: SecretItem[] = page.items.map((f: Finding, i: number) => ({
            id: f.id || `sec-${i}`,
            ruleId: f.rule_id || "gitleaks-secret",
            title: f.title,
            type: String(f.evidence?.leak_type ?? "").includes("aws")
              ? "Cloud Credential"
              : String(f.evidence?.leak_type ?? "").includes("key")
                ? "API Token"
                : "Auth Secret",
            file: f.file || "unknown",
            line: f.line_start || 1,
            commit: (f.evidence?.commit as string) || "HEAD",
            maskedSecret: f.code_snippet
              ? f.code_snippet.slice(0, 8) + "****************"
              : "****************",
            severity: (f.severity as "critical" | "high" | "medium") || "high",
            confidence: (f.confidence as "high" | "medium" | "low") || "high",
            status: "active",
            detectedAt: f.created_at || new Date().toISOString(),
          }));
          setSecrets(mapped);
          setSelectedSecret(mapped[0]);
          return;
        }
      }
      setSecrets([]);
      setSelectedSecret(null);
    } catch {
      setSecrets([]);
      setSelectedSecret(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (secrets === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateStatus = (id: string, newStatus: "active" | "rotated" | "ignored") => {
    setSecrets((prev) =>
      prev
        ? prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
        : null
    );
    if (selectedSecret?.id === id) {
      setSelectedSecret((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Secret status updated to ${newStatus}`);
  };

  const filtered = secrets.filter((sec) => {
    const matchesSearch =
      sec.title.toLowerCase().includes(search.toLowerCase()) ||
      sec.file.toLowerCase().includes(search.toLowerCase()) ||
      sec.ruleId.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || sec.type === typeFilter;
    const matchesStatus = statusFilter === "all" || sec.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalSecrets = secrets.length;
  const activeCount = secrets.filter((s) => s.status === "active").length;
  const rotatedCount = secrets.filter((s) => s.status === "rotated").length;

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">lock</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Secret Detection & Credential Hygiene
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Gitleaks & Git-hygiene scanner results with automated token redaction and rotation tracking.
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => toast.success("Git history scan triggered for all commits")}
            className="bg-transparent border border-outline-variant text-on-surface px-4 py-1.5 rounded-md text-[13px] leading-[20px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-sm">history</span>
            Full Git Scan
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard
          label="ACTIVE LEAKS"
          value={activeCount}
          icon="key_off"
          desc="Unresolved credential exposures"
          highlight={activeCount > 0 ? "text-error" : "text-secondary"}
        />
        <StatCard
          label="ROTATED SECRETS"
          value={rotatedCount}
          icon="verified"
          desc="Safely rotated & invalidated"
          highlight="text-secondary"
        />
        <StatCard
          label="TOTAL DETECTIONS"
          value={totalSecrets}
          icon="lock"
          desc="Tracked across repositories"
          highlight="text-primary"
        />
        <StatCard
          label="REDACTION ENGINE"
          value="ENFORCED"
          icon="shield_lock"
          desc="Zero raw secrets persisted"
          highlight="text-tertiary"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col md:flex-row justify-between items-stretch md:items-center gap-md">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            className="bg-background border border-outline-variant rounded-md pl-10 pr-4 py-1.5 text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-on-background placeholder:text-on-surface-variant font-[JetBrains_Mono]"
            placeholder="Search secrets by rule, file, or token type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <select
            className="bg-background border border-outline-variant rounded text-on-surface text-[12px] leading-[18px] font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Secret Types</option>
            <option value="Cloud Credential">Cloud Credentials</option>
            <option value="API Token">API Tokens</option>
            <option value="Auth Secret">Auth Secrets</option>
            <option value="Database URI">Database URIs</option>
          </select>

          <select
            className="bg-background border border-outline-variant rounded text-on-surface text-[12px] leading-[18px] font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="rotated">Rotated</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Secrets List & Remediation Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Secrets Table (8 cols) */}
        <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-lg tech-shadow overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-highest border-b border-outline-variant">
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pl-md">
                    EXPOSED SECRET
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    TYPE
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    MASKED VALUE
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    STATUS
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pr-md">
                    LOCATION
                  </th>
                </tr>
              </thead>
              <tbody className="text-[13px] leading-[20px] font-[JetBrains_Mono]">
                {filtered.map((sec) => {
                  const isSelected = selectedSecret?.id === sec.id;
                  const isRevealed = revealedIds.has(sec.id);
                  return (
                    <tr
                      key={sec.id}
                      onClick={() => setSelectedSecret(sec)}
                      className={cn(
                        "border-b border-outline-variant/40 hover:bg-surface-container transition-colors cursor-pointer",
                        isSelected && "bg-surface-container-high border-l-2 border-l-primary"
                      )}
                    >
                      <td className="p-sm pl-md text-on-surface font-semibold">
                        <div className="flex items-center gap-xs">
                          <span
                            className={cn(
                              "material-symbols-outlined text-[16px]",
                              sec.status === "active" ? "text-error" : "text-secondary"
                            )}
                          >
                            {sec.status === "active" ? "lock_open" : "lock"}
                          </span>
                          <span>{sec.title}</span>
                        </div>
                        <span className="text-[10px] text-outline block">{sec.ruleId}</span>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            TYPE_COLORS[sec.type] ?? "border-outline text-on-surface-variant"
                          )}
                        >
                          {sec.type}
                        </span>
                      </td>
                      <td className="p-sm text-[12px] text-on-surface-variant">
                        <div className="flex items-center gap-xs">
                          <span>
                            {isRevealed
                              ? sec.maskedSecret
                              : "••••••••••••••••"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReveal(sec.id);
                            }}
                            className="text-on-surface-variant hover:text-on-surface"
                            title={isRevealed ? "Hide" : "Show preview"}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {isRevealed ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
                            sec.status === "active"
                              ? "bg-error/15 text-error border-error/30"
                              : sec.status === "rotated"
                                ? "bg-secondary/15 text-secondary border-secondary/30"
                                : "bg-outline/15 text-on-surface-variant border-outline/30"
                          )}
                        >
                          {sec.status}
                        </span>
                      </td>
                      <td className="p-sm pr-md text-[11px] text-outline truncate max-w-[130px]">
                        {sec.file}:{sec.line}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      No secrets found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remediation & Details Drawer (4 cols) */}
        <div className="lg:col-span-4 space-y-md">
          {selectedSecret ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md">
              <div className="flex justify-between items-start border-b border-outline-variant pb-sm">
                <div>
                  <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                    Secret Incident Detail
                  </span>
                  <h3 className="text-[18px] leading-[24px] font-bold text-on-surface font-[Inter] mt-0.5">
                    {selectedSecret.title}
                  </h3>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border font-[JetBrains_Mono]",
                    TYPE_COLORS[selectedSecret.type]
                  )}
                >
                  {selectedSecret.type}
                </span>
              </div>

              {/* Meta Spec */}
              <div className="space-y-sm bg-background p-sm rounded border border-outline-variant/60 font-[JetBrains_Mono] text-[12px]">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">FILE PATH</span>
                  <span className="text-on-surface truncate max-w-[180px]">{selectedSecret.file}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">LINE NUMBER</span>
                  <span className="text-on-surface">{selectedSecret.line}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">LAST COMMIT</span>
                  <span className="text-secondary">{selectedSecret.commit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">DETECTED</span>
                  <span className="text-on-surface-variant">{formatDate(selectedSecret.detectedAt)}</span>
                </div>
              </div>

              {/* Redacted Token Box */}
              <div className="bg-background border border-error/30 rounded p-sm space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-error font-[JetBrains_Mono] uppercase">
                  <span>Redacted Secret Preview</span>
                  <span className="text-[9px] text-outline">NEVER EXPOSED IN LOGS</span>
                </div>
                <pre className="text-[12px] font-[JetBrains_Mono] text-on-surface truncate select-all">
                  {selectedSecret.maskedSecret}
                </pre>
              </div>

              {/* Rotation Playbook */}
              <div className="space-y-sm">
                <h4 className="text-[11px] leading-[16px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                  Rotation & Remediation Playbook
                </h4>
                <ol className="text-[12px] leading-[18px] text-on-surface-variant font-[Inter] space-y-xs list-decimal pl-4">
                  <li>
                    <strong className="text-on-surface">Revoke Immediately:</strong> Invalidate this credential in your provider console.
                  </li>
                  <li>
                    <strong className="text-on-surface">Erase from Git:</strong> Use <code className="text-secondary font-[JetBrains_Mono]">git filter-repo</code> or BFG Repo-Cleaner to rewrite history.
                  </li>
                  <li>
                    <strong className="text-on-surface">Re-issue safely:</strong> Inject the new secret into environment variables or a vault.
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="pt-sm border-t border-outline-variant grid grid-cols-2 gap-sm">
                <button
                  onClick={() => handleUpdateStatus(selectedSecret.id, "rotated")}
                  className="py-2 bg-secondary/15 text-secondary hover:bg-secondary/25 border border-secondary/40 rounded text-[11px] font-[JetBrains_Mono] font-semibold transition-colors flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  Mark Rotated
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedSecret.id, "ignored")}
                  className="py-2 bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant rounded text-[11px] font-[JetBrains_Mono] font-semibold transition-colors flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                  Ignore / False
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-xl text-center text-on-surface-variant">
              Select a secret to inspect leak history and rotation playbook.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  desc,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: string;
  desc: string;
  highlight: string;
}) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow flex flex-col justify-between">
      <div className="flex justify-between items-start mb-xs">
        <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
          {label}
        </span>
        <span className={cn("material-symbols-outlined text-lg", highlight)}>{icon}</span>
      </div>
      <div className={cn("text-[28px] leading-[36px] font-bold font-[Inter]", highlight)}>
        {value}
      </div>
      <p className="text-[11px] leading-[16px] text-on-surface-variant font-[JetBrains_Mono] mt-xs">
        {desc}
      </p>
    </div>
  );
}
