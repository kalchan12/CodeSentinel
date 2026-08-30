"use client";

export default function DependencyGraphPage() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-lg">
      <header className="flex justify-between items-end border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">account_tree</span>
            <h2 className="text-[24px] font-semibold text-on-surface">Dependency Graph</h2>
          </div>
          <p className="text-on-surface-variant">Visual representation of dependency chains and transitive risk propagation.</p>
        </div>
      </header>
      
      <div className="p-xl border border-outline-variant rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center space-y-md">
        <span className="material-symbols-outlined text-6xl text-primary">account_tree</span>
        <h3 className="text-lg font-medium text-on-surface">Dependency Tree Visualization</h3>
        <p className="text-on-surface-variant max-w-md">The graph visualization engine is currently stubbed. It will render interactive node-link diagrams of project lockfiles once the analysis engine is integrated.</p>
      </div>
    </div>
  );
}
