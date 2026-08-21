# PROJECT.md — CodeSentinel

> **Status of this document:** Authoritative. This file is the single source of truth for what CodeSentinel is, why it exists, and how it is architected. Any AI agent, sub-agent, contributor, or supervisor should be able to read this file alone and understand the entire project.
>
> Details not yet finalized are explicitly marked `Status: TBD` or `Status: Proposed`. Nothing in this document should be read as a hard decision unless it says `Status: Accepted`.

---

## PROJECT IDENTITY

| Field | Value |
|---|---|
| Codename | **CodeSentinel** |
| Academic title | Local-First Secure Source Code Analysis & Risk Assessment Platform |
| Project type | University Computer Science / Computer Engineering Capstone |
| Primary domain | Cybersecurity + Software Engineering + Static Analysis |
| Document owner | Capstone developer(s) — final authority on all `Accepted` decisions |

---

## 1. Project Overview

CodeSentinel is a **local-first desktop application** that lets a developer point at either:

- a local source-code project on disk, or
- a GitHub repository (cloned locally for analysis),

and receive a consolidated, explainable security assessment of that codebase.

CodeSentinel is explicitly **not** a wrapper around a single tool. It is an orchestration and correlation layer that runs several independent analysis engines against the same codebase, reconciles their output into one internal model, and produces a risk-ranked, developer-readable result. The value of the platform is in the pipeline stages *between* the raw scanners and the final report — normalization, correlation, and risk scoring — not in any individual scanner.

### Core Pipeline

```text
Repository
    ↓
Repository Discovery
    ↓
Analysis Orchestration
    ↓
Multiple Security Analyzers
    ↓
Finding Normalization
    ↓
Finding Correlation
    ↓
Risk Assessment
    ↓
Optional AI Analysis
    ↓
Prioritization
    ↓
Reporting / Remediation
```

### Stage Responsibilities

| Stage | Responsibility |
|---|---|
| **Repository Discovery** | Locate and index the target codebase: enumerate files, detect languages/frameworks, resolve manifest files (e.g. `package.json`, `requirements.txt`), and identify the repository's structure before any analyzer runs. |
| **Analysis Orchestration** | Decide which analyzers apply to this repository, schedule them as background jobs, track progress, and handle partial failure (one analyzer failing must not block the others). |
| **Multiple Security Analyzers** | Independently scan the codebase for a specific concern each (SAST rules, secrets, dependency CVEs, config issues, git history risk, AST-based custom checks). Each analyzer only knows its own domain. |
| **Finding Normalization** | Convert each analyzer's proprietary output format into the single canonical `Finding` model (see §11), so nothing downstream needs to know which tool produced a result. |
| **Finding Correlation** | Detect when multiple analyzers (or the same analyzer, across files) are reporting the same underlying issue, and merge them into one correlated issue with combined evidence. |
| **Risk Assessment** | Convert normalized/correlated findings into an explainable 0–100 risk score using documented, inspectable factors — never a black box. |
| **Optional AI Analysis** | If enabled, enrich findings with context, explanation, false-positive assessment, and remediation suggestions. Never required for the platform to function. |
| **Prioritization** | Rank findings for the developer by combined risk, exploitability, and project context so the highest-impact issues surface first. |
| **Reporting / Remediation** | Present findings in the UI and export them (PDF/JSON/HTML) with concrete, actionable remediation guidance. |

---

## 2. Problem Statement

CodeSentinel exists because of a cluster of related, well-documented problems in developer-facing security tooling:

