"use client";

import { useEffect, useState } from "react";
import { EmbeddedTerminal } from "./embedded-terminal";
import { subscribeTerminal, type TerminalCommandType, type TerminalOpenEvent } from "@/lib/terminal-state";
import { cn } from "@/lib/utils";

interface TerminalTab {
  id: string;
  cmd: TerminalCommandType;
  label: string;
  icon: string;
  projectId?: number;
  prompt?: string;
}

export function TerminalDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>("opencode");
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "opencode", cmd: "opencode", label: "OpenCode Agent", icon: "auto_fix_high" },
    { id: "agy", cmd: "agy", label: "Antigravity CLI", icon: "psychology" },
    { id: "bash", cmd: "bash", label: "Project Shell", icon: "terminal" },
  ]);

  // Subscribe to external openTerminal() triggers
  useEffect(() => {
    const unsubscribe = subscribeTerminal((event: TerminalOpenEvent) => {
      setIsOpen(true);
      const cmd = event.cmd || "opencode";
      const targetTabId = event.initialPrompt ? `${cmd}-${Date.now()}` : cmd;

      setTabs((prev) => {
        const existing = prev.find((t) => t.id === targetTabId);
        if (existing) {
          return prev.map((t) =>
            t.id === targetTabId
              ? { ...t, projectId: event.projectId ?? t.projectId, prompt: event.initialPrompt ?? t.prompt }
              : t
          );
        }
        // If creating ad-hoc task tab (like specific finding fix)
        const label = event.initialPrompt
          ? `Fix: ${cmd}`
          : cmd === "opencode"
          ? "OpenCode Agent"
          : cmd === "agy"
          ? "Antigravity CLI"
          : "Terminal";

        return [
          ...prev,
          {
            id: targetTabId,
            cmd,
            label,
            icon: cmd === "opencode" ? "auto_fix_high" : cmd === "agy" ? "psychology" : "terminal",
            projectId: event.projectId,
            prompt: event.initialPrompt,
          },
        ];
      });

      setActiveTabId(targetTabId);
    });

    return unsubscribe;
  }, []);

  // Keyboard shortcut Ctrl + ` to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-6 z-30 bg-[#0B1018] border border-primary/40 hover:border-primary text-primary px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(208,188,255,0.15)] flex items-center gap-2 text-xs font-[JetBrains_Mono] font-semibold transition-all hover:scale-105"
        title="Open AI Security Terminal (Ctrl + `)"
      >
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="material-symbols-outlined text-[16px]">terminal</span>
        <span>AI Terminal</span>
        <kbd className="text-[10px] bg-surface-container px-1 rounded text-on-surface-variant border border-outline-variant">
          Ctrl + `
        </kbd>
      </button>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      setIsOpen(false);
      return;
    }
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleQuickAuth = (provider: "opencode" | "agy") => {
    const authCmd: TerminalCommandType = provider === "opencode" ? "opencode-auth" : "bash";
    const authTabId = `${provider}-auth-${Date.now()}`;
    setTabs((prev) => [
      ...prev,
      {
        id: authTabId,
        cmd: authCmd,
        label: `${provider} Auth`,
        icon: "key",
      },
    ]);
    setActiveTabId(authTabId);
  };

  return (
    <aside
      aria-label="Embedded Terminal Drawer"
      className={cn(
        "fixed bottom-0 left-0 md:left-[280px] right-0 z-30 bg-[#050710] border-t border-outline-variant flex flex-col shadow-2xl transition-all duration-200",
        isMaximized ? "h-[85vh]" : "h-[360px]"
      )}
    >
      {/* Drawer Header & Tabs */}
      <div className="flex items-center justify-between px-3 bg-[#080C14] border-b border-outline-variant select-none">
        {/* Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 py-1 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-t text-xs font-[JetBrains_Mono] transition-colors border-b-2",
                  isActive
                    ? "bg-[#0B1018] text-primary border-primary font-bold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-transparent"
                )}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span className="truncate max-w-[140px]">{tab.label}</span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="material-symbols-outlined text-[13px] hover:text-error ml-1 cursor-pointer"
                  >
                    close
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action pills & controls */}
        <div className="flex items-center gap-2 py-1">
          <button
            onClick={() => handleQuickAuth("opencode")}
            className="text-[11px] font-[JetBrains_Mono] px-2 py-0.5 rounded bg-surface-container border border-outline-variant/60 hover:border-primary text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
            title="Configure OpenCode AI providers and API keys"
          >
            <span className="material-symbols-outlined text-[13px]">key</span>
            OpenCode Sign In
          </button>

          <div className="h-3 w-[1px] bg-outline-variant mx-1" />

          {/* Window controls */}
          <button
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container transition-colors"
            title={isMaximized ? "Restore size" : "Maximize terminal"}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMaximized ? "collapse_content" : "expand_content"}
            </span>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors"
            title="Minimize drawer (Ctrl + `)"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="flex-1 w-full h-full p-2 bg-[#050710] overflow-hidden">
        {activeTab && (
          <EmbeddedTerminal
            key={activeTab.id}
            cmd={activeTab.cmd}
            projectId={activeTab.projectId}
            prompt={activeTab.prompt}
            className="h-full border-0"
          />
        )}
      </div>
    </aside>
  );
}
