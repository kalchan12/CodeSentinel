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
    <div className="scanline-bg flex h-screen overflow-x-hidden bg-background text-on-background">
      {/* Sidebar — fixed left, matching design exactly */}
      <nav className="hidden md:flex flex-col h-full py-lg fixed left-0 top-0 w-[280px] bg-surface-container-low border-r border-outline-variant z-20">
        {/* Brand */}
        <div className="px-md mb-xl flex items-center gap-md">
          <span
            className="material-symbols-outlined text-primary text-[32px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            security
          </span>
          <div>
            <h1 className="font-bold text-[24px] leading-tight text-primary tracking-tighter font-[Inter]">
              CodeSentinel
            </h1>
            <p className="text-[10px] leading-[12px] tracking-[0.08em] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase">
              Local-First Security
            </p>
          </div>
        </div>

        {/* Run New Scan CTA */}
        <div className="px-md mb-lg">
          <button className="w-full bg-primary text-on-primary py-sm rounded-lg font-semibold text-[18px] leading-[24px] flex items-center justify-center gap-xs hover:bg-primary-container transition-colors shadow-[0_0_15px_rgba(208,188,255,0.15)]">
            <span className="material-symbols-outlined">add</span>
            Run New Scan
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto px-sm space-y-xs">
          {NAV_ITEMS.map((item) => {
            const active =
              (item.href === "/" && pathname === "/") ||
              (item.href === "/scan" && pathname.startsWith("/scan")) ||
              (item.href === "/projects" &&
                pathname.startsWith("/projects") &&
                pathname !== "/projects");

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-sm px-md py-sm transition-colors rounded-lg",
                  active
                    ? "sidebar-active font-semibold"
                    : "sidebar-inactive hover:bg-surface-container-highest"
                )}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    fontVariationSettings: active
                      ? "'FILL' 1"
                      : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className={cn(
                    "font-[Inter]",
                    active && "font-bold",
                    item.label === "AI Analysis" && !active && "text-secondary"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-sm mt-auto pt-md border-t border-outline-variant space-y-xs">
          {FOOTER_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="sidebar-inactive flex items-center gap-sm px-md py-sm rounded-lg hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              <span className="font-[Inter]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar — fixed top, matching design */}
        <header className="hidden md:flex justify-between items-center px-lg h-16 fixed top-0 right-0 w-[calc(100%-280px)] bg-surface border-b border-outline-variant z-10 shadow-sm">
          <div className="flex items-center gap-md">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                className="bg-background border border-outline-variant rounded-md pl-10 pr-4 py-1.5 text-sm w-64 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-background placeholder:text-on-surface-variant"
                placeholder="Search projects, findings..."
                type="text"
              />
            </div>
            <nav className="flex items-center gap-md ml-lg">
              <a className="text-primary font-bold border-b-2 border-primary pb-1 font-[JetBrains_Mono] text-[10px] tracking-[0.08em] uppercase h-full flex items-center pt-1">
                payments-api
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-md text-secondary">
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined">
                keyboard_command_key
              </span>
            </button>
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors flex items-center justify-center relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-surface" />
            </button>
            <button className="hover:text-on-surface hover:bg-surface-container-high p-sm rounded-full transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="md:ml-[280px] md:mt-16 flex-1 overflow-y-auto p-md md:p-lg lg:p-xl">
          {children}
        </main>
      </div>
    </div>
  );
}
