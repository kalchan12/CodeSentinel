"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface EmbeddedTerminalProps {
  cmd?: string;
  projectId?: number;
  prompt?: string;
  onClose?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function EmbeddedTerminal({
  cmd = "bash",
  projectId,
  prompt,
  onClose,
  className,
  autoFocus = true,
}: EmbeddedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initTerminal() {
      if (!containerRef.current) return;

      // Dynamically import xterm to ensure no SSR execution
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (!isMounted || !containerRef.current) return;

      // Clean existing terminal if any
      if (termRef.current) {
        termRef.current.dispose();
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.25,
        fontFamily: "'JetBrains Mono', monospace",
        theme: {
          background: "#080C14",
          foreground: "#E2E8F0",
          cursor: "#5DE6FF",
          cursorAccent: "#050710",
          selectionBackground: "rgba(160, 120, 255, 0.35)",
          black: "#0B1018",
          red: "#FFB4AB",
          green: "#5DE6FF",
          yellow: "#FFB869",
          blue: "#D0BCFF",
          magenta: "#A078FF",
          cyan: "#2FD9F4",
          white: "#E2E8F0",
          brightBlack: "#475569",
          brightRed: "#FFB4AB",
          brightGreen: "#A2EEFF",
          brightYellow: "#FFDCBB",
          brightBlue: "#E9DDFF",
          brightMagenta: "#D0BCFF",
          brightCyan: "#5DE6FF",
          brightWhite: "#FFFFFF",
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      if (autoFocus) {
        term.focus();
      }

      // Build WebSocket URL
      const apiEnv = process.env.NEXT_PUBLIC_CODESENTINEL_API || "http://localhost:8000/api";
      const wsBase = apiEnv.replace(/\/api$/, "").replace(/^http/, "ws");
      const queryParams = new URLSearchParams();
      queryParams.set("cmd", cmd);
      if (projectId) {
        queryParams.set("project_id", String(projectId));
      }
      if (prompt) {
        queryParams.set("prompt", prompt);
      }
      queryParams.set("rows", String(term.rows || 24));
      queryParams.set("cols", String(term.cols || 80));

      const wsUrl = `${wsBase}/api/terminal/ws?${queryParams.toString()}`;
      setStatus("connecting");

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setStatus("connected");
        // Inform server of initial dimensions
        try {
          ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
        } catch {
          // ignore
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else if (typeof event.data === "string") {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setStatus("disconnected");
        term.writeln("\r\n\x1b[90m--- Session ended ---\x1b[0m\r\n");
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setStatus("error");
      };

      // Handle terminal keystrokes -> send to backend PTY
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle window/container resize
      const handleResize = () => {
        try {
          if (containerRef.current && fitAddon) {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
            }
          }
        } catch {
          // ignore
        }
      };

      window.addEventListener("resize", handleResize);

      // Resize observer on container element
      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        resizeObserver.disconnect();
      };
    }

    const cleanupPromise = initTerminal();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [cmd, projectId, prompt, autoFocus]);

  const handleReconnect = () => {
    // Force re-trigger by resetting state
    setStatus("connecting");
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-[#080C14] border border-outline-variant rounded-lg overflow-hidden", className)}>
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0B1018] border-b border-outline-variant text-xs select-none">
        <div className="flex items-center gap-2 font-[JetBrains_Mono]">
          <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
          <span className="text-on-surface font-semibold capitalize">{cmd}</span>
          {projectId && (
            <span className="text-on-surface-variant text-[11px] bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/40">
              Project #{projectId}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] ml-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                status === "connected" && "bg-secondary animate-pulse",
                status === "connecting" && "bg-tertiary animate-ping",
                status === "disconnected" && "bg-on-surface-variant/50",
                status === "error" && "bg-error"
              )}
            />
            <span className="text-on-surface-variant text-[10px] uppercase">{status}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 text-on-surface-variant">
          <button
            onClick={handleClear}
            title="Clear terminal"
            className="p-1 hover:text-on-surface hover:bg-surface-container-high rounded transition-colors text-[11px] flex items-center gap-1 font-[JetBrains_Mono] px-2"
          >
            <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
            Clear
          </button>
          {status === "disconnected" && (
            <button
              onClick={handleReconnect}
              title="Restart session"
              className="p-1 hover:text-on-surface hover:bg-surface-container-high rounded transition-colors text-[11px] flex items-center gap-1 font-[JetBrains_Mono] px-2 text-secondary"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Restart
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close terminal"
              className="p-1 hover:text-error hover:bg-surface-container-high rounded transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full p-2 overflow-hidden focus:outline-none"
        style={{ minHeight: "180px" }}
      />
    </div>
  );
}