- **Late discovery.** Security issues are frequently found in production or during an audit, not during development, when they are cheapest to fix.
- **Unreadable output.** Scanner output is often a rule ID and a severity label with no context a working developer can act on.
- **Tool inconsistency.** Different scanners disagree on severity, naming, and even whether something is a real issue, with no reconciliation layer.
- **Duplicate noise.** The same underlying vulnerability is frequently reported multiple times by different tools (or the same tool in different files), inflating perceived issue counts.
- **Severity ≠ risk.** A scanner's default severity is about the *class* of bug, not this project's actual exposure (Is it reachable? Is it internet-facing? Is the dependency even used at runtime?).
- **Missing context.** Developers need "why this matters and how to fix it here," not just a CWE ID.
- **Privacy cost of cloud scanning.** Many commercial platforms require uploading source code to a third party, which is unacceptable for many teams, students, and proprietary codebases.
- **Cost barrier.** Enterprise-grade security tooling is often priced out of reach for students, small teams, and open-source maintainers.
- **Tool fragmentation.** A team wanting SAST + secret detection + dependency scanning + config review today needs to adopt, learn, and maintain several unrelated tools with no shared workflow.

CodeSentinel addresses these by: running analysis entirely on the developer's machine by default (no privacy cost, no cost barrier for the core tool), unifying multiple analyzers behind one canonical data model (removes fragmentation and inconsistency), actively deduplicating and correlating findings (removes noise), computing an explainable project-specific risk score (severity vs. risk gap), and offering optional AI enrichment purely as a layer on top for explanation and remediation (context problem), never as a requirement.

---

## 3. Project Objectives

### Primary Objectives

- Build a local-first source-code security platform that runs on the developer's own machine.
- Support analysis of both local filesystem projects and GitHub repositories.
- Integrate multiple independent security analyzers behind a common interface.
- Normalize heterogeneous analyzer output into one canonical finding model.
- Correlate duplicate and related findings across analyzers.
- Calculate an explainable, factor-based risk score per finding and per project.
- Provide a developer-friendly, security-focused reporting UI.
- Support optional, provider-independent AI-assisted analysis.

### Secondary Objectives

- Maintain historical scan records per project.
- Track security trend data over time (score/finding count history).
- Analyze third-party dependencies for known vulnerabilities.
- Detect exposed secrets and credentials.
- Analyze common security misconfigurations.
- Generate exportable reports (PDF/JSON/HTML).
- Keep the analyzer architecture extensible so new analyzers can be added later.
- Keep the overall system modular so components can be modified independently.

### Future Objectives *(explicitly out of MVP scope)*

- Dynamic/runtime analysis (sandboxed execution of scanned code).
- Multi-user / team collaboration features.
- CI/CD pipeline integration (e.g., GitHub Actions check).
- Plugin marketplace for third-party analyzers.
- Cloud-hosted / SaaS deployment option.
- IDE extensions (VS Code, JetBrains).
- Multi-repository / organization-wide dashboards.

`Status: Proposed — future roadmap, not committed to any capstone milestone.`

---

## 4. Non-Goals

CodeSentinel explicitly does **not** aim to be:

- A generic code-quality/style linter (that is a separate concern from security).
- Simply a Semgrep dashboard with a UI bolted on.
- Simply a Gitleaks dashboard with a UI bolted on.
- A "ChatGPT wrapper" — AI is one optional enrichment layer among several, not the product.
- A cloud-first SaaS platform.
- A full automated penetration-testing framework.
- A SOC/SIEM or log-monitoring product.
- An enterprise vulnerability management platform (asset inventory, ticketing integrations, compliance workflows, etc.).
- A system that executes arbitrary repository code directly on the host machine.

Keeping this list explicit protects the capstone timeline: every feature request should be checked against this list before being added to `PLAN.md`. If a suggestion falls outside these boundaries, it belongs in `SUGGESTIONS.md`, not the active plan.

---

## 5. Local-First Principle *(core architectural requirement)*

```text
Source Code
     ↓
Developer Machine
     ↓
CodeSentinel
     ↓
Local Analysis
     ↓
Local Database
```

- Source code never leaves the developer's machine by default.
- Scan results are stored in a local database (PostgreSQL, run locally via Docker).
- The full non-AI pipeline (discovery → analyzers → normalization → correlation → risk scoring → reporting) must function **fully offline**.
- Any feature that talks to an external service (AI providers, live CVE feeds, GitHub API) must be:
  - clearly optional,
  - explicitly enabled by the user, and
  - degrade gracefully to "unavailable" rather than blocking the rest of the pipeline.
