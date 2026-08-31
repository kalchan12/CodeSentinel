# PLAN.md — CodeSentinel

> **Purpose of this document:** the living execution plan for CodeSentinel. Unlike `PROJECT.md`, this document changes frequently. It answers: *what should we build next, in what order, why, and what's already done?*
>
> Agents **must** consult this file before starting implementation work, and **must** update it after completing meaningful work. See `AGENTS.md` §5.

---

## Active Task

```text
Phase:
Phase 20 — Capstone Polish

Task:
Final application review and bug fixes

Status:
In Progress

Owner:
Developer + Agent

Started:
2026-08-30

Dependencies:
Phase 1-19 completion

Notes:
- Final polish, error boundaries, UI tweaks.

Next:
Project Completion
```

> Keep this section current. Every meaningful work session should start by reading it and end by updating it.

---

## 1. Plan Rules

Tasks are ordered, not a random backlog:

```text
Phase
    ↓
Milestone
    ↓
Task
    ↓
Subtask
```

Dependencies must be respected. Example:

```text
Design System
    ↓
Application Shell
    ↓
Dashboard
    ↓
Project Management
    ↓
Scan UI
    ↓
Findings UI
    ↓
Backend Integration
```

Do not build dependent functionality before its prerequisites exist.

---

## 2. Current Development Strategy

The developer has explicitly decided:

> **UI/UX is the first major development phase.**

The initial implementation focuses on building a polished CodeSentinel interface and design system *before* implementing the complete backend/security engine, using mock data where needed.

**Constraint:** UI work must remain architecturally compatible with the planned backend (see `PROJECT.md` §7, §17). Do not build fake/throwaway architecture that would make future backend integration harder — data shapes used by mock data should mirror the canonical `Finding` model and expected API responses wherever practical.

---

## 3. Phase 0 — Project Foundation

**Status:** `COMPLETED`

```text
[x] Create repository structure (apps/desktop, apps/backend, apps/shared, packages/*)
[x] Create PROJECT.md
[x] Create AGENTS.md
[x] Create PLAN.md
[x] Create SKILLS.md
[-] Create SUGGESTIONS.md
[x] Initialize Git workflow (main branch, conventional commits)
[x] Configure development environment (Docker Compose for Postgres/Redis)
[-] Create .env.example
[-] Create base README
```

---

## 4. Phase 1 — UI/UX Design System

**Status:** `COMPLETED`

**Goal:** Create the reusable visual foundation of CodeSentinel.

```text
[x] Define design tokens (full Material Design 3 token set in globals.css)
[x] Define color system (d0bcff primary, 15121b surface, full MD3 palette)
[x] Define typography (Inter + JetBrains Mono via next/font)
[x] Define spacing (4px base, 8px/16px/24px/40px scale)
[x] Define border radius (0.25rem default, 0.5rem lg, 0.75rem xl)
[x] Define shadows (tech-shadow, cyber-glow, luminous-glow)
[x] Define icon system (Material Symbols Outlined from Google Fonts)
[x] Define button components (primary, outline, ghost states)
[x] Define input components (search, text fields with focus rings)
[x] Define badges (severity badges: critical/high/medium/low/info)
[x] Define cards (surface-container-low bg, outline-variant border, tech-shadow)
[x] Define tables (header: surface-container-highest, rows: hover:surface-container)
[x] Define tabs (active/inactive states with primary color)
[x] Define dialogs (new project dialog with MD3 tokens)
[x] Define drawers (N/A - using sidebar instead)
[x] Define tooltips (N/A - using title attributes for now)
[x] Define code blocks (JetBrains Mono, line numbers, vulnerable line highlight)
[x] Define severity indicators (left-border-2, color-coded badges, dot indicators)
[x] Define loading states (Skeleton components)
[x] Define empty states (centered icon + text + CTA)
[x] Define error states (error color, warning icons)
[x] Add scanline grid background
[x] Add scanner-beam animation
[x] Add pulse-active animation
[x] Add progress-glow animation
```

**Validation:**

```text
All components use the same design system.
No duplicated visual patterns.
Accessibility considered.
Dark theme polished.
```

---

## 5. Phase 2 — Application Shell

**Status:** `COMPLETED`

```text
[x] Next.js application (output: export, transpilePackages)
[x] Sidebar (280px fixed, py-lg, bg-surface-container-low)
[x] Brand section (security icon + CodeSentinel title + "Local-First Security" subtitle)
[x] Run New Scan CTA (bg-primary, shadow glow)
[x] Nav items (8 items with active/inactive states, sidebar-active class)
[x] Footer items (Settings, Analyzer Status, Logs) with border separator
[x] Top navigation (fixed top, h-16, bg-surface, search + project breadcrumb)
[x] Global search (search icon + input with focus ring)
[x] Project selector (payments-api breadcrumb with primary color)
[x] User/settings menu (keyboard_command_key, notifications with error dot, account_circle)
[x] Responsive desktop behavior (md: breakpoint, sidebar hidden on mobile)
```

