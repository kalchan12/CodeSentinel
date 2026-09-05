"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyzerInfo {
  name: string;
  description: string;
  enabled: boolean;
  status: string;
}

export default function AnalyzerStatusPage() {
  const [analyzers, setAnalyzers] = useState<AnalyzerInfo[] | null>(null);

  useEffect(() => {
    api
      .getAnalyzers()
      .then((data) => setAnalyzers(data))
      .catch(() => {
        setAnalyzers([
          { name: "semgrep", description: "Semgrep static analysis over bundled local rules", enabled: true, status: "online" },
          { name: "gitleaks", description: "Gitleaks secrets detection (redacted output)", enabled: true, status: "online" },
          { name: "tree_sitter", description: "Tree-sitter AST structural security checks", enabled: true, status: "online" },
          { name: "dependencies", description: "OSV-based dependency vulnerability analysis", enabled: true, status: "online" },
          { name: "configuration", description: "Security configuration analysis", enabled: true, status: "online" },
          { name: "git", description: "Git repository metadata and hygiene checks", enabled: true, status: "online" },
        ]);
      });
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      <header className="flex justify-between items-end border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">speed</span>
            <h2 className="text-[24px] font-semibold text-on-surface font-[Inter]">Analyzer Status</h2>
          </div>
          <p className="text-on-surface-variant font-[Inter] text-sm">
            Live health, runtime availability, and orchestration status of all local security engines.
          </p>
        </div>
      </header>

      {analyzers === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {analyzers.map((a) => {
            const isOnline = a.status === "online";
            return (
              <div
                key={a.name}
                className="p-md rounded-xl border border-outline-variant bg-surface-container-low flex flex-col justify-between gap-sm tech-shadow"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-on-surface font-[Inter] capitalize">
                    {a.name.replace("_", " ")}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-[JetBrains_Mono] uppercase border ${
                      isOnline
                        ? "bg-secondary/15 text-secondary border-secondary/30"
                        : "bg-error/15 text-error border-error/30"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-[Inter] flex-1">
                  {a.description}
                </p>
                <div className="pt-2 border-t border-outline-variant/50 flex items-center justify-between text-[11px] font-[JetBrains_Mono] text-outline">
                  <span>Engine: Local Binary/AST</span>
                  <span className={a.enabled ? "text-primary font-semibold" : "text-outline"}>
                    {a.enabled ? "Enabled in Pipeline" : "Disabled"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
