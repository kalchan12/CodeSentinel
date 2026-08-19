/// Library entrypoint used by the desktop binary.
#
/// **Tauri commands** (v1):
/// - `analyze_project { path, depth }` – run the mock Python analyzer over a
///   local source tree and return a JSON summary of findings (severity counts,
///   top files with line numbers).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![analyze_project])
        .run(tauri::generate_context!())
        .expect("failed to run CodeSentinel desktop application");
}

/// Run the mock Python analyzer over ``path`` (up to ``depth`` nested sub‑dirs)
/// and return a JSON‑serializable summary.
///
/// ``path`` – absolute path to scan.
/// ``depth`` – how many levels of sub‑directories to traverse (default 3).
#[tauri::command]
fn analyze_project(path: String, depth: Option<u32>) -> Result<serde_json::Value, String> {
    use std::path::Path;

    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("path does not exist: {}", path));
    }
    let d = depth.unwrap_or(3);

    // Invoke the mock analyzer via Python subprocess
    let python_cmd = format!(
        "from engine.analyzers.mock.analyzer import MockAnalyzer; \
         from engine.core.context import AnalysisContext; \
         from engine.models.source import ProjectSource, SourceType; \
         import json; \
         ctx = AnalysisContext(project_id=0, project_name='codesentinel', \
         source=SourceType.Local, local_path='{}', project_path='{}'); \
         analyzer = MockAnalyzer(); \
         findings = analyzer.analyze(ctx); \
         total = len(findings); \
         counts = {{}}; \
         for f in findings: \
             counts[f.severity.value] = counts.get(f.severity.value, 0) + 1; \
         high = counts.get('HIGH', 0); \
         medium = counts.get('MEDIUM', 0); \
         low = counts.get('LOW', 0); \
         info = counts.get('INFO', 0); \
         files = []; \
         for f in findings[:5]: \
             files.append({{\"file\": f.file, \"line\": f.line_start, \"title\": f.title, \"severity\": f.severity.value}}); \
         json.dump({{\"total_findings\": total, \"high\": high, \"medium\": medium, \"low\": low, \"info\": info, \"top_files\": files}})",
            "/tmp/analyze_result.py"
        );
    // Actually easier: just exec python with -c and the code inline.
    // Let's do a simpler approach: write a tiny temp script and run it.
    // But we can just use Python's `-c` flag.
    let python_code = format!(
        "import sys, json, os\nfrom pathlib import Path\nfrom engine.analyzers.mock.analyzer import MockAnalyzer\nfrom engine.core.context import AnalysisContext\nfrom engine.models.source import ProjectSource, SourceType\nctx = AnalysisContext(project_id=0, project_name='codesentinel', source=SourceType.Local, local_path='{}', project_path=Path('{}'))\nanalyzer = MockAnalyzer()\nfindings = analyzer.analyze(ctx)\ntotal = len(findings)\ncounts = {}\nfor f in findings:\n    counts[f.severity.value] = counts.get(f.severity.value, 0) + 1\nhigh = counts.get('HIGH', 0)\nmedium = counts.get('MEDIUM', 0)\nlow = counts.get('LOW', 0)\ninfo = counts.get('INFO', 0)\nfiles = []\nfor f in findings[:5]:\n    files.append({\"file\": f.file, \"line\": f.line_start, \"title\": f.title, \"severity\": f.severity.value})\nresult = {{\"total_findings\": total, \"high\": high, \"medium\": medium, \"low\": low, \"info\": info, \"top_files\": files}}\nprint(json.dumps(result))",
        path, path
    );

    let output = subprocess::Command::new("python3")
        .args(["-c", python_code])
        .output()
        .map_err(|e| format!("python subprocess failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.status.code() != 0 {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("python analyzer failed: {}", stderr));
    }
    let result: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("failed to parse python output: {}", e))?;
    Ok(result)
}
