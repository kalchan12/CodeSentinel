// CodeSentinel desktop shell.
//
// Tauri hosts the Next.js web frontend (dev server in development, static
// export in release) which talks to the local FastAPI backend over HTTP.
// Tauri commands are intentionally minimal for v1; native integrations
// (e.g. a folder-picker dialog) can be added later without changing the
// frontend/backend data flow.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    codesentinel_lib::run()
}