- **Privacy rationale:** this is a direct response to the "source code must leave the machine" problem identified in §2, and is a primary differentiator from cloud-based competitors.

---

## 6. AI Principle

```text
Traditional Analysis
+
Custom Static Analysis
+
Risk Algorithms
+
Optional AI
```

AI is an **enrichment layer**, not a foundation. The platform must be fully usable — discovery, scanning, normalization, correlation, risk scoring, and reporting — with AI completely disabled.

AI may be used for:

- Contextual analysis of a finding within the surrounding code.
- Plain-language explanation of *why* something is a risk.
- False-positive investigation / triage assistance.
- Remediation guidance and secure code suggestions.
- Assisting (not overriding) vulnerability prioritization.
- Relationship analysis between findings (as an input to correlation, never the sole basis).

**Provider independence is a hard requirement.** The AI layer must be built behind an abstraction so no other part of the system depends on a specific model or vendor.

- **OpenCode** is the currently planned initial integration. `Status: Planned`
- Local model support (e.g., via a local inference server) should be supported where practical. `Status: Proposed`
- The architecture must never assume a single provider is always available — AI calls must be optional, timeout-safe, and fail without breaking the rest of the pipeline.

---

## 7. System Architecture

```text
┌─────────────────────────────┐
│      Tauri Desktop App      │
│ Next.js + React + TypeScript│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│           FastAPI            │
│       Application API        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│     Redis + Celery Queue     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│       Analysis Engine        │
├─────────────────────────────┤
│ Semgrep                      │
│ Gitleaks                     │
│ Tree-sitter                  │
│ Dependency Analyzer           │
│ Configuration Analyzer        │
│ Git Analyzer                  │
│ Custom Rules                  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Finding Normalization        │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│  Finding Correlation          │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│  Risk Assessment Engine       │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  PostgreSQL         AI Provider
                          │
                       OpenCode
                          │
                    Local Models
```

### Component Responsibilities

- **Tauri Desktop App** — the user-facing shell. Hosts a Next.js/React/TypeScript frontend and exposes native desktop capabilities (filesystem access for "local project" selection) via Tauri's Rust bridge.
- **FastAPI Application API** — the local backend service the desktop app talks to. Owns all business logic, validation, and persistence access. The frontend never talks to the database or analyzers directly.
- **Redis + Celery Queue** — decouples long-running scans from the request/response cycle. A scan is *created* synchronously via the API but *executed* asynchronously by a worker.
- **Analysis Engine** — a registry of independent analyzers, each responsible for one concern (see §10).
- **Finding Normalization** — converts each analyzer's raw output into the canonical `Finding` schema (see §11–12).
- **Finding Correlation** — merges findings that represent the same underlying issue (see §13).
- **Risk Assessment Engine** — computes an explainable 0–100 score per finding/project (see §14).
- **PostgreSQL** — system of record for projects, scans, findings, and history.
- **AI Provider layer** — optional, pluggable enrichment (OpenCode planned; local models proposed).

---

## 8. Technology Stack

Each entry includes *why* it was chosen. Technologies are not to be added because they are popular — see AGENTS.md §14 for the dependency-addition rule.

### Desktop
| Tech | Reason |
|---|---|
| Tauri | Lightweight, secure native desktop shell (smaller footprint and attack surface than Electron); needed for real filesystem access to local repositories. |
| Next.js | Mature React framework, good DX, works well embedded in Tauri's webview. |
| React | Component model matches the UI's complexity (dashboards, tables, live scan views). |
| TypeScript | Strong typing across a large, multi-screen frontend reduces integration bugs. |
| Tailwind CSS | Utility-first styling keeps the custom design system (see §19) consistent without hand-rolled CSS sprawl. |
| shadcn/ui | Accessible, unstyled component primitives that can be fully re-skinned to the CodeSentinel design language rather than fighting a themed library. |

