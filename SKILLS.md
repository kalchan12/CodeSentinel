# SKILLS.md — CodeSentinel

> **Purpose of this document:** a controlled registry of external skills, packages, tools, CLI utilities, libraries, and agent capabilities relevant to building CodeSentinel. It exists to stop agents from blindly installing dependencies, silently failing when a capability is unavailable, or duplicating tooling that's already in the project.

---

## 1. Why This Exists

CodeSentinel spans a wide range of technical domains:

```text
Frontend        Backend         Database
Security        Static Analysis AI
DevOps          Testing         UI/UX
Documentation   Git             Research
```

Agents will frequently need a capability they don't have by default. This file is the first place to check — before installing anything, before assuming a tool is unavailable, and before silently working around a missing capability.

---

## 2. Skill Categories

```text
Frontend
Backend
Database
Security
Static Analysis
AI
DevOps
Testing
UI/UX
Documentation
Git
Research
```

---

## 3. Skill Registry Entry Format

Every entry in §4 follows this template:

```text
## Skill: [Name]

Category:
[Category]

Purpose:
[What it provides]

Required For:
[Which project phase, per PLAN.md]

Installation:
[Command/package]

Package Manager:
npm / pnpm / pip / uv / cargo / apt / other

Status:
Available / Missing / Installed / Manual / Planned

Verification:
[How to verify]

Fallback:
[Alternative]

Notes:
[Important details]
```

---

## 4. Skill Registry

### Frontend

## Skill: Tauri

Category:
Frontend / Desktop

Purpose:
Native desktop shell for the CodeSentinel app; provides filesystem access for local project selection with a smaller attack surface than Electron.

Required For:
PLAN.md Phase 2 — Application Shell

Installation:
`pnpm create tauri-app` / `cargo install tauri-cli`

Package Manager:
pnpm + cargo

Status:
Planned

Verification:
`cargo tauri --version`

Fallback:
Electron (heavier, larger attack surface — not preferred; would require a `PROJECT.md` architecture change if ever adopted)

Notes:
Requires a working Rust toolchain in addition to Node.

---

## Skill: Next.js

Category:
Frontend

Purpose:
React framework for the desktop app's UI, embedded in the Tauri webview.

Required For:
PLAN.md Phase 1–2

Installation:
`pnpm create next-app`

Package Manager:
pnpm

Status:
Planned

Verification:
`pnpm next --version`

Fallback:
Vite + React (simpler, less batteries-included — would be an architecture change per `AGENTS.md` §7)

Notes:
None.

---

## Skill: React

Category:
Frontend

Purpose:
Component model for the UI.

Required For:
All UI phases

Installation:
Bundled with Next.js

Package Manager:
pnpm

Status:
Planned

Verification:
`pnpm list react`

Fallback:
N/A — core to the stack

Notes:
None.

---

## Skill: Tailwind CSS

Category:
Frontend / UI-UX

Purpose:
Utility-first styling engine used to implement the CodeSentinel design system tokens.

Required For:
PLAN.md Phase 1 — Design System

Installation:
`pnpm add -D tailwindcss postcss autoprefixer`

Package Manager:
pnpm

Status:
Planned

Verification:
`pnpm exec tailwindcss --help`

Fallback:
CSS Modules (would lose the shared design-token workflow — not preferred)

Notes:
Design tokens (palette, typography) are defined in `PROJECT.md` §19 and should be encoded as Tailwind theme extensions, not hardcoded per component.

---

## Skill: shadcn/ui

Category:
Frontend / UI-UX

Purpose:
Accessible, unstyled component primitives, re-skinned to the CodeSentinel design language.

Required For:
PLAN.md Phase 1 — Design System

Installation:
`pnpm dlx shadcn@latest init`

Package Manager:
pnpm

Status:
Planned

Verification:
Check `components/ui/` exists after init

Fallback:
Radix UI primitives directly (more manual work, same accessibility base)

Notes:
Components must be restyled to match `PROJECT.md` §19 tokens — do not ship shadcn defaults unmodified.

---

### Backend

## Skill: FastAPI

Category:
Backend

Purpose:
Async, typed API framework for the local application backend.

Required For:
PLAN.md Phase 10 — Backend Foundation

Installation:
`uv add fastapi uvicorn`

Package Manager:
uv (or existing Python environment)

Status:
Planned

Verification:
`python -c "import fastapi; print(fastapi.__version__)"`

Fallback:
Flask (less native async/typing support — would be an architecture change)

Notes:
None.

---

## Skill: SQLAlchemy

Category:
Backend / Database

Purpose:
ORM for the Project/Scan/Finding relational model.

Required For:
PLAN.md Phase 10

Installation:
`uv add sqlalchemy`

Package Manager:
uv

Status:
Planned

Verification:
`python -c "import sqlalchemy; print(sqlalchemy.__version__)"`

Fallback:
Raw SQL + a lightweight query builder (loses ORM ergonomics — not preferred)

Notes:
None.

