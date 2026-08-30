"use client";

import { useState } from "react";

const ANALYZERS = [
  { name: "Semgrep", status: "online", version: "1.50.0", lastRun: "2 mins ago" },
  { name: "Gitleaks", status: "online", version: "8.18.1", lastRun: "2 mins ago" },
  { name: "OSV", status: "online", version: "v1", lastRun: "5 mins ago" },
  { name: "Tree-sitter", status: "offline", version: "N/A", lastRun: "Never" },
];

export default function AnalyzerStatusPage() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      <header className="flex justify-between items-end border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">speed</span>
            <h2 className="text-[24px] font-semibold text-on-surface">Analyzer Status</h2>
          </div>
          <p className="text-on-surface-variant">System health and connection status for local and remote analyzers.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
        {ANALYZERS.map(a => (
          <div key={a.name} className="p-md rounded-lg border border-outline-variant bg-surface-container-low flex flex-col gap-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-[16px] font-medium text-on-surface">{a.name}</h3>
              <span className={`px-2 py-1 rounded text-xs ${a.status === 'online' ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'}`}>
                {a.status.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-on-surface-variant">
              <div>Version: {a.version}</div>
              <div>Last Run: {a.lastRun}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
