"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "dashboard" },
  { href: "/projects", label: "Projects", icon: "folder_open" },
  { href: "/scan", label: "Scans", icon: "radar" },
  { href: "/scan", label: "Findings", icon: "security" },
  { href: "/projects", label: "Dependencies", icon: "inventory_2" },
  { href: "/projects", label: "Secrets", icon: "lock" },
  { href: "/projects", label: "Reports", icon: "assessment" },
  { href: "/projects", label: "AI Analysis", icon: "psychology" },
];

const FOOTER_ITEMS = [
  { href: "#", label: "Settings", icon: "settings" },
  { href: "#", label: "Analyzer Status", icon: "monitor_heart" },
  { href: "#", label: "Logs", icon: "terminal" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="scanline-bg flex h-screen overflow-hidden bg-background text-on-surface">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-full w-[280px] border-r border-outline-variant bg-surface-container-low z-20">
        <div className="flex flex-col h-full py-lg px-md">
          {/* Brand */}
          <div className="mb-xl flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              security
            </span>
            <div>
              <h1 className="font-display-lg text-[20px] leading-tight font-bold text-primary tracking-tighter">
                CodeSentinel
              </h1>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Local-First Security
              </p>
            </div>
          </div>

          {/* Run New Scan CTA */}
          <button className="w-full mb-lg bg-primary text-white font-title-sm text-title-sm py-sm rounded-lg flex items-center justify-center gap-sm hover:bg-primary-container transition-colors cyber-glow">
            <span className="material-symbols-outlined">add</span>
            Run New Scan
          </button>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-sm space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href === "/scan" && pathname.startsWith("/scan")) || (item.href === "/projects" && pathname.startsWith("/projects") && pathname !== "/projects");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-sm px-md py-sm transition-colors rounded-lg",
                    active
                      ? "sidebar-active font-semibold"
                      : "sidebar-inactive"
                  )}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  <span className="font-body-base text-body-base">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-md border-t border-outline-variant space-y-1">
            {FOOTER_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="sidebar-inactive flex items-center gap-sm px-md py-sm rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="font-body-base text-body-base">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="hidden md:flex justify-between items-center px-lg h-16 border-b border-outline-variant bg-surface z-10 shadow-sm">
          <div className="flex items-center gap-md">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">search</span>
              <input
                className="bg-[#080A0F] border border-outline-variant rounded-md pl-10 pr-4 py-1.5 text-sm w-64 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-background placeholder:text-outline"
                placeholder="Search projects, findings..."
                type="text"
              />
            </div>
            <nav className="flex h-full items-center ml-lg">
              <span className="text-primary font-bold border-b-2 border-primary pb-1 font-label-caps text-label-caps uppercase h-full flex items-center pt-1">
                payments-api
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant">
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors">
              <span className="material-symbols-outlined">keyboard_command_key</span>
            </button>
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
            </button>
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="md:ml-[280px] md:mt-16 flex-1 overflow-y-auto p-md md:p-lg lg:p-xl">{children}</main>
      </div>
    </div>
  );
}