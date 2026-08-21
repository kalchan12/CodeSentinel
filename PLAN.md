# PLAN.md — CodeSentinel

> **Purpose of this document:** the living execution plan for CodeSentinel. Unlike `PROJECT.md`, this document changes frequently. It answers: *what should we build next, in what order, why, and what's already done?*
>
> Agents **must** consult this file before starting implementation work, and **must** update it after completing meaningful work. See `AGENTS.md` §5.

---

## Active Task

```text
Phase:
Phase 0 — Project Foundation

Task:
Establish core documentation set (PROJECT.md, AGENTS.md, PLAN.md, SKILLS.md, SUGGESTIONS.md)

Status:
In Progress

Owner:
Developer + Agent

Started:
2026-08-21

Dependencies:
None

Next:
Initialize repository structure (apps/, engine/, packages/, tests/, docs/, scripts/, docker/)
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

**Status:** `In Progress`

```text
[-] Create repository structure
[x] Create PROJECT.md
[x] Create AGENTS.md
[x] Create PLAN.md
[x] Create SKILLS.md
[ ] Create SUGGESTIONS.md
[ ] Initialize Git workflow (main/develop branches, branch protection)
[ ] Configure development environment (Docker Compose for Postgres/Redis)
[ ] Create .env.example
[ ] Create base README
```

---

## 4. Phase 1 — UI/UX Design System

**Status:** `NEXT`

**Goal:** Create the reusable visual foundation of CodeSentinel.

```text
[ ] Define design tokens
[ ] Define color system
[ ] Define typography
[ ] Define spacing
[ ] Define border radius
[ ] Define shadows
[ ] Define icon system
[ ] Define button components
[ ] Define input components
[ ] Define badges
[ ] Define cards
[ ] Define tables
[ ] Define tabs
[ ] Define dialogs
[ ] Define drawers
[ ] Define tooltips
[ ] Define code blocks
[ ] Define severity indicators
[ ] Define loading states
[ ] Define empty states
[ ] Define error states
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

**Goal:** Build the permanent desktop application structure.

```text
[ ] Tauri shell
[ ] Next.js application
[ ] Sidebar
[ ] Collapsible sidebar
[ ] Top navigation
[ ] Project selector
[ ] Global search
[ ] Command palette
[ ] User/settings menu
[ ] Global notification system
[ ] Keyboard shortcuts
[ ] Responsive desktop behavior
```

**Validation:**

```text
Every major screen can use the same shell.
Navigation works.
Keyboard navigation works.
```

---

## 6. Phase 3 — Dashboard

```text
[ ] Dashboard layout
[ ] Security score component
[ ] Severity metrics
[ ] Security trend chart
[ ] Recent findings
[ ] Latest scans
[ ] Project security overview
[ ] Empty dashboard state
```

Use mock data initially. Do not couple dashboard components directly to a specific backend implementation detail.

---

## 7. Phase 4 — Project Management UI

```text
[ ] Projects page
[ ] Project cards/table
[ ] Add Project workflow
[ ] Local project selection
[ ] GitHub repository input
[ ] Project overview
[ ] Project metadata
[ ] Project security summary
[ ] Project scan history
```

---

## 8. Phase 5 — Scan Workflow UI

```text
[ ] Scan configuration
[ ] Analyzer selection
[ ] Advanced options
[ ] Scan start state
[ ] Live scan progress
[ ] Analyzer progress
[ ] Files analyzed
[ ] Findings discovered
[ ] Scan completion state
[ ] Scan failure state
```

The UI should be built ready for eventual Celery/WebSocket/event integration (see `PROJECT.md` §18) — even while using mock/simulated progress data now.

---

## 9. Phase 6 — Findings UI

```text
[ ] Findings table
[ ] Search
[ ] Filtering
[ ] Sorting
[ ] Severity filtering
[ ] Analyzer filtering
[ ] Category filtering
[ ] Finding detail
[ ] Code viewer
[ ] Evidence section
[ ] Remediation section
[ ] Finding status
[ ] Finding actions
```

---

## 10. Phase 7 — Security-Specific UI

```text
[ ] Dependency dashboard
[ ] Dependency graph
[ ] Secrets dashboard
[ ] Masked secret display
[ ] Configuration findings
[ ] Analyzer status
[ ] Security metrics
```

