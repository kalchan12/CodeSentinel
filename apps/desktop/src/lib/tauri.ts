/**
 * Tauri desktop runtime detection utility.
 * Checks if the current environment is running within the Tauri desktop webview shell
 * or a standard web browser (e.g. during web development or browser testing).
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    // Tauri v2 exposes __TAURI_INTERNALS__ in its webview window
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
    (window as unknown as { __TAURI_METADATA__?: unknown }).__TAURI_METADATA__
  );
}
