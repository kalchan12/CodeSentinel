# CodeSentinel --- Security Engineering Rules

## Security Objective

CodeSentinel processes potentially sensitive source code and potentially
malicious repositories. Security must protect both the user's data and
the CodeSentinel host application.

## Trust Model

### Trusted

-   CodeSentinel application code
-   explicitly configured local services

### Untrusted

-   scanned repository contents
-   GitHub repository contents
-   filenames and paths from repositories
-   manifest contents
-   Git metadata
-   source-code snippets
-   external advisory data
-   AI-generated output

## Non-Negotiables

1.  Never execute scanned repository code directly on the host.
2.  Treat paths, filenames, manifests, and source content as untrusted.
3.  Prevent path traversal and unsafe filesystem access.
4.  Avoid following dangerous symlink paths without explicit safety
    controls.
5.  Never log secrets or unnecessary source-code content.
6.  Redact detected secrets in UI, logs, and stored evidence where
    appropriate.
7.  Never place credentials in source control.
8.  Validate external input at trust boundaries.
9.  Keep local-first behavior as the default.
10. AI must not silently receive an entire repository.
11. External AI use must be explicit and documented.
12. Local services must not be assumed safe if exposed beyond the host.

## Repository Isolation

Scanning must account for: - malicious filenames - path traversal -
symlinks - malformed files - oversized repositories/files - parser edge
cases - command injection through repository-derived values

Any future dynamic analysis must use an appropriate sandbox/isolation
boundary.

## AI Data Boundary

AI context should be: - minimal - finding-focused - relevant to the
task - sanitized where necessary

AI output is untrusted and must not automatically modify code or execute
commands.

## Network

GitHub and OSV access should be explicit and failure-tolerant. Network
access must not be required for deterministic local analysis.

## Local Services

PostgreSQL, Redis, and FastAPI are part of the local application
environment. If a network-accessible mode is introduced, authentication,
authorization, binding, and transport security become mandatory.

## Tauri

Review: - IPC command exposure - filesystem permissions - external URL
handling - native process execution - untrusted content boundaries

## Security Testing

Include regression tests for: - path traversal - malicious repository
input - command/process injection - symlink handling - malformed
manifests - secret leakage - API validation - unsafe native operations -
oversized inputs
