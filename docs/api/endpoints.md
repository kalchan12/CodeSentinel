# API Reference

Base URL (development): `http://localhost:8000/api`

OpenAPI/Swagger UI: `http://localhost:8000/docs`

## Health

### `GET /health`
Liveness plus database connectivity.
```json
{ "status": "ok", "database": "ok" }
```

## Projects

### `GET /projects`
List all projects (newest first) with scan count and latest scan summary.

### `POST /projects`
Create a project.

```json
{
  "name": "my-web-app",
  "description": "optional",
  "source_type": "local",          // "local" | "github"
  "local_path": "/abs/path",       // required when source_type=local
  "repo_url": "https://…"          // required when source_type=github
}
```
`422` when the local path does not exist / is not a directory, or the URL
is not http(s).

### `GET /projects/{id}`
Project detail including `scan_count` and `last_scan_*`.

### `DELETE /projects/{id}`
Deletes the project and all of its scans/findings. `204` on success, `404`
if unknown.

## Scans

### `POST /projects/{project_id}/scans`
Creates a scan (status `pending`) and enqueues the Celery job. Returns the
`Scan`. `503` if the worker broker is unreachable.

### `GET /scans/{scan_id}`
Scan status, progress, counts and (once computed) `risk_score`/`risk_level`.

### `GET /scans/{scan_id}/findings?severity=&category=&limit=`
Paginated findings filtered by `severity` and/or `category` (values use the
shared enums). Response: `{ "total": number, "items": Finding[] }`.

### `GET /scans/{scan_id}/assessment`
The explainable risk assessment:
```json
{
  "overall_score": 51.8,
  "overall_level": "high",
  "algorithm": "codesentinel-risk-v1",
  "rationale": "…",
  "breakdown": { "finding_count": 3, "severity_counts": {…}, "max_score": …, "weighted_average_score": … },
  "top_priorities": [ { "finding_id": "…", "title": "…", "file": "…", "severity": "…", "score": 51.8, "remediation": "…" } ],
  "finding_risks": [ … ]
}
```
`404` while the scan is still running.

### `GET /projects/{project_id}/scans`
Scan history for a project.

## Shared shapes

```ts
type Severity = "info" | "low" | "medium" | "high" | "critical";
type Confidence = "low" | "medium" | "high";
type Category =
  | "secrets" | "vulnerability" | "dependency" | "configuration"
  | "code_quality" | "repository" | "ai_insight";
type ScanStatus = "pending" | "running" | "completed" | "failed" | "canceled";
```

The TypeScript mirrors of all response shapes live in
`packages/shared/typescript/src/index.ts` (`@codesentinel/shared`) and must
stay in sync with the API (see the CI contract note in that file).