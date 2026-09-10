# Problem Analysis Document (PAD)
## CodeSentinel: Local-First Secure Source Code Analysis & Risk Assessment Platform

**Academic Program:** Computer Science & Engineering (CSE) / Software Engineering (SE)  
**Capstone Deliverable:** Deliverable I — Problem Analysis Document (Software Requirements Specification)  
**Version:** 1.0.0  
**Date:** September 2026  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Justification](#2-problem-statement--justification)
   - 2.1 Background & Context
   - 2.2 Problem Definition
   - 2.3 Significance & Expected Impact
3. [Project Objectives (SMART)](#3-project-objectives-smart)
4. [Methodology & Technical Approach](#4-methodology--technical-approach)
   - 4.1 System Architecture Overview
   - 4.2 Data Flow & Normalization Pipeline
   - 4.3 Component & Interface Breakdown
5. [Concept Synthesis Plan (Section 4 Mapping)](#5-concept-synthesis-plan-section-4-mapping)
   - 5.1 Security & Threat Mitigation
   - 5.2 Software Architecture (DDD & Layered Patterns)
   - 5.3 Operating Systems & Concurrency (PTY & Async Subprocesses)
   - 5.4 Artificial Intelligence & Local LLM Orchestration
   - 5.5 Data Structures, Normalization & Scoring Algorithms
   - 5.6 Software Quality Assurance, TDD & Automated Verification
   - 5.7 Professionalism, Ethics & Data Privacy (EIA)
6. [Team Roles, Work Distribution & Timeline](#6-team-roles-work-distribution--timeline)
   - 6.1 Formal Engineering Roles
   - 6.2 Work Breakdown Structure (WBS)
   - 6.3 Milestones & Deliverables Schedule
7. [Technical Risk Analysis & Mitigation](#7-technical-risk-analysis--mitigation)
8. [System Requirements & Verification Matrix](#8-system-requirements--verification-matrix)

---

## 1. Executive Summary

Modern software development relies heavily on third-party libraries, complex microservices, and continuous integration pipelines. However, software security assessments frequently suffer from severe friction: existing commercial Static Application Security Testing (SAST) solutions mandate transmitting proprietary, uncompiled source code to third-party cloud infrastructure. This model introduces intellectual property exposure, compliance violations (e.g., GDPR, CCPA, HIPAA), and unpredictable subscription overhead. Furthermore, disparate analysis tools generate fragmented, unranked reports that overwhelm software engineering teams with false positives.

**CodeSentinel** is a **local-first, secure source code analysis and explainable risk assessment platform**. Designed to run entirely on developer workstations, CodeSentinel guarantees that proprietary code never leaves local hardware. The system unifies multi-engine static analysis (AST parsing via Tree-sitter, security linting via Semgrep, and entropy/pattern credential scanning via Gitleaks), normalizes disparate outputs into a strictly typed canonical schema, and executes an explainable multi-factor risk engine (`codesentinel-risk-v1`).

To close the loop between vulnerability identification and remediation, CodeSentinel embeds a real-time asynchronous pseudo-terminal (PTY) and orchestrates local-weight Artificial Intelligence Coding Agents (**OpenCode** and **Google Antigravity CLI**). Developers can conduct automated, context-bounded security audits or launch interactive 1-click remediation sessions directly within the desktop environment. CodeSentinel demonstrates deep curriculum synthesis across software architecture, systems programming, cybersecurity, algorithms, and artificial intelligence.

---

## 2. Problem Statement & Justification

### 2.1 Background & Context
Software vulnerabilities continue to increase exponentially in both enterprise and open-source ecosystems. Software teams rely on static analysis to detect common weaknesses (CWEs), architectural anti-patterns, and accidentally committed API tokens or private keys prior to deployment. 

### 2.2 Problem Definition
Current vulnerability management tools exhibit three critical flaws:
1. **Cloud Exfiltration Risk:** Enterprise security tools often require codebases to be zipped and uploaded to remote servers for processing. For security-critical organizations, defense contractors, and private developers, external code transmission is fundamentally unacceptable.
2. **Incoherent Tool Silos & Alert Fatigue:** Running standalone tools produces conflicting, non-standardized outputs. Developers receive thousands of raw alerts lacking unified risk scoring, deduplication, or contextual severity weighting.
3. **The Remediation Chasm:** Identifying a security flaw is only half the battle. Developers must manually look up remediation syntax, locate affected lines, and context-switch across terminals, IDEs, and browser dashboards to apply fixes.

### 2.3 Significance & Expected Impact
CodeSentinel addresses these problems by providing:
- **Absolute Privacy (Local-First):** Zero source code or telemetry leaves the host machine.
- **Explainable Prioritization:** Rather than presenting an unordered list of warnings, CodeSentinel applies an algorithmic scoring model that weighs severity, scanner confidence, and codebase context into a deterministic 0–100 risk index.
- **Integrated Terminal & Local AI Remediation:** Developers can invoke offline, locally running AI agents inside an embedded interactive terminal to generate patches directly against identified lines of code.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          THE CODESENTINEL PROMISE                      │
│                                                                        │
│   Untrusted Local Code ──► Isolated Local Engines ──► Canonical Model   │
│                                                            │           │
│   Interactive Fixes   ◄── Embedded PTY Terminal ◄── Risk Prioritization │
│   (Local AI Agents)                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Objectives (SMART)

The project targets specific, measurable, achievable, relevant, and time-bound goals:

1. **Specific:** Develop a cross-platform desktop application (Tauri v2 + Next.js + FastAPI) that automates multi-engine static code scanning, secret detection, dependency inspection, and interactive AI remediation.
2. **Measurable:**
   - Achieve **100% local processing** with zero external network transmission of source files.
   - Attain **≥85% automated test coverage** across the core engine, PTY services, and API boundaries (currently 88 automated unit/security tests).
   - Ingest, normalize, deduplicate, and score findings across multiple engines within **<30 seconds** for medium codebases (≤100,000 LOC).
3. **Achievable:** Implement standard POSIX system calls (`openpty`, `termios`, `fcntl`), established open-source static analyzers (Tree-sitter, Semgrep, Gitleaks), and local AI CLIs (OpenCode, Antigravity) without proprietary hardware dependencies.
4. **Relevant:** Directly solves critical supply chain and application security risks highlighted by OWASP Top 10 and NIST SP 800-218 (Secure Software Development Framework).
5. **Time-Bound:** Executed and refined across 20 development phases throughout the 16-week capstone lifecycle.

---

## 4. Methodology & Technical Approach

### 4.1 System Architecture Overview
CodeSentinel adopts a decoupled, multi-tier architecture built on local IPC, asynchronous event loops, and type-safe data contracts:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Desktop Client)                 │
│                                                                         │
│  Tauri v2 Native Host  •  Next.js 16 (App Router)  •  React 19 Tailwind │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Security Command Center │  │ Embedded Terminal Drawer (@xterm)    │  │
│  │ • Findings Explorer     │  │ • Bi-directional PTY streaming      │  │
│  │ • Multi-Engine Radar    │  │ • OpenCode & Antigravity CLI Tabs    │  │
│  └─────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ HTTP REST & WebSockets (/api/terminal/ws)
┌────────────────────────────────────▼────────────────────────────────────┐
│                    API GATEWAY & ASYNC BACKEND (FastAPI)                │
│                                                                         │
│  • PTY Session Manager (pty.openpty, os.fork, termios)                  │
│  • Local AI CLI Orchestrator (Subprocess streaming, JSON parser)       │
│  • SQLite Persistence via SQLAlchemy ORM & Alembic Migrations          │
│  • Async Job Management (BackgroundTasks, zero-cloud architecture)      │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ In-Memory Pipeline (AnalysisContext)
┌────────────────────────────────────▼────────────────────────────────────┐
│                       ANALYSIS ENGINE CORE (engine/)                    │
│                                                                         │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │ Analyzer Registry     │  │ Normalization      │  │ Risk Engine    │  │
│  │ • Tree-sitter (AST)   │  │ Pipeline           │  │ • Mathematical │  │
│  │ • Semgrep (SAST)      │  │ • Deduplication    │  │   scoring      │  │
│  │ • Gitleaks (Secrets)  │  │ • Severity Ranking │  │ • Explainable  │  │
│  │ • Dependency & Git    │  │ • Path Resolution  │  │   rationale    │  │
│  └───────────────────────┘  └────────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow & Normalization Pipeline
To prevent analyzer-specific data structures from polluting the application domain, CodeSentinel enforces a strict **Abstract Base Class (`Analyzer`)** and **Normalizer** pattern:

```
[Target Codebase] ──► [ProjectSourceResolver] (Path sanitization & jail checks)
                              │
                              ▼
                      [AnalysisContext]
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  [Tree-sitter AST]    [Semgrep SAST]        [Gitleaks Secrets]
  (Syntactic Sinks)   (Rule-based checks)    (Entropy / RegEx)
       │                      │                      │
       ▼                      ▼                      ▼
  Raw AST Nodes          Raw JSON               Raw Leaks
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              ▼
                  [Canonical Normalizers]
                              │
                              ▼
                    [Finding Model (15 fields)]
                              │
                              ▼
                 [Deduplication & Correlation]
                              │
                              ▼
            [Risk Engine: codesentinel-risk-v1]
                              │
                              ▼
       [SQLite Storage] ◄─────┴─────► [WebSocket / Terminal Trigger]
```

### 4.3 Component & Interface Breakdown
- **Frontend GUI (`apps/desktop`):** Built using Next.js 16 and Tauri v2. Features a cyberpunk-inspired dark theme (`#080A0F`, `#8B5CF6`, `#22D3EE`), high-density Bento grid layouts, real-time scan radars, and an embedded terminal emulator powered by `@xterm/xterm`.
- **Backend Service (`apps/backend`):** FastAPI application providing REST endpoints (`/api/projects`, `/api/scans`, `/api/findings`, `/api/ai/status`) and real-time WebSocket communication (`/api/terminal/ws`).
- **Core Engine (`engine/`):** Pure Python domain engine independent of web frameworks. Contains analyzer implementations, AST tree traversal, and scoring algorithms.

---

## 5. Concept Synthesis Plan (Section 4 Mapping)

The Capstone Guide mandates the integration and technical defense of concepts from **at least three (3)** computing domains. CodeSentinel incorporates and defends **six (6)** domains:

```
┌─────────────────────────────────────────────────────────────────────────┐
│             CODESENTINEL CURRICULUM SYNTHESIS MATRIX (6 DOMAINS)        │
├──────────────────────────┬──────────────────────────────────────────────┤
│ 1. Security              │ OWASP Top 10, Untrusted Input Jail, Sanitizer│
│ 2. Software Architecture │ Layered Architecture, DDD, API Gateway       │
│ 3. OS & Concurrency      │ POSIX PTYs, os.fork, termios, Asyncio WS     │
│ 4. AI & Machine Learning │ Local LLM Orchestration, Bounded Prompting   │
│ 5. Data & Algorithms     │ AST Tree Traversal, Normalization, O(n) Risk │
│ 6. Quality & Testing     │ TDD, 88 Automated Tests, Security Abuse E2E  │
└──────────────────────────┴──────────────────────────────────────────────┘
```

### 5.1 Security & Threat Mitigation
- **Untrusted Input Handling:** Source repositories under analysis are treated as hostile, untrusted inputs. Path sanitization (`ProjectSourceResolver`) prevents directory traversal attacks (`../../etc/passwd`) and rejects symlinks targeting external host paths.
- **Zero Subprocess Injection:** All external CLI invocations (Semgrep, Gitleaks, AI tools) use explicit vector argument lists (`subprocess.run(["cmd", "arg1"])`). The dangerous shell evaluation mode (`shell=True`) is strictly prohibited.
- **Secret Redaction:** High-entropy credentials and passwords identified by scanners are masked in memory before being committed to SQLite or transmitted to the UI.
- **OWASP Alignment:** Automated checks detect vulnerabilities across SQL Injection (CWE-89), Command Injection (CWE-78), Broken Access Control, and Insecure Deserialization.

### 5.2 Software Architecture (DDD & Layered Patterns)
- **Domain-Driven Design (DDD):** The core security domain (`Finding`, `RiskAssessment`, `AnalysisContext`) is encapsulated inside `engine/` with zero database or framework dependencies.
- **Plugin Architecture:** All static analyzers inherit from the `Analyzer` abstract base class, exposing deterministic `is_available()`, `analyze()`, and `normalize()` interfaces.
- **Decoupled Three-Tier Gateway:** Separation between native desktop UI (Tauri), API orchestration (FastAPI), and domain compute engines guarantees maintainability and independent scalability.

### 5.3 Operating Systems & Concurrency (PTY & Async Subprocesses)
- **Asynchronous Pseudo-Terminal (PTY) Management:** Implemented in `apps/backend/app/services/pty_service.py` using low-level POSIX system calls:
  - `pty.openpty()`: Allocates paired master and slave file descriptors.
  - `os.fork()`: Spawns the child process, attaches the slave terminal via `termios.TIOCSCTTY`, and redirects stdio (`dup2` on fd 0, 1, 2).
  - `fcntl.ioctl()`: Dynamically captures window resize events (`TIOCSWINSZ`) transmitted over WebSockets from `@xterm/xterm`.
  - Non-blocking I/O multiplexing: Integrated with the Python `asyncio` event loop using `loop.add_reader(master_fd, ...)` to stream raw ANSI terminal bytes without blocking API worker threads.

### 5.4 Artificial Intelligence & Local LLM Orchestration
- **Local-Only Inference:** CodeSentinel integrates with local AI CLIs (**OpenCode** and **Google Antigravity CLI / `agy`**), utilizing models running directly on local machines.
- **Context-Bounded Extraction:** Rather than transmitting an entire repository, CodeSentinel extracts targeted, localized code snippets surrounding flagged vulnerabilities (<48 KB token budget ceiling).
- **Structured JSON Synthesis:** AI prompts enforce strict schema outputs, allowing the backend to parse remediation steps, root cause summaries, and diffs directly into structured `Finding` objects.
- **1-Click Interactive Remediation:** Contextual UI triggers in `/finding` launch targeted interactive CLI sessions pre-loaded with vulnerability context (`file:line_start`).

### 5.5 Data Structures, Normalization & Scoring Algorithms
- **Concrete Syntax Trees (AST):** Tree-sitter parses raw source code into ASTs across multiple programming languages (Python, JavaScript, TypeScript, Go), evaluating syntax nodes to flag dangerous sinks (`eval`, `exec`, `yaml.load`).
- **Relational Schema Normalization:** Persistent SQLite database modeled with 3rd Normal Form (3NF) relational tables (`projects`, `scans`, `findings`, `ai_analyses`).
- **Deterministic Multi-Factor Scoring (`codesentinel-risk-v1`):** Computes risk scores normalized to a 0–100 scale using the formula:
  $$\text{BaseScore} = \text{SeverityWeight} \times 100$$
  $$\text{AdjustedScore} = \text{BaseScore} \times (0.7 + 0.3 \times \text{Confidence})$$
  The algorithm enforces monotonic severity ranking (Critical > High > Medium > Low) and produces an explainable, human-readable rationale string for every finding.

### 5.6 Software Quality Assurance, TDD & Automated Verification
- **Automated Test Suite:** Includes **21 test files** comprising **88 passed unit and security tests**:
  - `tests/unit/`: Validates risk scoring monotonicity, tree-sitter AST queries, Gitleaks parsers, deduplication algorithms, and PTY master/slave allocations.
  - `tests/integration/`: Validates end-to-end REST endpoints, project CRUD, and scan lifecycle events.
  - `tests/security/test_input_abuse.py`: Verifies resilience against command injection, URL manipulation, and directory traversal.
  - `apps/desktop/e2e/`: Playwright smoke test verifying desktop routing and client hydration.

### 5.7 Professionalism, Ethics & Data Privacy (EIA)
- **Ethical Impact Analysis (EIA):** Addressed by keeping proprietary source code strictly local. CodeSentinel eliminates the risk of inadvertent code leaks or non-consensual code ingestion into commercial training models.
- **Open-Source Attribution:** All third-party analyzers, parsers, and libraries are cataloged, verified for permissive licensing, and explicitly credited.

---

## 6. Team Roles, Work Distribution & Timeline

### 6.1 Formal Engineering Roles
To simulate a professional software engineering organization, responsibilities are formally distributed:

| Mandatory Role | Primary Responsibilities |
|---|---|
| **Project Manager / Scrum Master** | Sprint planning, backlog refinement, milestone tracking, and process adherence. |
| **Lead Architect / Senior Developer** | High-level system architecture, engine pipeline design, PTY implementation, and technology selection. |
| **Quality Assurance (QA) Lead** | Test strategy formulation, security abuse testing, coverage verification, and E2E validation. |
| **Documentation Specialist** | Software Requirements Specification (PAD), architecture documentation, user manuals, and presentation scripts. |

### 6.2 Work Breakdown Structure (WBS)
- **WP 1: Foundation & Core Engine:** Source resolving, base analyzer contracts, and AST integration.
- **WP 2: Backend Architecture & PTY:** FastAPI REST services, WebSocket streaming, SQLite persistence, and PTY fork management.
- **WP 3: Desktop UI & Terminal Emulator:** Next.js client, Tailwind design system, `@xterm/xterm` terminal drawer, and findings dashboard.
- **WP 4: Local AI Integration:** CLI subprocess orchestration, prompt budgeting, and automated patch parsing.
- **WP 5: Quality Assurance & Security Hardening:** Unit tests, integration tests, fuzz/abuse testing, and performance validation.

### 6.3 Milestones & Deliverables Schedule

```
Weeks:   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
         ├───┴───┴───┼───┴───┴───┴───┼───┴───┴───┴───┼───┴───┴───┴───┤
Phase:   Foundation  │ Core Engine   │ UI & Terminal │ Integration   │ Final Polish
                     ▲               ▲                               ▲
Deliverable:        PAD            Mid-Review                       Final Code & Demo
```

- **Week 2:** Team formation, repository scaffolding, and project mandate approval.
- **Week 4 (Deliverable I):** Submission of Problem Analysis Document (PAD).
- **Week 8:** Mid-Project Review: functional core analysis engine and basic UI.
- **Week 12:** Completion of embedded terminal, local AI CLI integration, and full test matrix.
- **Week 14 (Deliverables II & III):** Codebase freeze, public GitHub submission, and final demonstration video delivery.

---

## 7. Technical Risk Analysis & Mitigation

| # | Identified Risk | Severity | Likelihood | Mitigation Strategy |
|---|---|---|---|---|
| **R1** | **Host Compromise via Malicious Codebase** | High | Low | Treat all analyzed repositories as untrusted. Strictly prohibit `shell=True`. Enforce strict path resolution, sandboxed file reading, and input jail validation. |
| **R2** | **External Analyzer Binary Missing on Host** | Medium | Medium | Implement dynamic discovery in `Analyzer.is_available()`. Gracefully disable missing analyzers while keeping operational ones active; alert the user via the UI. |
| **R3** | **Excessive Scan Duration on Large Codebases** | Medium | Medium | Implement parallel analyzer execution, file size caps, vendor directory exclusion (`node_modules/`, `.git/`), and stream real-time scan progress to the UI. |
| **R4** | **Unbounded Token Consumption in AI Calls** | Medium | Low | Enforce strict context budgeting (<48 KB). Extract only targeted vulnerability line ranges rather than full repositories. |
| **R5** | **PTY Zombie Processes & Resource Leaks** | High | Low | Track child PIDs explicitly in `PTYSession`. Bind process teardown to WebSocket disconnection lifecycles using POSIX `SIGTERM`/`SIGKILL` signals. |

---

## 8. System Requirements & Verification Matrix

### 8.1 Functional Requirements (FR)
- **FR-01:** System must ingest local project folders and validate path boundaries.
- **FR-02:** System must execute multiple static analyzers (Tree-sitter, Semgrep, Gitleaks) concurrently.
- **FR-03:** System must normalize raw findings into a canonical 15-field data model.
- **FR-04:** System must compute a deterministic, explainable risk score (0–100) for each finding.
- **FR-05:** System must provide an embedded interactive terminal supporting standard shell commands and AI CLIs.
- **FR-06:** System must support automated, headless AI scans using local OpenCode or Antigravity CLIs.

### 8.2 Non-Functional Requirements (NFR)
- **NFR-01 (Security):** Zero proprietary source code files transmitted outside localhost.
- **NFR-02 (Performance):** Scan initialization overhead <2 seconds; PTY keystroke latency <20ms.
- **NFR-03 (Reliability):** Automated unit and security test suite pass rate of 100%.
- **NFR-04 (Usability):** Dark-mode cyberpunk design system adhering to WCAG 2.1 AA accessibility standards.

### 8.3 Verification Matrix
All functional and non-functional requirements are validated through our automated test suite (`tests/unit/`, `tests/integration/`, `tests/security/`) and interactive end-to-end verification.

---

*End of Problem Analysis Document — CodeSentinel Capstone Project.*