### Backend
| Tech | Reason |
|---|---|
| Python | Required for first-class access to the security tooling ecosystem (Semgrep, Gitleaks bindings, OSV, custom AST tooling). |
| FastAPI | Async-first, typed, auto-documented API framework; pairs naturally with Pydantic. |
| Pydantic | Enforces the canonical Finding model and request/response validation everywhere. |
| SQLAlchemy | ORM for the relational scan/finding/project data model. |
| Alembic | Schema migrations as the data model evolves through capstone phases. |

### Analysis
| Tech | Reason |
|---|---|
| Tree-sitter | Language-agnostic AST parsing, foundation for custom static analysis rules beyond what Semgrep covers out of the box. |
| Semgrep | Mature, rule-based SAST engine with broad language support. |
| Gitleaks | Purpose-built secret detection across files and git history. |
| OSV | Open, vendor-neutral vulnerability database for dependency scanning. |
| Custom Python analyzers | Cover gaps not addressed by off-the-shelf tools (config analysis, git-history risk heuristics). |
| Git tooling | Needed for git-history-aware analysis (e.g., secrets committed and later removed). |

### Background Processing
| Tech | Reason |
|---|---|
| Celery | Mature async task queue for long-running scan jobs. |
| Redis | Broker/result backend for Celery; also useful for lightweight caching. |

### Database
| Tech | Reason |
|---|---|
| PostgreSQL | Relational model fits the Project → Scan → Finding → Evidence structure well; strong JSON support for flexible metadata fields. |

### Infrastructure
| Tech | Reason |
|---|---|
| Docker / Docker Compose | Reproducible local dev environment (Postgres, Redis, backend) without polluting the host machine. |
| GitHub Actions | CI for tests/lint on push and PR. |

### Testing
| Tech | Reason |
|---|---|
| Pytest | Backend unit/integration/security test runner. |
| Playwright | End-to-end testing of the actual desktop UI flows. |

---

## 9. Repository Structure

```text
codesentinel/
├── apps/
│   ├── desktop/
│   │   ├── src/                # Next.js/React frontend source
│   │   └── src-tauri/          # Tauri (Rust) shell, native bridge
│   └── backend/
│       └── app/                # FastAPI application
│
├── engine/
│   ├── core/                   # Orchestration, job coordination
│   ├── analyzers/               # Individual analyzer implementations
│   ├── normalization/           # Raw output → canonical Finding
│   ├── correlation/             # Duplicate/related-finding merging
│   ├── risk/                    # Risk scoring engine
│   ├── ai/                      # AI provider abstraction + integrations
│   └── models/                  # Shared canonical data models (Finding, etc.)
│
├── packages/
│   └── shared/                  # Code shared between desktop and backend (types, constants)
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── e2e/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── research/                 # Risk-formula research, correlation research, etc.
│
├── scripts/                      # Dev/setup/utility scripts
├── docker/                       # Dockerfiles, compose overrides
├── .github/
│   └── workflows/                # CI pipelines
│
├── PROJECT.md
├── AGENTS.md
├── PLAN.md
├── SKILLS.md
├── SUGGESTIONS.md
├── docker-compose.yml
└── README.md
```

`Status: Proposed` — directory layout may adjust slightly once `apps/backend` and `engine/` are scaffolded, but the separation of **app layer** (`apps/`) from **domain engine** (`engine/`) is an `Accepted` architectural boundary: UI and API code must not contain analyzer logic, and analyzer logic must not depend on FastAPI/Tauri types.

---

## 10. Analyzer Architecture

```text
Analyzer
├── SemgrepAnalyzer
├── GitleaksAnalyzer
├── TreeSitterAnalyzer
├── DependencyAnalyzer
├── ConfigurationAnalyzer
├── GitAnalyzer
└── AIAnalyzer
```

