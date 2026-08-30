"use client";

export default function SecurityMetricsPage() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      <header className="flex justify-between items-end border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">monitoring</span>
            <h2 className="text-[24px] font-semibold text-on-surface">Security Metrics</h2>
          </div>
          <p className="text-on-surface-variant">Global portfolio risk trends and vulnerability resolution times.</p>
        </div>
      </header>
      
      <div className="p-xl border border-outline-variant rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center space-y-md">
        <span className="material-symbols-outlined text-6xl text-secondary">bar_chart</span>
        <h3 className="text-lg font-medium text-on-surface">Metrics Engine Initializing</h3>
        <p className="text-on-surface-variant max-w-md">Historical trend data requires at least 3 completed scans across the portfolio. Continue scanning to generate aggregate metrics.</p>
      </div>
    </div>
  );
}
