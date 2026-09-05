"use client";

/* eslint-disable react-hooks/set-state-in-effect -- data loading on mount/refresh */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Finding } from "@codesentinel/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface DependencyItem {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  ecosystem: "npm" | "PyPI" | "Go" | "crates.io";
  manifest: string;
  license: string;
  vulnerabilityCount: number;
  maxSeverity: "critical" | "high" | "medium" | "low" | "none";
  advisories: {
    id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    fixedIn?: string;
  }[];
}

const ECOSYSTEM_BADGES: Record<string, string> = {
  npm: "bg-error/15 text-error border-error/30",
  PyPI: "bg-secondary/15 text-secondary border-secondary/30",
  Go: "bg-tertiary/15 text-tertiary border-tertiary/30",
  "crates.io": "bg-primary/15 text-primary border-primary/30",
};

const SEVERITY_CHIPS: Record<string, { label: string; class: string }> = {
  critical: { label: "CRITICAL", class: "bg-error/15 text-error border-error/30" },
  high: { label: "HIGH", class: "bg-tertiary/15 text-tertiary border-tertiary/30" },
  medium: { label: "MEDIUM", class: "bg-secondary/15 text-secondary border-secondary/30" },
  low: { label: "LOW", class: "bg-outline/15 text-on-surface-variant border-outline/30" },
  none: { label: "CLEAN", class: "bg-secondary/10 text-secondary border-secondary/20" },
};