---

## 11. Phase 8 — AI UI

```text
[ ] AI availability indicator
[ ] AI provider settings
[ ] AI analysis panel
[ ] Finding AI analysis
[ ] AI explanation
[ ] AI remediation
[ ] AI secure code example
[ ] Local vs external model indicator
```

AI UI must not require the AI backend to exist yet — build against mock/stubbed responses matching the eventual `AIAnalysis` shape.

---

## 12. Phase 9 — Reporting UI

```text
[ ] Reports page
[ ] Generate report workflow
[ ] PDF option
[ ] JSON option
[ ] HTML option
[ ] Report history
[ ] Report status
```

---

## 13. Phase 10 — Backend Foundation

*Begin only after the UI foundation (Phases 1–9) is stable.*

```text
[ ] FastAPI project
[ ] Configuration
[ ] Database connection
[ ] SQLAlchemy
[ ] Alembic
[ ] PostgreSQL
[ ] Core models
[ ] API error handling
[ ] Health endpoints
[ ] Logging
```

---

## 14. Phase 11 — Project API

```text
[ ] Project CRUD
[ ] Local project registration
[ ] GitHub repository metadata
[ ] Repository validation
[ ] Project persistence
```

---

## 15. Phase 12 — Scan Job System

```text
[ ] Redis
[ ] Celery
[ ] Scan job model
[ ] Job creation API
[ ] Worker
[ ] Job status
[ ] Progress reporting
[ ] Cancellation
[ ] Failure handling
```

---

## 16. Phase 13 — Analysis Engine

Implement in this order:

```text
[ ] Analyzer interface
[ ] Analyzer registry
[ ] Analyzer execution framework
[ ] Semgrep integration
[ ] Gitleaks integration
[ ] Dependency analyzer
[ ] OSV integration
[ ] Tree-sitter foundation
[ ] Custom security rules
[ ] Configuration analyzer
[ ] Git analyzer
```

---

## 17. Phase 14 — Finding Pipeline

```text
[ ] Canonical finding model
[ ] Finding normalization
[ ] Finding persistence
[ ] Finding deduplication
[ ] Finding correlation
[ ] Evidence aggregation
[ ] Finding status management
```

---

## 18. Phase 15 — Risk Engine

```text
[ ] Define risk factors
[ ] Define scoring formula
[ ] Implement scoring engine
[ ] Implement confidence calculation
[ ] Implement severity mapping
[ ] Implement explainable scoring
[ ] Test scoring
[ ] Validate scoring with sample findings
```

Do not finalize the formula without research/testing — see `PROJECT.md` §14.

---

## 19. Phase 16 — AI Engine

```text
[ ] AI provider abstraction
[ ] OpenCode integration
[ ] Local model support
[ ] Context builder
[ ] Finding analysis
[ ] Remediation generation
[ ] False-positive analysis
[ ] AI result persistence
```

AI must remain optional at every step — see `PROJECT.md` §6.

---

## 20. Phase 17 — Reporting Engine

```text
[ ] Report model
[ ] Security summary
[ ] Finding report
[ ] Dependency report
[ ] Risk report
[ ] PDF generation
[ ] JSON export
[ ] HTML export
```

---

## 21. Phase 18 — Security Hardening

```text
[ ] Path traversal testing
[ ] Command injection testing
[ ] Repository URL validation
[ ] Secret leakage testing
[ ] Analyzer isolation
[ ] Local API security
[ ] Permission review
[ ] Dependency security review
[ ] Log review
```

---

## 22. Phase 19 — Testing

```text
[ ] Unit tests
[ ] Integration tests
[ ] Analyzer tests
[ ] Risk engine tests
[ ] Security tests
[ ] API tests
[ ] Database tests
[ ] Playwright E2E tests
```

---

## 23. Phase 20 — Capstone Polish

```text
[ ] UI polish
[ ] Accessibility review
[ ] Performance review
[ ] Security review
[ ] Architecture documentation
[ ] API documentation
[ ] User documentation
[ ] Demo dataset
[ ] Demo workflow
[ ] Final report
[ ] Presentation
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