---

## Skill: Alembic

Category:
Backend / Database

Purpose:
Schema migrations as the data model evolves.

Required For:
PLAN.md Phase 10

Installation:
`uv add alembic`

Package Manager:
uv

Status:
Planned

Verification:
`alembic --version`

Fallback:
Manual migration scripts (not preferred — loses versioning safety)

Notes:
None.

---

### Database

## Skill: PostgreSQL

Category:
Database

Purpose:
System of record for projects, scans, findings, and history.

Required For:
PLAN.md Phase 10

Installation:
Run via Docker Compose (`docker/`) — do not require a host-level install.

Package Manager:
apt (inside container only) / Docker image

Status:
Planned

Verification:
`docker compose exec postgres psql --version`

Fallback:
SQLite (fine for prototyping, not for the relational finding/correlation model long-term — would need a `PROJECT.md` decision)

Notes:
Must run locally per the Local-First Principle (`PROJECT.md` §5) — never a hosted/cloud instance for the core product.

---

## Skill: Redis

Category:
Database / Backend

Purpose:
Broker/result backend for Celery job processing.

Required For:
PLAN.md Phase 12 — Scan Job System

Installation:
Run via Docker Compose

Package Manager:
Docker image

Status:
Planned

Verification:
`docker compose exec redis redis-cli ping`

Fallback:
RabbitMQ (heavier, not needed at this scale)

Notes:
None.

---

### Static Analysis / Security

## Skill: Semgrep

Category:
Static Analysis / Security

Purpose:
Rule-based SAST engine; primary source of code-pattern findings.

Required For:
PLAN.md Phase 13 — Analysis Engine

Installation:
`pip install semgrep`

Package Manager:
pip / uv

Status:
Planned

Verification:
`semgrep --version`

Fallback:
CodeQL (heavier setup, more powerful data-flow analysis — consider as a future analyzer, not a replacement)

Notes:
Run via subprocess with a strict argument allowlist — see `PROJECT.md` §15 (no `shell=True`).

---

## Skill: Gitleaks

Category:
Static Analysis / Security

Purpose:
Secret detection across files and git history.

Required For:
PLAN.md Phase 13

Installation:
Binary download or `go install github.com/gitleaks/gitleaks/v8@latest`

Package Manager:
apt / manual binary / go install

Status:
Planned

Verification:
`gitleaks version`

Fallback:
TruffleHog (alternative secret scanner — would need a `PROJECT.md` decision to swap)

Notes:
Output must be masked before it ever reaches a log, the database, or the UI — see `PROJECT.md` §15.

---

## Skill: OSV

Category:
Static Analysis / Security (Dependencies)

Purpose:
Open, vendor-neutral vulnerability database for dependency scanning.

Required For:
PLAN.md Phase 13

Installation:
`pip install osv-scanner` (or use the `osv-scanner` Go binary)

Package Manager:
pip / Go binary

Status:
Planned

Verification:
`osv-scanner --version`

Fallback:
GitHub Advisory Database API (requires network access — conflicts with offline requirement unless clearly optional per `PROJECT.md` §5)

Notes:
Dependency scanning inherently needs manifest data (lockfiles); confirm offline database mode is used where possible.

---

## Skill: Tree-sitter

Category:
Static Analysis

Purpose:
Language-agnostic AST parsing; foundation for custom static analysis beyond Semgrep's rule coverage.

Required For:
PLAN.md Phase 13

Installation:
`uv add tree-sitter tree-sitter-languages`

Package Manager:
uv

Status:
Planned

Verification:
`python -c "import tree_sitter; print(tree_sitter.__file__)"`

