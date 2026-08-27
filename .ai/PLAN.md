# CodeSentinel --- Living Development Plan

> This file is authoritative for development order. Update it after
> meaningful work.

## Current State

**Current phase:** Phase 1 --- UI Foundation and Product UX\
**Current task:** Finalize Settings view and prepare Native Desktop Integration (Phase 2).\
**Status:** In progress\
**Blockers:** None currently known

## Phase 0 --- Stabilize Existing Vertical Slice

-   [x] Fix Tree-sitter `_walk_calls` traversal hang/infinite-loop behavior.
-   [x] Fix Celery progress callback database-session lifecycle.
-   [x] Add regression tests for both defects.
-   [x] Run a complete local scan against representative repositories.
-   [x] Verify persistence, findings, risk scoring, and job failure behavior.

**Exit criteria:** A full scan completes reliably without hanging or using closed DB sessions (Satisfied).

## Phase 1 --- UI Foundation and Product UX

-   [x] Establish design tokens and reusable UI primitives.
-   [x] Implement consistent desktop application shell.
-   [x] Dashboard (`/`)
-   [x] Projects (`/projects`)
-   [x] Project detail (`/projects`)
-   [x] New scan workflow (`/scan`)
-   [x] Scan progress (`/scan`)
-   [x] Findings list/filtering (`/scan`, `/finding`)
-   [x] Finding detail (`/finding`)
-   [x] Dependencies (`/dependencies`)
-   [x] Secrets (`/secrets`)
-   [x] Reports (`/reports`)
-   [x] AI analysis (`/ai-analysis`)
-   [ ] Settings (`/settings`)
-   [x] Accessibility/HCI review

**Exit criteria:** All primary workflows are usable, responsive, and visually consistent.

## Phase 2 --- Native Desktop Integration

-   [ ] Native local-directory picker.
-   [ ] Safe repository-path handoff.
-   [ ] Desktop notifications.
-   [ ] Open/reveal relevant files or directories where appropriate.

## Phase 3 --- Real-Time Scan Events

-   [ ] Define scan event/state contract.
-   [ ] Connect Redis events to FastAPI.
-   [ ] Prefer SSE for server-to-UI scan progress unless bidirectional
    communication becomes necessary.
-   [ ] Replace frontend polling.
-   [ ] Test reconnect/failure behavior.

## Phase 4 --- Analysis Engine Hardening

-   [ ] Standardize analyzer lifecycle/error handling.
-   [ ] Verify analyzer isolation.
-   [ ] Improve repository/file filtering.
-   [ ] Add regression fixtures for supported languages and manifests.
-   [ ] Improve resource/time limits where needed.

## Phase 5 --- Finding Correlation

-   [ ] Define deterministic correlation signals.
-   [ ] Implement duplicate/overlap detection.
-   [ ] Preserve evidence from contributing analyzers.
-   [ ] Test false merges and missed merges.

## Phase 6 --- Risk Assessment

-   [ ] Review `codesentinel-risk-v1`.
-   [ ] Document formula and factors.
-   [ ] Normalize score boundaries.
-   [ ] Add explainability output.
-   [ ] Test edge cases and ranking behavior.

## Phase 7 --- Dependency and Repository Security

-   [ ] Strengthen supported manifest coverage.
-   [ ] Improve OSV lookup/error handling.
-   [ ] Consider local advisory caching.
-   [ ] Harden Git/repository hygiene checks.

## Phase 8 --- AI Analysis

-   [ ] Replace arbitrary file-budget context extraction with
    finding-focused context.
-   [ ] Define AI provider interface.
-   [ ] Integrate OpenCode/compatible provider.
-   [ ] Add local-model path where supported.
-   [ ] Add finding explanation.
-   [ ] Add remediation suggestions.
-   [ ] Enforce AI data-boundary rules.

## Phase 9 --- Reporting and History

-   [ ] Scan history.
-   [ ] Finding history/status.
-   [ ] Risk trends.
-   [ ] Report generation.
-   [ ] JSON/CSV export.
-   [ ] PDF export if required.

## Phase 10 --- Security Hardening

-   [ ] Test malicious repositories.
-   [ ] Test path traversal/symlink cases.
-   [ ] Test command/process injection paths.
-   [ ] Test oversized/malformed inputs.
-   [ ] Review secrets in logs/errors.
-   [ ] Review Tauri IPC and native boundaries.
-   [ ] Document network-exposure assumptions.

## Phase 11 --- Testing and Reliability

-   [ ] Unit coverage for engine primitives.
-   [ ] Integration coverage for scan pipeline.
-   [ ] API/worker tests.
-   [ ] Frontend component tests where valuable.
-   [ ] Playwright end-to-end workflows.
-   [ ] Security regression suite.
-   [ ] Reproducible test fixtures.

## Phase 12 --- Capstone Finalization

-   [ ] Architecture documentation.
-   [ ] Concept-synthesis mapping.
-   [ ] Security/threat-model documentation.
-   [ ] Final testing evidence.
-   [ ] Performance observations.
-   [ ] User workflow documentation.
-   [ ] Final demo/release preparation.

## Agent Rules

-   Work on the current task first.
-   Break large tasks into subtasks before implementation.
-   Do not silently skip phases.
-   Do not mark work complete without verification.
-   If scope or architecture must change, ask the project owner first.
-   Update this file immediately after meaningful progress.
