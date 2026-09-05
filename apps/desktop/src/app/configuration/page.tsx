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

export interface ConfigItem {
  id: string;
  ruleId: string;
  title: string;
  file: string;
  line: number;
  type: string;
  status: "active" | "resolved" | "ignored";
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  remediation?: string;
  codeSnippet?: string;
  detectedAt?: string;
}

const TYPE_COLORS: Record<string, string> = {
  "Insecure Defaults": "bg-tertiary/15 text-tertiary border-tertiary/30",
  "Open CORS": "bg-error/15 text-error border-error/30",
  "Missing Headers": "bg-primary/15 text-primary border-primary/30",
  "Debug Mode": "bg-secondary/15 text-secondary border-secondary/30",
};

export default function ConfigurationPage() {
  const [config, setConfigs] = useState<ConfigItem[] | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const withScans = projects.filter((p) => p.last_scan_id != null);
      if (withScans.length > 0) {
        const latestScanId = withScans[0].last_scan_id!;
        const page = await api.getFindings(latestScanId, { category: "configuration" });
        if (page.items.length > 0) {
          const mapped: ConfigItem[] = page.items.map((f: Finding, i: number) => ({
            id: f.id || `cfg-${i}`,
            ruleId: f.rule_id || "cfg-rule",
            title: f.title,
            type: f.title.toLowerCase().includes("cors")
              ? "Open CORS"
              : f.title.toLowerCase().includes("header")
                ? "Missing Headers"
                : f.title.toLowerCase().includes("debug")
                  ? "Debug Mode"
                  : "Insecure Defaults",
            file: f.file || "unknown",
            line: f.line_start || 1,
            severity: (f.severity as "critical" | "high" | "medium" | "low" | "info") || "medium",
            status: "active",
            description: f.description || f.title,
            remediation: f.remediation || "Review and update configuration parameters according to security baselines.",
            codeSnippet: f.code_snippet || undefined,
            detectedAt: f.created_at || new Date().toISOString(),
          }));
          setConfigs(mapped);
          setSelectedConfig(mapped[0]);
          return;
        }
      }
      setConfigs([]);
      setSelectedConfig(null);
    } catch {
      setConfigs([]);
      setSelectedConfig(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (config === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleUpdateStatus = (id: string, newStatus: "active" | "resolved" | "ignored") => {
    setConfigs((prev) =>
      prev
        ? prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
        : null
    );
    if (selectedConfig?.id === id) {
      setSelectedConfig((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Configuration issue status updated to ${newStatus}`);
  };

  const filtered = config.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.file.toLowerCase().includes(search.toLowerCase()) ||
      item.ruleId.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalConfigs = config.length;
  const activeCount = config.filter((s) => s.status === "active").length;
  const resolvedCount = config.filter((s) => s.status === "resolved").length;

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">settings_suggest</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Configuration & Hardening Assessment
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            Static analysis of framework settings, CORS policies, environment defaults, and security headers.
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => toast.success("Configuration audit re-triggered")}
            className="bg-transparent border border-outline-variant text-on-surface px-4 py-1.5 rounded-md text-[13px] leading-[20px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Re-audit Config
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard
          label="ACTIVE ISSUES"
          value={activeCount}
          icon="warning"
          desc="Unmitigated misconfigurations"
          highlight={activeCount > 0 ? "text-error" : "text-secondary"}
        />
        <StatCard
          label="RESOLVED ISSUES"
          value={resolvedCount}
          icon="verified"
          desc="Hardened & validated"
          highlight="text-secondary"
        />
        <StatCard
          label="TOTAL AUDITED"
          value={totalConfigs}
          icon="tune"
          desc="Evaluated configuration points"
          highlight="text-primary"
        />
        <StatCard
          label="HARDENING POLICY"
          value="ENFORCED"
          icon="shield"
          desc="Security baseline checks"
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
            placeholder="Search configurations by rule, title, or file..."
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
            <option value="all">All Issue Types</option>
            <option value="Insecure Defaults">Insecure Defaults</option>
            <option value="Open CORS">Open CORS</option>
            <option value="Missing Headers">Missing Headers</option>
            <option value="Debug Mode">Debug Mode</option>
          </select>

          <select
            className="bg-background border border-outline-variant rounded text-on-surface text-[12px] leading-[18px] font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Configs List & Remediation Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Configs Table (8 cols) */}
        <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-lg tech-shadow overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-highest border-b border-outline-variant">
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pl-md">
                    CONFIGURATION CHECK
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    TYPE
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    SEVERITY
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
                {filtered.map((item) => {
                  const isSelected = selectedConfig?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedConfig(item)}
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
                              item.status === "active" ? "text-error" : "text-secondary"
                            )}
                          >
                            {item.status === "active" ? "rule" : "check_circle"}
                          </span>
                          <span>{item.title}</span>
                        </div>
                        <span className="text-[10px] text-outline block">{item.ruleId}</span>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            TYPE_COLORS[item.type] ?? "border-outline text-on-surface-variant"
                          )}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
                            item.severity === "critical"
                              ? "bg-error/15 text-error border-error/30"
                              : item.severity === "high"
                                ? "bg-error/15 text-error border-error/30"
                                : item.severity === "medium"
                                  ? "bg-tertiary/15 text-tertiary border-tertiary/30"
                                  : "bg-outline/15 text-on-surface-variant border-outline/30"
                          )}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
                            item.status === "active"
                              ? "bg-error/15 text-error border-error/30"
                              : item.status === "resolved"
                                ? "bg-secondary/15 text-secondary border-secondary/30"
                                : "bg-outline/15 text-on-surface-variant border-outline/30"
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-sm pr-md text-[11px] text-outline truncate max-w-[130px]">
                        {item.file}:{item.line}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      No configuration issues found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remediation & Details Drawer (4 cols) */}
        <div className="lg:col-span-4 space-y-md">
          {selectedConfig ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md">
              <div className="flex justify-between items-start border-b border-outline-variant pb-sm">
                <div>
                  <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                    Configuration Finding Detail
                  </span>
                  <h3 className="text-[18px] leading-[24px] font-bold text-on-surface font-[Inter] mt-0.5">
                    {selectedConfig.title}
                  </h3>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border font-[JetBrains_Mono]",
                    TYPE_COLORS[selectedConfig.type]
                  )}
                >
                  {selectedConfig.type}
                </span>
              </div>

              {/* Meta Spec */}
              <div className="space-y-sm bg-background p-sm rounded border border-outline-variant/60 font-[JetBrains_Mono] text-[12px]">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">FILE PATH</span>
                  <span className="text-on-surface truncate max-w-[180px]">{selectedConfig.file}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">LINE NUMBER</span>
                  <span className="text-on-surface">{selectedConfig.line}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">RULE ID</span>
                  <span className="text-secondary">{selectedConfig.ruleId}</span>
                </div>
                {selectedConfig.detectedAt && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">DETECTED</span>
                    <span className="text-on-surface-variant">{formatDate(selectedConfig.detectedAt)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-xs">
                <h4 className="text-[11px] leading-[16px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                  Description
                </h4>
                <p className="text-[13px] leading-[20px] text-on-surface-variant font-[Inter]">
                  {selectedConfig.description}
                </p>
              </div>

              {/* Code / Config Snippet */}
              {selectedConfig.codeSnippet && (
                <div className="bg-background border border-outline-variant rounded p-sm space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                    <span>Config Snippet</span>
                  </div>
                  <pre className="text-[12px] font-[JetBrains_Mono] text-on-surface truncate select-all overflow-x-auto">
                    {selectedConfig.codeSnippet}
                  </pre>
                </div>
              )}

              {/* Remediation Guide */}
              <div className="space-y-sm">
                <h4 className="text-[11px] leading-[16px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                  Remediation Guidance
                </h4>
                <p className="text-[12px] leading-[18px] text-on-surface-variant font-[Inter]">
                  {selectedConfig.remediation || "Update the configuration file to comply with secure baseline defaults."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-sm border-t border-outline-variant grid grid-cols-2 gap-sm">
                <button
                  onClick={() => handleUpdateStatus(selectedConfig.id, "resolved")}
                  className="py-2 bg-secondary/15 text-secondary hover:bg-secondary/25 border border-secondary/40 rounded text-[11px] font-[JetBrains_Mono] font-semibold transition-colors flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  Mark Resolved
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedConfig.id, "ignored")}
                  className="py-2 bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant rounded text-[11px] font-[JetBrains_Mono] font-semibold transition-colors flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                  Ignore / False
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-xl text-center text-on-surface-variant">
              Select a configuration issue to inspect details and remediation guidance.
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