**Validation:**

```text
Every major screen can use the same shell.
Navigation works.
Keyboard navigation works.
```

---

## 6. Phase 3 — Dashboard

**Status:** `COMPLETED`

```text
[x] Dashboard layout (max-w-1440px, space-y-lg)
[x] Header (Good morning greeting + Export Report button)
[x] Security score component (semi-circle gauge, /100 display, trend indicator)
[x] Severity metrics (4-card bento: Critical/High/Medium/Low with left-border colors)
[x] Security trend chart (SVG line chart with gradient fill, x/y axis labels)
[x] Recent findings (list with severity badges, file location, description)
[x] Project security overview (table: name, score, findings count, last scan)
[x] Empty dashboard state (centered icon + text + Add Project CTA)
[x] Data loading from backend API (projects, scans, findings, assessment)
```

Use mock data initially. Do not couple dashboard components directly to a specific backend implementation detail.

---

## 7. Phase 4 — Project Management UI

**Status:** `COMPLETED`

```text
[x] Projects page (max-w-1440px, grid layout)
[x] Project cards (surface-container-low bg, blur glow, tech stack, findings badges)
[x] Add Project workflow (NewProjectDialog with MD3 tokens)
[x] Ghost card for adding new projects (dashed border, hover glow)
[x] Project overview (ProjectDetail component)
[x] Project metadata (repo URL, local path)
[x] Project security summary (score, findings breakdown)
[x] Project scan history (last scan time, scan count)
```

---

## 8. Phase 5 — Scan Workflow UI

**Status:** `COMPLETED`

```text
[x] Scan running state (header with radar icon + pulse animation)
[x] Global pipeline progress (progress bar with glow effect)
[x] Code viewer with scanner beam animation (line numbers, vulnerable code highlight)
[x] Live pipeline stepper (4 steps: Discovery, Source Analysis, Dependencies, Secrets)
[x] Pipeline step states (done: check icon, current: pulse, pending: outline)
[x] Metric cards (FILES, FINDINGS, SECRETS, DEPENDENCIES with count)
[x] Abort Scan button
[x] Scan ID and status display
[x] Polling integration for live updates
```

The UI should be built ready for eventual Celery/WebSocket/event integration (see `PROJECT.md` §18) — even while using mock/simulated progress data now.

---

## 9. Phase 6 — Findings UI

**Status:** `COMPLETED`

```text
[x] Findings table (scan page completed state)
[x] Severity filtering (select dropdown)
[x] Finding detail page (bento grid layout)
[x] Code viewer (line numbers, vulnerable line highlight with bg-error/10)
[x] Meta info card (risk score, confidence, location)
[x] AI Analysis panel (gradient background, primary glow, recommended fix)
[x] Metadata panel (discovered, scanner, rule, category, confidence, severity, line)
[x] Finding actions (Ignore, Mark Resolved buttons)
[x] Breadcrumb navigation (back to findings)
[x] Severity badge (color-coded with border)
[x] Explanation section ("Why it matters" with finding description)
```

---

## 10. Phase 7 — Security-Specific UI

```text
[ ] Dependency dashboard
[x] Dependency graph
[ ] Secrets dashboard
[ ] Masked secret display
[x] Configuration findings
[x] Analyzer status
[x] Security metrics
```

---

## 11. Phase 8 — AI UI

```text
[x] AI availability indicator
[x] AI provider settings
[x] AI analysis panel
[x] Finding AI analysis
[x] AI explanation
[x] AI remediation
[x] AI secure code example
[x] Local vs external model indicator
```

AI UI must not require the AI backend to exist yet — build against mock/stubbed responses matching the eventual `AIAnalysis` shape.

---

## 12. Phase 9 — Reporting UI

```text
[x] Reports page
[x] Generate report workflow
[x] PDF option
[x] JSON option
[x] HTML option
[x] Report history
[x] Report status
```

---

## 13. Phase 10 — Backend Foundation

*Begin only after the UI foundation (Phases 1–9) is stable.*

```text
[x] FastAPI project
[x] Configuration
[x] Database connection
[x] SQLAlchemy
[x] Alembic
[x] PostgreSQL
[x] Core models
[x] API error handling
[x] Health endpoints
[x] Logging
```

---

## 14. Phase 11 — Project API

```text
[x] Project CRUD
[x] Local project registration
[x] GitHub repository metadata
[x] Repository validation
[x] Project persistence
```

---

## 15. Phase 12 — Scan Job System

```text
[x] Redis
[x] Celery
[x] Scan job model
[x] Job creation API
[x] Worker
[x] Job status
[x] Progress reporting
[x] Cancellation
[x] Failure handling
```

---

## 16. Phase 13 — Analysis Engine

Implement in this order:

```text
[x] Analyzer interface
[x] Analyzer registry
[x] Analyzer execution framework
[x] Semgrep integration
[x] Gitleaks integration
[x] Dependency analyzer
[x] OSV integration
[x] Tree-sitter foundation
[x] Custom security rules
[x] Configuration analyzer
[x] Git analyzer
```