Fallback:
Language-specific AST libraries (e.g. Python's `ast` module) for single-language custom rules only — not a general substitute.

Notes:
None.

---

### AI

## Skill: OpenCode

Category:
AI

Purpose:
Planned initial AI provider integration for finding explanation, remediation, and false-positive triage.

Required For:
PLAN.md Phase 16 — AI Engine

Installation:
`Status: TBD` — pending OpenCode integration research

Package Manager:
TBD

Status:
Planned

Verification:
TBD

Fallback:
Direct API integration with another provider, behind the same abstraction layer (`PROJECT.md` §6) — provider independence is a hard requirement, so no fallback should be a special case in the codebase.

Notes:
Must sit behind the AI provider abstraction — nothing else in the system should import an OpenCode-specific type directly.

---

## Skill: Local Model Inference (e.g. Ollama or similar)

Category:
AI

Purpose:
Offline/local alternative to hosted AI providers, aligned with the Local-First Principle.

Required For:
PLAN.md Phase 16 (proposed extension)

Installation:
TBD

Package Manager:
TBD

Status:
Proposed

Verification:
TBD

Fallback:
Disable AI entirely — the platform must remain fully functional without it (`PROJECT.md` §6).

Notes:
Not yet committed — track any research here and in `SUGGESTIONS.md` until promoted to Planned.

---

### DevOps

## Skill: Docker / Docker Compose

Category:
DevOps

Purpose:
Reproducible local dev environment (Postgres, Redis, backend) without polluting the host machine.

Required For:
PLAN.md Phase 0 — Project Foundation

Installation:
Host-level install (Docker Desktop or Docker Engine) — outside the project's own package managers.

Package Manager:
N/A (system-level)

Status:
Planned

Verification:
`docker compose version`

Fallback:
Native local installs of Postgres/Redis (loses reproducibility — not preferred)

Notes:
None.

---

## Skill: GitHub Actions

Category:
DevOps

Purpose:
CI for lint/tests on push and PR.

Required For:
PLAN.md Phase 0 / ongoing

Installation:
Workflow files in `.github/workflows/`

Package Manager:
N/A

Status:
Planned

Verification:
Check Actions tab after first push

Fallback:
None needed — no reasonable alternative for this project's hosting (GitHub)

Notes:
None.

---

### Testing

## Skill: Pytest

Category:
Testing

Purpose:
Backend unit/integration/security test runner.

Required For:
PLAN.md Phase 19 — Testing (and ongoing per-phase tests)

Installation:
`uv add --dev pytest`

Package Manager:
uv

Status:
Planned

Verification:
`pytest --version`

Fallback:
`unittest` (stdlib, more verbose — not preferred)

Notes:
None.

---

## Skill: Playwright

Category:
Testing

Purpose:
End-to-end testing of the actual desktop UI flows.

Required For:
PLAN.md Phase 19

Installation:
`pnpm add -D @playwright/test && pnpm exec playwright install`

Package Manager:
pnpm

Status:
Planned

Verification:
`pnpm exec playwright --version`

Fallback:
Cypress (less native support for Tauri's webview context — not preferred)

Notes:
E2E tests against a Tauri app require special handling of the native window; confirm approach when Phase 19 starts.

---

## 5. Skill Discovery Workflow

When an agent needs a capability it doesn't currently have:

1. Check this file (§4) — is it already registered?
2. Check whether the project already has it installed (`pnpm list`, `uv pip list` / `pip list`, etc.).
3. Check the project's existing package manager before reaching for a new one.
4. Prefer official/first-party packages over third-party wrappers.
5. Verify compatibility with the existing stack.
6. Install only if appropriate — see §8 if it can't be installed automatically.

**Preferred package managers:**

```text
Frontend:  pnpm
Python:    uv (or the project's existing virtual environment)
Rust:      cargo
System:    apt — only when strictly necessary
```

---

## 6. NPM / Package Skills

Before installing a new frontend dependency, check whether the project already covers the need:

```text
pnpm list
```

Do not install a second library that duplicates functionality already provided by an existing dependency (e.g. two date libraries, two icon sets).

---

## 7. Python Skills

Before installing a new Python dependency:

```text
Check pyproject.toml
Check the existing virtual environment
Check uv configuration
```

Do not install Python packages globally on the host — everything should go through the project's declared environment.

---

## 8. Tool Unavailable Protocol

**This is critical.** If a required skill cannot be installed/imported automatically:

**Do not pretend it succeeded.** Report exactly this shape:

```text
Skill unavailable.

Required:
[Skill]

Reason:
[Why installation/import failed]

Manual installation required:
[Exact command or package]

Please install it manually and tell me when it is available.
```

Then **pause** the affected work if the skill is essential to the current task. Do not fake output, stub around it silently, or mark the task done.

---

## 9. Manual Installation Format

When a tool needs manual developer installation, provide exactly:

```text
Tool
Purpose
Exact installation command
Verification command
Expected result
```

Example:

```text
Tool:
Semgrep

Install:
pip install semgrep

Verify:
semgrep --version
```

---

## 10. Security Rules for New Dependencies

Before adding any dependency, check:

- Official source (not a typosquatted/unofficial fork).
- Maintenance status (recent commits/releases).
- Security reputation (known CVEs, advisories).
- License compatibility with the project.
- Package provenance (who publishes it).
- What permissions/access it requires.
- Whether it executes external code (postinstall scripts, etc.) — treat with extra scrutiny.

Avoid suspicious or poorly-maintained packages even if they'd save time short-term.

---

## 11. Skill Update Rule

Update this file whenever a skill is:

- Installed
- Removed
- Replaced
- Newly discovered as needed
- Blocked (and why)

Keep entries' `Status` field accurate — this file should reflect reality, not aspiration.

---

## 12. Skill Request Format

If an agent determines it needs a new skill not yet in the registry, report it in this format before acting:

```text
Skill Request

Name:
Purpose:
Why needed:
Preferred source:
Installation:
Security considerations:
Alternative:
Blocking:
Yes / No
```

---

## 13. Final Principle

SKILLS.md is a **capability registry**, not a random dependency list. Use it to answer:

- What capabilities are already available?
- What capabilities are missing?
- How can a missing capability be safely acquired?
- What should happen if it can't be acquired automatically?
