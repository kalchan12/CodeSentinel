"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Brain,
  Bug,
  ChevronDown,
  Code2,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/scan", label: "Scans", icon: Bug },
  { href: "/projects", label: "Code Analysis", icon: Code2, hrefActive: "/scan" },
  { href: "/projects", label: "Findings", icon: Brain },
];

const FOOTER_ITEMS = [
  { href: "#", label: "Settings", icon: Settings },
  { href: "#", label: "Support", icon: HelpCircle },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid-bg flex h-screen overflow-hidden bg-background text-on-surface">
      {/* Sidebar */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest">
        <div className="flex h-full flex-col gap-8 p-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-tight tracking-tight text-on-surface">
                CodeSentinel
              </h1>
              <p className="text-xs font-medium text-on-surface-variant">Security Dashboard</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex grow flex-col gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname === item.hrefActive;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-surface-container-high font-semibold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className={cn(!active && "font-medium")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-outline-variant pt-6">
            {FOOTER_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-1.5 text-on-surface">
              <Terminal className="h-4 w-4 text-secondary" />
              <h2 className="text-sm font-bold tracking-tight">CodeSentinel</h2>
              <ChevronDown className="h-4 w-4 text-on-surface-variant" />
            </div>
            <div className="relative hidden md:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-outline" />
              </div>
              <input
                className="w-64 rounded-lg border-none bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="Search security logs..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative rounded-lg bg-surface-container p-2 text-on-surface transition-colors hover:bg-surface-container-high">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 size-2 rounded-full border-2 border-surface-container-lowest bg-error" />
            </button>
            <div className="mx-1 h-8 w-px bg-outline-variant" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-on-surface">SecOps Analyst</p>
                <p className="font-code text-[10px] text-on-surface-variant">local-first</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container font-code text-xs font-bold text-secondary">
                CS
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}