- All analyzers implement one shared interface (exact method signatures: `Status: TBD`, to be defined in `engine/analyzers/base`).
- Analyzers must be **independently replaceable** — swapping Semgrep for another SAST engine should not require changes outside the analyzer module and its normalizer.
- Every analyzer's job is to produce its own raw result *and* hand off to a matching normalizer that converts that raw result into the canonical `Finding` (§11). No analyzer writes directly to the database.
- `AIAnalyzer` is architecturally an analyzer like any other, but is always optional and never blocks the rest of the pipeline if disabled or unavailable.

---

## 11. Finding Model

The canonical, analyzer-agnostic representation every finding is converted into.

| Field | Description |
|---|---|
| `ID` | Unique identifier for the finding. |
| `Analyzer` | Which analyzer produced the raw signal (e.g. `semgrep`, `gitleaks`). |
| `Rule ID` | The originating rule/check identifier from that analyzer. |
| `Category` | Normalized category (e.g. `injection`, `secret-exposure`, `vulnerable-dependency`, `misconfiguration`). |
| `Title` | Short, human-readable summary. |
| `Description` | Full explanation of the issue. |
| `Severity` | Normalized severity (analyzer's native severity mapped to a common scale — see §14). |
| `Confidence` | How confident the analyzer/system is that this is a true positive. |
| `Risk Score` | Output of the Risk Assessment Engine (0–100), not the analyzer's raw severity. |
| `File` | Path to the affected file. |
| `Line Start` / `Line End` | Location of the issue. |
| `Code Snippet` | Relevant excerpt for context. |
| `Evidence` | Supporting data (matched pattern, secret pattern match, CVE reference, etc.) — never the raw secret value itself (see §15). |
| `Remediation` | Actionable guidance, optionally AI-enriched. |
| `Status` | Lifecycle state (e.g. `open`, `acknowledged`, `false_positive`, `resolved`). `Status: TBD` for the exact enum. |
| `Metadata` | Analyzer-specific extra data that doesn't fit the standard fields, kept as structured JSON so nothing is lost in normalization. |

---

## 12. Finding Normalization

Raw analyzer output formats differ completely:

```text
Semgrep JSON
Gitleaks JSON
OSV JSON
Custom Analyzer Output
AI Output
```

Each of these is converted by a dedicated normalizer into:

```text
Canonical Finding
```

This is the boundary that keeps the rest of the system analyzer-independent: correlation, risk scoring, the API, and the UI only ever operate on canonical `Finding` objects. Adding or removing an analyzer should never require changes to correlation, risk scoring, or the frontend — only to that analyzer's normalizer.

---

## 13. Finding Correlation

Different analyzers frequently flag the same underlying issue in different ways:

```text
Semgrep
   ↓
SQL Injection

Custom AST Analyzer
   ↓
Unsafe SQL Construction

AI
   ↓
Likely SQL Injection

        ↓

Correlated Security Issue
```

Correlation should progressively incorporate (in roughly this order of implementation):

1. File + line-range proximity.
2. Rule/category similarity.
3. Code similarity (structural, not just string match).
4. Evidence similarity.
5. Data-flow relationships (later phase — see PLAN.md Phase 14).
6. Confidence weighting across analyzers.
7. Analyzer metadata as a tie-breaker.

**Explainability requirement:** whatever correlation logic is implemented, it must be able to show *why* two findings were merged (which factors matched), not just present a merged result. A black-box similarity score is not acceptable.

`Status: Proposed` for the exact algorithm/thresholds — this needs research and validation before being finalized (see §14 and PLAN.md Phase 15 for the parallel requirement on risk scoring).

---

## 14. Risk Engine

Risk factors under consideration:

```text
Severity
Confidence
Exploitability
Impact
Exposure
Context
Dependency impact
```

Final score is normalized to **0–100**.

**Provisional** classification bands — `Status: Proposed`, must be researched/validated during implementation, not treated as final:

| Range | Label |
|---|---|
| 0–20 | Low |
| 21–40 | Moderate |
| 41–60 | Medium |
| 61–80 | High |
| 81–100 | Critical |

**Hard requirement:** the engine must be explainable. Every risk score must be traceable to the specific factor values that produced it (e.g., "Severity: High, Confidence: 0.9, Exploitability: Network-reachable → Score: 78"). A score with no visible breakdown is not acceptable output.

---

## 15. Security Model

CodeSentinel analyzes untrusted, potentially malicious source code by definition. Security requirements:

- Never execute arbitrary repository code directly on the host.
- Treat all repository contents (source files, config, git history) as untrusted input.
- Mask detected secrets in the UI, logs, and exports — never display or log a full secret value.
- Avoid logging secret values under any circumstance, including debug logs.
- Validate all external repository URLs before cloning (protocol allowlist, no arbitrary local paths via SSRF-style tricks).
- Sanitize and validate all file paths derived from repository content.
- Prevent path traversal in any operation that reads/writes based on a repo-supplied path.
- Apply least privilege to any process that touches repository content.
- Protect local API endpoints (the FastAPI service should not be trivially reachable/controllable by other local processes without validation). `Status: TBD` for exact local-auth mechanism.
- Avoid unsafe shell execution (`shell=True` equivalents); prefer argument-list subprocess calls with validated inputs.
- Validate all arguments passed to any analyzer subprocess.
- Separate analysis processes from the main application process where appropriate, to contain failures/misbehavior.
- Consider process/container sandboxing as a prerequisite for any future dynamic analysis feature (explicitly future scope — see §3).

---

## 16. Database Model

Expected entities (relationships and exact schema are implementation decisions — `Status: TBD`, not to be locked in prematurely):

```text
Project
Repository
Scan
ScanJob
Finding
FindingEvidence
Dependency
Vulnerability
RiskAssessment
AIAnalysis
Report
Analyzer
```

Expected high-level relationships:

- A `Project` has one `Repository` (local path or GitHub source) and many `Scan`s.
- A `Scan` is backed by one or more `ScanJob`s (one per analyzer run) and produces many `Finding`s.
- A `Finding` has zero or more `FindingEvidence` records and at most one `RiskAssessment`.
- A `Finding` may have zero or one `AIAnalysis` (only if AI enrichment was run).
- `Dependency` records relate to `Vulnerability` records (many-to-many via scan results).
- A `Report` is generated from a `Scan`'s finding set at a point in time (a snapshot, not a live view).

Do not treat this list as the final schema — it exists to keep implementation aligned with the conceptual model, not to pre-decide column-level detail.

---

## 17. API Architecture

Expected route groups:

```text
/projects
/scans
/findings
/dependencies
/secrets
/reports
/analyzers
/ai
/settings
/system
```

Principles:

- REST where the resource model fits naturally; avoid RPC-style endpoints unless there's a clear reason.
- All request/response bodies validated via Pydantic models.
- Consistent error response shape across the whole API. `Status: TBD` for exact error envelope.
- Authentication/authorization appropriate for a **local** IPC/API architecture — this is not a multi-tenant cloud API, but the endpoint should still not be trivially abusable by arbitrary local processes. `Status: TBD`.
- All job-like operations (scans, report generation) are async — the API creates a job and returns immediately; it never blocks on a long-running scan inside a normal HTTP request/response cycle.

---

## 18. Asynchronous Processing

```text
Desktop
   ↓
FastAPI
   ↓
Create Scan Job
   ↓
Redis
   ↓
Celery Worker
   ↓
Analyzer
   ↓
Database
   ↓
Frontend Poll/WebSocket/Event
```

This architecture exists because scans can run for a long time (multiple analyzers over potentially large codebases) and the UI must remain responsive and show live progress. A synchronous request/response model would either time out or freeze the UI. The exact frontend update mechanism (polling vs. WebSocket vs. Tauri event) is `Status: TBD` and should be decided during Phase 5/12 implementation (see PLAN.md).

---

## 19. UI/UX Principles

Design language: **modern, professional, developer-oriented, security-focused, subtly cyberpunk.**

### Palette

```text
Background:      #080A0F
Surface:         #0D1117
Surface 2:       #11161F
Elevated:        #161C26
Border:          #252D3A

Primary Violet:  #8B5CF6
Secondary Cyan:  #22D3EE

Critical:        #F43F5E
High:            #F97316
Medium:          #EAB308
Low:             #38BDF8
Success:         #22C55E
```

### Typography

```text
Inter / Geist Sans   — UI text
JetBrains Mono        — code, findings, technical values
```

### Major UI Screens

- Dashboard
- Projects
- Add Project
- Project Overview
- Scan Configuration
- Active Scan
- Findings
- Finding Detail
- Correlation
- Dependencies
- Secrets
- Reports
- AI Analysis
- Analyzer Status
- Settings
- Command Palette

`Status: Accepted` for palette/typography — this is the established design system and should not be redefined ad hoc by any agent (see AGENTS.md §8).

---

## 20. HCI Principles

- Recognition over recall.
- Progressive disclosure — don't overwhelm the developer with every field at once.
- Immediate feedback for every user action.
- Visibility of system status (especially during long-running scans).
- Consistency across screens and components.
- Accessibility (keyboard nav, color-contrast-safe severity indicators, screen-reader-friendly structure).
- Clear, specific error messages — never a bare "Something went wrong."
- Meaningful empty states (no findings ≠ no content; explain what that means).
- Predictable workflows — similar actions behave the same way across the app.

---

## 21. Development Principles

**Prioritize:** modularity, testability, maintainability, clear interfaces, dependency inversion, separation of concerns, strong typing, secure defaults, documentation, small composable components.

**Avoid:** giant files, giant classes, hidden global state, hard-coded credentials, analyzer-specific logic leaking outside the analyzer/normalizer boundary, tight coupling between UI and analyzer internals.

---

## 22. Testing Strategy

```text
Unit Tests
Integration Tests
Security Tests
End-to-End Tests
```

Components that require tests, at minimum:

- Finding normalization (every analyzer → canonical model mapping).
- Correlation logic.
- Risk scoring.
- Path validation / traversal prevention.
- Repository import (local + GitHub).
- Secret masking.
- Analyzer execution (including failure handling).
- API request/response validation.
- Database operations (models, migrations).

---

## 23. Git Workflow

```text
main
develop
feature/*
fix/*
refactor/*
docs/*
```

- No direct development on `main`.
- All changes land via pull request.
- Commit messages must clearly communicate purpose (not "wip", "fix stuff").

---

## 24. Project Maturity Levels

```text
MVP
Prototype
Beta
Capstone Release
Future
```

Every feature tracked in `PLAN.md` should be tagged against one of these levels so scope stays visible and the capstone deadline stays realistic.

---

## 25. Decision Log

## Architecture Decisions

| Decision | Status | Reason |
|---|---|---|
| Local-first | Accepted | Privacy and core project requirement |
| Tauri | Accepted | Desktop/local-first architecture |
| FastAPI | Accepted | Python analysis ecosystem |
| PostgreSQL | Accepted | Relational scan/finding model |
| Celery + Redis | Accepted | Async analysis |
| Semgrep | Planned | Static security analysis |
| Gitleaks | Planned | Secret detection |
| OSV | Planned | Dependency vulnerabilities |
| OpenCode | Planned | AI provider integration |
| Local AI models | Proposed | Alternative to hosted AI providers |
| Exact risk-score formula | TBD | Requires research/validation before finalizing (§14) |
| Correlation algorithm/thresholds | TBD | Requires research/validation before finalizing (§13) |
| Local API auth mechanism | TBD | Needs design appropriate for local-only IPC (§17) |

New major architectural decisions must be appended here, not decided silently elsewhere.

---

## 26. Change Control

> **PROJECT.md is authoritative for project architecture and scope.**

When architecture changes:

1. Update `PROJECT.md`.
2. Update `PLAN.md` if the implementation order changes as a result.
3. Record the reason in the Decision Log (§25).
4. Update `SUGGESTIONS.md` if the change originated from an experiment or recommendation rather than a direct requirement.

Agents must not silently change major architecture — see `AGENTS.md` §7.
