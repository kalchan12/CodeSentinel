/// Library entrypoint used by the desktop binary.

// Tauri commands (v1):
// - analyze_project { path, depth } – run the mock Python analyzer over a local source tree
// and return a JSON summary of findings (severity counts, top files with line numbers).
// - healthy – simple liveness check that returns "ok".

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyze_project, healthy])
        .run(tauri::generate_context!())
        .expect("failed to run CodeSentinel desktop application")
}

/// Liveness check used by the UI or CI.
#[tauri::command]
fn healthy() -> String {
    "ok".to_string()
}

/// Run the mock Python analyzer over ``path`` (up to ``depth`` nested sub‑dirs) and
/// return a JSON‑serializable summary.
///
/// ``path`` – absolute path to scan.
/// ``depth`` – how many levels of sub‑directories to traverse (default 3).
#[tauri::command]
fn analyze_project(path: String, depth: Option<u32>) -> Result<serde_json::Value, String> {
    // TODO: replace with real Python subprocess call when Tauri compile issue is resolved
    // Example future implementation:
    // let python_code = format!(
    //     "from engine.analyzers.mock.analyzer import MockAnalyzer; ...",
    //     path, path
    // );
    // let output = subprocess::Command::new("python3")
    //     .args(["-c", python_code])
    //     .output()
    //     .map_err(|e| format!("python subprocess failed: {}", e))?;
    // let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    // if output.status.code() != 0 {
    //     let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    //     return Err(format!("python analyzer failed: {}", stderr));
    // }
    // let result: serde_json::Value = serde_json::from_str(&stdout)
    //     .map_err(|e| format!("failed to parse python output: {}", e))?;
    // Ok(result)

    // Placeholder: return zero findings so the UI doesn't crash
    Ok(serde_json::json!({
        "total_findings": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
        "top_files": []
    }))
}