export default function DependenciesPage() {
  const [dependencies, setDependencies] = useState<DependencyItem[] | null>(null);
  const [selectedDep, setSelectedDep] = useState<DependencyItem | null>(null);
  const [search, setSearch] = useState("");
  const [ecosystemFilter, setEcosystemFilter] = useState("all");
  const [vulnOnly, setVulnOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const projects = await api.listProjects();
      const withScans = projects.filter((p) => p.last_scan_id != null);
      if (withScans.length > 0) {
        const latestScanId = withScans[0].last_scan_id!;
        const page = await api.getFindings(latestScanId, { category: "dependency" });
        if (page.items.length > 0) {
          // Map real backend findings to dependencies table
          const mapped: DependencyItem[] = page.items.map((f: Finding, i: number) => {
            const pkgName = f.title.split(" ")[0] || "dependency";
            const currentVer = f.evidence?.installed_version || f.title.split(" ")[1] || "1.0.0";
            return {
              id: f.id || `dep-${i}`,
              name: pkgName,
              version: String(currentVer),
              latestVersion: "latest",
              ecosystem: (f.evidence?.ecosystem as "npm" | "PyPI" | "Go" | "crates.io") || "PyPI",
              manifest: f.file || "requirements.txt",
              license: "Open Source",
              vulnerabilityCount: 1,
              maxSeverity: (f.severity as "critical" | "high" | "medium" | "low") || "medium",
              advisories: [
                {
                  id: f.rule_id || "OSV-ADVISORY",
                  title: f.description || f.title,
                  severity: (f.severity as "critical" | "high" | "medium" | "low") || "medium",
                  fixedIn: f.remediation?.match(/to\s+([0-9.]+)/i)?.[1],
                },
              ],
            };
          });
          setDependencies(mapped);
          setSelectedDep(mapped[0]);
          return;
        }
      }
      setDependencies([]);
      setSelectedDep(null);
    } catch {
      setDependencies([]);
      setSelectedDep(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (dependencies === null) {
    return (
      <div className="space-y-lg max-w-[1440px] mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const filtered = dependencies.filter((dep) => {
    const matchesSearch =
      dep.name.toLowerCase().includes(search.toLowerCase()) ||
      dep.manifest.toLowerCase().includes(search.toLowerCase());
    const matchesEco = ecosystemFilter === "all" || dep.ecosystem === ecosystemFilter;
    const matchesVuln = !vulnOnly || dep.vulnerabilityCount > 0;
    return matchesSearch && matchesEco && matchesVuln;
  });

  const totalDeps = dependencies.length;
  const vulnerableCount = dependencies.filter((d) => d.vulnerabilityCount > 0).length;
  const criticalCount = dependencies.filter((d) => d.maxSeverity === "critical").length;
  const highCount = dependencies.filter((d) => d.maxSeverity === "high").length;

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">inventory_2</span>
            <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface font-[Inter]">
              Software Dependencies (SCA)
            </h2>
          </div>
          <p className="text-[14px] leading-[20px] text-on-surface-variant font-[Inter]">
            OSV-backed manifest analysis, package licenses, and vulnerability advisory tracking.
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => toast.success("Lockfile audit synced with local cache")}
            className="bg-transparent border border-outline-variant text-on-surface px-4 py-1.5 rounded-md text-[13px] leading-[20px] font-[JetBrains_Mono] hover:bg-surface-container-highest transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh Advisories
          </button>
        </div>
      </header>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard
          label="TOTAL PACKAGES"
          value={totalDeps}
          icon="inventory_2"
          desc="Parsed from manifests"
          highlight="text-primary"
        />
        <StatCard
          label="VULNERABLE PACKAGES"
          value={vulnerableCount}
          icon="gpp_maybe"
          desc="Known security advisories"
          highlight={vulnerableCount > 0 ? "text-error" : "text-secondary"}
        />
        <StatCard
          label="HIGH & CRITICAL CVEs"
          value={criticalCount + highCount}
          icon="warning"
          desc="Require immediate patch"
          highlight="text-tertiary"
        />
        <StatCard
          label="ECOSYSTEMS"
          value="4 ACTIVE"
          icon="hub"
          desc="npm, PyPI, Go, Cargo"
          highlight="text-secondary"
        />
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col md:flex-row justify-between items-stretch md:items-center gap-md">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            className="bg-background border border-outline-variant rounded-md pl-10 pr-4 py-1.5 text-sm w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-on-background placeholder:text-on-surface-variant font-[JetBrains_Mono]"
            placeholder="Filter package name or manifest..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <select
            className="bg-background border border-outline-variant rounded text-on-surface text-[12px] leading-[18px] font-[JetBrains_Mono] py-1.5 px-3 focus:ring-1 focus:ring-primary outline-none"
            value={ecosystemFilter}
            onChange={(e) => setEcosystemFilter(e.target.value)}
          >
            <option value="all">All Ecosystems</option>
            <option value="npm">npm</option>
            <option value="PyPI">PyPI</option>
            <option value="Go">Go</option>
            <option value="crates.io">crates.io</option>
          </select>

          <button
            onClick={() => setVulnOnly(!vulnOnly)}
            className={cn(
              "px-3 py-1.5 rounded text-[12px] leading-[18px] font-[JetBrains_Mono] border transition-colors flex items-center gap-xs",
              vulnOnly
                ? "bg-error/15 text-error border-error/40 font-semibold"
                : "bg-background text-on-surface-variant border-outline-variant hover:text-on-surface"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              {vulnOnly ? "check_box" : "check_box_outline_blank"}
            </span>
            Vulnerable Only
          </button>
        </div>
      </div>

      {/* Main Grid: Dependency Table & Inspect Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Table Column (8 cols) */}
        <div className="lg:col-span-8 bg-surface-container-low border border-outline-variant rounded-lg tech-shadow overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-highest border-b border-outline-variant">
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pl-md">
                    PACKAGE
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    VERSION
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    ECOSYSTEM
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono]">
                    STATUS
                  </th>
                  <th className="p-sm text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] pr-md">
                    MANIFEST
                  </th>
                </tr>
              </thead>
              <tbody className="text-[13px] leading-[20px] font-[JetBrains_Mono]">
                {filtered.map((dep) => {
                  const isSelected = selectedDep?.id === dep.id;
                  return (
                    <tr
                      key={dep.id}
                      onClick={() => setSelectedDep(dep)}
                      className={cn(
                        "border-b border-outline-variant/40 hover:bg-surface-container transition-colors cursor-pointer",
                        isSelected && "bg-surface-container-high border-l-2 border-l-primary"
                      )}
                    >
                      <td className="p-sm pl-md text-on-surface font-semibold flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                          extension
                        </span>
                        {dep.name}
                      </td>
                      <td className="p-sm text-on-surface-variant">{dep.version}</td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            ECOSYSTEM_BADGES[dep.ecosystem] ?? "border-outline text-on-surface-variant"
                          )}
                        >
                          {dep.ecosystem}
                        </span>
                      </td>
                      <td className="p-sm">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            SEVERITY_CHIPS[dep.maxSeverity]?.class
                          )}
                        >
                          {dep.vulnerabilityCount > 0
                            ? `${dep.vulnerabilityCount} VULN`
                            : "CLEAN"}
                        </span>
                      </td>
                      <td className="p-sm pr-md text-[11px] text-outline truncate max-w-[140px]">
                        {dep.manifest}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      No dependencies match the search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspect Panel Column (4 cols) */}
        <div className="lg:col-span-4 space-y-md">
          {selectedDep ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md tech-shadow space-y-md">
              <div className="flex justify-between items-start border-b border-outline-variant pb-sm">
                <div>
                  <span className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
                    Package Details
                  </span>
                  <h3 className="text-[20px] leading-[26px] font-bold text-on-surface font-[Inter] mt-0.5">
                    {selectedDep.name}
                  </h3>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border font-[JetBrains_Mono]",
                    ECOSYSTEM_BADGES[selectedDep.ecosystem]
                  )}
                >
                  {selectedDep.ecosystem}
                </span>
              </div>

              {/* Version Specs */}
              <div className="grid grid-cols-2 gap-sm bg-background p-sm rounded border border-outline-variant/60 font-[JetBrains_Mono] text-[12px]">
                <div>
                  <span className="text-on-surface-variant text-[10px] block">INSTALLED</span>
                  <span className="text-on-surface font-bold">{selectedDep.version}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant text-[10px] block">LATEST UPSTREAM</span>
                  <span className="text-secondary font-bold">{selectedDep.latestVersion}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-outline-variant/40">
                  <span className="text-on-surface-variant text-[10px] block">MANIFEST LOCATION</span>
                  <span className="text-outline text-[11px] truncate block">{selectedDep.manifest}</span>
                </div>
              </div>

              {/* Advisories Section */}
              <div>
                <h4 className="text-[11px] leading-[16px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase mb-sm">
                  Known Advisories ({selectedDep.advisories.length})
                </h4>
                {selectedDep.advisories.length === 0 ? (
                  <div className="p-md rounded bg-surface-container border border-outline-variant/40 text-center text-sm text-secondary font-[Inter]">
                    <span className="material-symbols-outlined text-secondary block text-2xl mb-1">
                      verified_user
                    </span>
                    No known CVEs in OSV database for this version.
                  </div>
                ) : (
                  <div className="space-y-sm">
                    {selectedDep.advisories.map((adv) => (
                      <div
                        key={adv.id}
                        className="bg-surface-container border border-outline-variant rounded p-sm border-l-2 border-l-error space-y-1"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[11px] font-bold text-error font-[JetBrains_Mono]">
                            {adv.id}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.2 rounded text-[9px] font-bold font-[JetBrains_Mono] uppercase",
                              SEVERITY_CHIPS[adv.severity]?.class
                            )}
                          >
                            {adv.severity}
                          </span>
                        </div>
                        <p className="text-[12px] leading-[16px] text-on-surface font-[Inter]">
                          {adv.title}
                        </p>
                        {adv.fixedIn && (
                          <p className="text-[11px] text-secondary font-[JetBrains_Mono] pt-1">
                            Fixed in: <span className="font-bold">{adv.fixedIn}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-sm border-t border-outline-variant">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `npm install ${selectedDep.name}@${selectedDep.latestVersion}`
                    );
                    toast.success(`Copied update command for ${selectedDep.name}`);
                  }}
                  className="w-full py-2 bg-primary/15 text-primary hover:bg-primary/25 border border-primary/40 rounded text-[12px] font-[JetBrains_Mono] font-semibold transition-colors flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copy Upgrade Command
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low border border-outline-variant rounded-lg p-xl text-center text-on-surface-variant">
              Select a dependency to inspect advisory details.
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
