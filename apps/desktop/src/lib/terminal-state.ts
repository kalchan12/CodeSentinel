export type TerminalCommandType = "opencode" | "agy" | "bash" | "opencode-auth";

export interface TerminalOpenEvent {
  cmd?: TerminalCommandType;
  projectId?: number;
  initialPrompt?: string;
}

type TerminalListener = (event: TerminalOpenEvent) => void;
const listeners = new Set<TerminalListener>();

export function openTerminal(event: TerminalOpenEvent = {}) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeTerminal(listener: TerminalListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
