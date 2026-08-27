# CodeSentinel --- Suggestions Backlog

> Suggestions are ideas, not approved work. They must not automatically
> enter `PLAN.md`.

## Statuses

`PROPOSED` · `REVIEW` · `ACCEPTED` · `REJECTED` · `IMPLEMENTED` ·
`DEFERRED`

## Format

### SUG-001 --- Example title

**Status:** PROPOSED\
**Problem:** What opportunity or problem exists?\
**Proposal:** What could be done?\
**Benefit:** Why does it improve CodeSentinel?\
**Complexity:** Low / Medium / High\
**Dependencies:** Required dependencies or prerequisites.

## Initial Suggestions

### SUG-001 --- Local OSV Advisory Cache

**Status:** PROPOSED\
**Problem:** Dependency vulnerability lookup currently depends on
network access to OSV.\
**Proposal:** Cache previously retrieved advisories locally and support
explicit updates.\
**Benefit:** Better offline behavior and reduced repeated network
requests.\
**Complexity:** Medium\
**Dependencies:** Dependency-analysis design.

### SUG-002 --- Finding Evidence Graph

**Status:** PROPOSED\
**Problem:** Correlated findings may eventually involve multiple files,
analyzers, and evidence relationships.\
**Proposal:** Represent finding relationships as an evidence graph.\
**Benefit:** Better correlation explainability and future
visualization.\
**Complexity:** Medium/High\
**Dependencies:** Mature correlation model.

### SUG-003 --- Scan Profiles

**Status:** PROPOSED\
**Problem:** Different projects may need different analyzer sets or scan
depth.\
**Proposal:** Allow reusable profiles such as Quick, Standard, and
Deep.\
**Benefit:** Better usability and control over scan cost.\
**Complexity:** Medium\
**Dependencies:** Stable analyzer lifecycle/configuration.

### SUG-004 --- Security Baselines

**Status:** PROPOSED\
**Problem:** Existing projects may contain known findings that should
not repeatedly appear as new regressions.\
**Proposal:** Add baseline comparison between scans.\
**Benefit:** Makes CodeSentinel useful for tracking newly introduced
risk.\
**Complexity:** Medium\
**Dependencies:** Stable finding identity/correlation.

### SUG-005 --- Developer-Focused Fix Workflow

**Status:** PROPOSED\
**Problem:** Finding reports identify issues but developers need a
practical path to remediation.\
**Proposal:** Add remediation workflow, status, notes, and optional
AI-assisted patch guidance.\
**Benefit:** Moves the product from detection toward secure development
workflow.\
**Complexity:** Medium\
**Dependencies:** Stable finding model and AI boundary.
