# CodeSentinel --- Architecture

## System

``` text
Tauri Desktop
    ↓
Next.js / React UI
    ↓
FastAPI
    ↓
Redis → Celery Worker
    ↓
Analysis Engine
    ↓
Normalize → Correlate → Risk Score
    ↓
PostgreSQL
```

External services are optional or bounded: - GitHub for repository
retrieval - OSV for vulnerability advisories - Optional AI/LLM provider
through the AI abstraction

## Stack

### Desktop/UI

-   Tauri
-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui

### Backend

-   Python
-   FastAPI
-   Pydantic
-   SQLAlchemy
-   Alembic
-   PostgreSQL

### Jobs

-   Celery
-   Redis

### Analysis

-   Python/custom rules
-   Semgrep
-   Gitleaks/secret detection
-   Tree-sitter
-   Dependency analysis
-   OSV
-   Git tooling
-   Optional LLM/OpenCode-compatible integration

### Infrastructure

-   Docker / Docker Compose
-   GitHub Actions where configured

## Layer Responsibilities

### Desktop

Owns native desktop capabilities and application packaging. It must not
contain core security-analysis logic.

### Frontend

Owns presentation, user interaction, client state, and API/event
consumption. It should not implement authoritative risk calculations.

### API

Owns application-facing HTTP contracts, validation, scan creation,
persistence coordination, and event delivery.

### Worker

Owns asynchronous scan execution. Long-running analysis must not block
API requests.

### Analysis Engine

Owns repository discovery and security analyzers. It produces normalized
analysis data without coupling analyzers to the UI.

### Correlation

Combines evidence representing the same underlying issue.

### Risk Engine

Calculates CodeSentinel's explainable risk assessment independently from
individual scanner severity.

### Database

Persists projects, scans, findings, risk results, and related history.

## Analyzer Model

New analyzers should be modular and conform to the project's analyzer
contract. They should: - declare capabilities/metadata - receive
controlled analysis input - produce findings/results - handle failures
explicitly - remain independent from frontend/database concerns

## Scan Lifecycle

``` text
Created
  ↓
Queued
  ↓
Discovery
  ↓
Analysis
  ↓
Normalization
  ↓
Correlation
  ↓
Risk Assessment
  ↓
Persistence
  ↓
Completed
```

Failures must transition to an explicit failed state with useful
diagnostics.

## Architectural Invariants

1.  AI is optional.
2.  Analyzers remain modular.
3.  Risk scoring is not delegated to a scanner.
4.  Long-running scans remain asynchronous.
5.  Untrusted repository content must not be executed directly on the
    host.
6.  Sensitive source content must not be unnecessarily logged or
    transmitted.
7.  UI code must not become the source of truth for security
    calculations.
8.  New dependencies require justification.
9.  Technology-stack changes require an explicit decision.
10. Architecture changes require this file to be updated.

## Known Current Limitations

-   Tauri native integrations are incomplete.
-   Frontend currently relies on polling where real-time events are not
    yet connected.
-   Authentication is not implemented for the single-user local
    deployment model.
-   AI context extraction needs to become finding-focused.
