# CodeSentinel --- Architecture Decisions

Only significant technical decisions belong here. Do not turn this into
a change log.

## DEC-001 --- Local-First Desktop Architecture

**Status:** Accepted

**Decision:** CodeSentinel is primarily a local desktop application.

**Reason:** Source code and scan data can be sensitive; local processing
improves privacy and reduces infrastructure requirements.

**Consequence:** Cloud services cannot be mandatory for deterministic
analysis.

## DEC-002 --- Tauri Desktop Shell

**Status:** Accepted

**Decision:** Use Tauri for the desktop application boundary.

**Reason:** Provides native desktop capabilities while allowing the
existing web UI stack.

**Consequence:** Native functionality belongs at the Tauri boundary, not
in core analysis code.

## DEC-003 --- Python Analysis Backend

**Status:** Accepted

**Decision:** Use Python for the backend and analysis engine.

**Reason:** Strong ecosystem for parsing, static analysis, security
tooling, Git integration, and AI/ML.

## DEC-004 --- FastAPI

**Status:** Accepted

**Decision:** Use FastAPI for the local application API.

**Reason:** Clear Python API contracts and strong integration with the
analysis backend.

## DEC-005 --- Celery + Redis

**Status:** Accepted

**Decision:** Long-running scans execute asynchronously through Celery
with Redis.

**Reason:** Scanning must not block API requests and can involve
multiple external/local analyzers.

## DEC-006 --- PostgreSQL

**Status:** Accepted

**Decision:** Use PostgreSQL for persistent application state.

**Reason:** Scan history, findings, relationships, and risk data benefit
from relational persistence.

## DEC-007 --- Normalized Finding Model

**Status:** Accepted

**Decision:** All analyzer output is normalized into a common finding
representation.

**Reason:** Enables correlation, unified UI/reporting, and independent
risk assessment.

## DEC-008 --- Independent Risk Engine

**Status:** Accepted

**Decision:** CodeSentinel calculates its own explainable risk score.

**Reason:** Scanner severity alone does not provide consistent
cross-analyzer prioritization.

## DEC-009 --- AI Is Optional

**Status:** Accepted

**Decision:** AI is an optional analysis provider.

**Reason:** Core security analysis must remain deterministic, local, and
functional without an LLM.

## DEC-010 --- Database Session Scoping in Celery Task Callbacks

**Status:** Accepted

**Decision:** Progress callbacks and asynchronous pipeline hooks must manage their own discrete database session lifecycle rather than capturing a session from an enclosing scope.

**Reason:** Long-running orchestration steps outlive the initial task setup session; using scoped sessions avoids operating on closed or detached SQLAlchemy sessions.

## Change Rule

When reversing a significant decision, add a new decision explaining the
replacement rather than silently rewriting history.