---

## 17. Phase 14 — Finding Pipeline

```text
[x] Canonical finding model
[x] Finding normalization
[x] Finding persistence
[x] Finding deduplication
[x] Finding correlation
[x] Evidence aggregation
[x] Finding status management
```

---

## 18. Phase 15 — Risk Engine

```text
[x] Define risk factors
[x] Define scoring formula
[x] Implement scoring engine
[x] Implement confidence calculation
[x] Implement severity mapping
[x] Implement explainable scoring
[x] Test scoring
[x] Validate scoring with sample findings
```

Do not finalize the formula without research/testing — see `PROJECT.md` §14.

---

## 19. Phase 16 — AI Engine

```text
[x] AI provider abstraction
[x] OpenCode integration
[x] Local model support
[x] Context builder
[x] Finding analysis
[x] Remediation generation
[x] False-positive analysis
[x] AI result persistence
```

AI must remain optional at every step — see `PROJECT.md` §6.

---

## 20. Phase 17 — Reporting Engine

```text
[x] Report model
[x] Security summary
[x] Finding report
[x] Dependency report
[x] Risk report
[x] PDF generation
[x] JSON export
[x] HTML export
```

---

## 21. Phase 18 — Security Hardening

```text
[x] Path traversal testing
[x] Command injection testing
[x] Repository URL validation
[x] Secret leakage testing
[x] Analyzer isolation
[x] Local API security
[x] Permission review
[x] Dependency security review
[x] Log review
```

---

## 22. Phase 19 — Testing

```text
[x] Unit tests
[x] Integration tests
[x] Analyzer tests
[x] Risk engine tests
[x] Security tests
[x] API tests
[x] Database tests
[x] Playwright E2E tests
```

---

## 23. Phase 20 — Capstone Polish

```text
[x] UI polish
[x] Accessibility review
[x] Performance review
[x] Security review
[x] Architecture documentation
[x] API documentation
[x] User documentation
[x] Demo dataset
[x] Demo workflow
[x] Final report
[x] Presentation
```

---

## 24. Task Status Legend

```text
[ ] Not Started
[-] In Progress
[x] Complete
[!] Blocked
[~] Deferred
```

---

## 25. Plan Change Log

```text
### 2026-08-31
Changed:
Refactored architecture to "Zero-Docker" (removed PostgreSQL, Redis, Celery in favor of SQLite and FastAPI BackgroundTasks).

Reason:
To simplify local deployment and remove Docker dependencies as requested by the developer.

Impact:
Removed docker-compose.yml and updated dev scripts. Updated PROJECT.md architecture decisions.

### 2026-08-21

Changed:
Initial creation of PLAN.md with Phases 0–20 and Active Task set to Phase 0 documentation setup.

Reason:
Project kickoff — establishing baseline execution roadmap.

Impact:
None (baseline).

Next:
Complete Phase 0 (SUGGESTIONS.md, git workflow, dev environment, .env.example, README), then begin Phase 1.
```

Only record meaningful planning changes here — not every checkbox tick (those live in the checklists themselves and in commit history).

---

## 26. Agent Interaction Model

**When asked "what should we work on next?"**
→ Inspect this file, find the current phase, and identify the next unblocked, un-started task.

**When told "let's work on the UI":**

1. Inspect the current UI phase (Phase 1–9, whichever is active).
2. Identify the next task in that phase.
3. Briefly explain what it involves.
4. If the task involves a meaningful implementation choice, ask before proceeding.
5. Break the task into subtasks if needed.
6. Implement.
7. Test.
8. Update this file (checklist + Active Task section).

---

## 27. Dependency Rule

Never mark a task complete if its required dependencies are incomplete. Example: `Findings API` (Phase 11+) cannot be marked complete before `Database`, `Finding Model`, and `FastAPI foundation` (Phase 10) are ready.

---

## 28. No Random Backlog

Do not append random new tasks to the bottom of this file. New tasks belong in the phase they logically fit. If a task is not currently justified by the active phase or an explicit requirement, put it in `SUGGESTIONS.md` instead (see `AGENTS.md` §19).

---

## 29. Plan Evolution

The plan is allowed to change, but:

- Major changes require developer approval.
- Completed work should never be erased from the record (mark deferred/superseded, don't delete).
- Deferred work should be explicitly marked `[~]`.
- New dependencies introduced by a plan change must be documented here.
- Any change that touches architecture must also be reflected in `PROJECT.md` (Decision Log).

---

## 30. Document Responsibilities (Reference)

- `PROJECT.md` answers: **What is CodeSentinel?**
- `PLAN.md` (this file) answers: **What are we building next?**
- `AGENTS.md` answers: **How should AI agents work?**
- `SKILLS.md` answers: **What capabilities/tools can agents use?**
- `SUGGESTIONS.md` answers: **What ideas and improvements are worth considering?**

Keep these responsibilities separate — don't let planning content drift into `PROJECT.md`, or architectural decisions get buried in `PLAN.md`.
