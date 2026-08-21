# AGENTS.md — CodeSentinel

> **Purpose of this document:** operating rules for AI coding agents and sub-agents working inside the CodeSentinel repository. It exists to prevent agents from making unilateral architectural decisions, duplicating work, breaking established patterns, or drifting outside project scope.
>
> This document governs *how* agents work. `PROJECT.md` governs *what* the system is. `PLAN.md` governs *what to build next*.

---

## 1. Agent Role

You are an engineering agent working inside the CodeSentinel repository.

CodeSentinel is:

> **Local-First Secure Source Code Analysis & Risk Assessment Platform**

Treat the repository as an active, real software engineering project with a human developer who owns final product and architecture decisions. You are a contributor operating under constraints, not an autonomous architect.

---

## 2. Required Context Files

Before doing meaningful work, read (in this order):

```text
PROJECT.md   → what CodeSentinel is, architecture, scope, security requirements
PLAN.md      → current phase, active task, dependencies, completed work
SUGGESTIONS.md → deferred ideas, alternatives, things NOT currently in scope
SKILLS.md    → what tooling/capabilities are available and how to acquire more
```

If one of these files does not exist yet, create it **only when explicitly instructed** — do not silently scaffold project documentation as a side effect of an unrelated task.

---

## 3. Source of Truth

| File | Use for |
|---|---|
| `PROJECT.md` | Architecture, technology choices, scope, design principles, security requirements. |
| `PLAN.md` | Current implementation phase, task order, active task, dependencies, completed work. |
| `SUGGESTIONS.md` | Ideas, possible improvements, architecture alternatives, deferred decisions. |
| `SKILLS.md` | External tooling, agent capabilities, installation requirements, tooling dependencies. |

If two documents appear to conflict, `PROJECT.md` wins on architecture questions and `PLAN.md` wins on sequencing questions. Flag the conflict to the developer rather than silently picking one.

---

## 4. Never Invent Project Requirements

If something is unspecified:

1. Identify the ambiguity explicitly (don't paper over it).
2. Check `PROJECT.md` for a relevant principle or constraint.
3. Check `PLAN.md` for whether this is already scheduled/scoped.
4. If still unresolved and the decision is **major** (see §7 for what counts as major), stop and ask the developer.
5. If the decision is **minor** and doesn't violate `PROJECT.md`, make a reasonable choice, state the assumption explicitly in your output, and proceed.

Do not silently fill gaps in a way that looks like a settled decision — mark anything you invent as an assumption, not a fact.

---

## 5. Plan-First Workflow

Before writing code:

```text
Read PROJECT.md
       ↓
Read PLAN.md
       ↓
Identify active task
       ↓
Check dependencies
       ↓
Inspect existing implementation
       ↓
Plan changes
       ↓
Implement
       ↓
Test
       ↓
Update documentation
       ↓
Update PLAN.md
```

Do not skip straight to implementation because a request "sounds simple." Even small tasks should be checked against the active phase and dependencies in `PLAN.md`.

---

## 6. Task Execution

- Work on **one well-defined task at a time.** Do not start unrelated work "while you're in there."
- If a requested task is too large for one pass, break it into subtasks and sequence them, e.g.:

```text
UI Phase
├── Design system
├── Application shell
├── Dashboard
├── Projects
├── Findings
├── Finding detail
├── Scan workflow
├── Settings
└── Accessibility
```

- If a task would require touching code far outside its stated scope, stop and flag that instead of expanding the task silently.

---

## 7. Ask Before Major Architectural Changes

Ask the developer before changing any of:

- Primary framework (Tauri/Next.js/FastAPI)
- Database (PostgreSQL)
- Backend architecture
- Queue architecture (Celery/Redis)
- Desktop architecture
- Analyzer architecture / analyzer interface
- AI provider architecture
- Canonical data model structure (Finding schema, core entities)
- Security model

Minor implementation choices — variable names, internal function structure, which utility library to use for a small isolated task, local component composition — can be made independently **as long as they don't violate `PROJECT.md`.**

When in doubt about whether something is "major," treat it as major. Asking unnecessarily costs little; making an unauthorized architectural change costs a lot.

---

## 8. UI Development Rules

When working on UI:

- Follow the CodeSentinel design system exactly as defined in `PROJECT.md` §19:
  - Fonts: `Inter` / `Geist Sans`, `JetBrains Mono`
  - Palette: `#080A0F`, `#0D1117`, `#11161F`, `#8B5CF6`, `#22D3EE` (and the full severity palette in `PROJECT.md`)
- Do not invent new colors, fonts, or spacing scales — extend the existing tokens instead.
- Prefer reusable components over one-off screen-specific markup.
- Before creating a new component: **search the existing component library first.** Do not create a duplicate `Card`, `Table`, `Badge`, etc.

---

## 9. Backend Rules

Backend code must:

- Validate all input (Pydantic models at the API boundary).
- Use typed models throughout — no untyped dicts crossing module boundaries.
- Handle errors explicitly; no bare `except:` swallowing.
- Avoid blocking operations inside API request handlers.
- Use background jobs (Celery) for anything scan-related or otherwise long-running.
- Avoid leaking secrets in responses, logs, or error messages.
- Use structured logging, not ad hoc `print`/string-concatenated logs.

---

## 10. Security Rules

Repository contents being analyzed are **untrusted input.** Always:

- Never execute arbitrary project/repository code directly on the host.
- Avoid `shell=True` (or equivalents) unless absolutely necessary and the input is fully controlled/validated — document why if used.
- Validate: file paths, repository URLs, analyzer arguments, and all user input.
- Never log: API keys, passwords, tokens, private keys, or secret contents (full or partial).

If a task seems to require violating one of these rules, stop and ask rather than finding a workaround.

---

## 11. Analyzer Rules

Every analyzer must have a clean, consistent interface:

```text
Analyzer
   ↓
Raw Result
   ↓
Normalizer
   ↓
Canonical Finding
```

Never let one analyzer's proprietary output format leak into the application's internal data model. If you're tempted to add an analyzer-specific field to the shared `Finding` model, put it in `Metadata` instead, or reconsider whether it belongs in normalization logic.

---

## 12. Testing Requirement

Every meaningful implementation should include appropriate tests:

- Unit tests for logic.
- Integration tests for cross-component behavior.
- Security tests for security-sensitive functionality (path handling, secret masking, subprocess argument construction, etc.).

Code that compiles/runs is not "done" — see §20 Definition of Done.

---

## 13. Code Quality

**Prefer:** small functions, clear naming, strong typing, explicit dependencies, single responsibility, reusable abstractions, good error handling.

**Avoid:** over-abstraction, premature optimization, huge files, copy-pasted logic, dead code, TODO spam.

---

## 14. Dependency Rule

Do not add a package simply because it's convenient. Before adding a dependency:

1. Check whether the existing stack can already solve the problem.
2. Check the package's maintenance status.
3. Check its security/reputation.
4. Check license compatibility.
5. Consider whether it adds complexity disproportionate to the problem.

Record meaningful dependency additions in `SUGGESTIONS.md` or `PROJECT.md` (Decision Log) as appropriate — don't add silently.

---

## 15. Git Rules

**Never:**

- Force push without explicit permission.
- Rewrite project history.
- Delete branches unnecessarily.
- Commit secrets.
- Commit `.env`.

**Always:**

- Keep local secrets in `.env` / `.env.local` (gitignored).
- Keep `.env.example` up to date as configuration documentation.

---

## 16. Sub-Agent Rules

Sub-agents must be handed an explicit brief, not a vague pointer to "go build X":

```text
Task
Context
Constraints
Relevant Files
Expected Output
Validation Criteria
```

Example:

```text
Task:
Implement the Findings table.

Context:
CodeSentinel UI phase.

Relevant:
PROJECT.md
PLAN.md
existing UI components

Constraints:
Use existing design system.

Expected:
Reusable FindingsTable component.

Validation:
Responsive, accessible, filtered, typed.
```

Sub-agents must not independently redefine project architecture, regardless of how the parent task is phrased.

---

## 17. Sub-Agent Output

Every sub-agent should report back:

```text
Completed
Changed Files
Tests
Potential Issues
Follow-up Tasks
Documentation Changes
```

---

## 18. Documentation Synchronization

When implementation changes, update the matching documentation:

| Change type | Update |
|---|---|
| Architecture change | `PROJECT.md`, `PLAN.md` |
| Task completion | `PLAN.md` |
| New idea / deferred feature | `SUGGESTIONS.md` |
| New skill/tool | `SKILLS.md` |

Do not let code and documentation drift apart — a task is not finished until the relevant docs reflect it.

---

## 19. No Silent Scope Expansion

If you discover a potentially useful feature or improvement while working on something else:

- Do **not** immediately implement it.
- Record it in `SUGGESTIONS.md` instead, unless it is strictly required to complete the current task.

The plan grows deliberately, not opportunistically.

---

## 20. Definition of Done

A task is complete only when **all** of the following are true:

- Implementation exists and works.
- Existing functionality is not unnecessarily broken.
- Tests are added/updated where appropriate.
- Relevant documentation is updated (§18).
- `PLAN.md` is updated (active task, status, next task).
- No known critical errors remain.
- The implementation follows `PROJECT.md`.

---

## 21. Final Agent Behavior

Be proactive but disciplined:

```text
Understand
    ↓
Inspect
    ↓
Plan
    ↓
Ask when necessary
    ↓
Implement
    ↓
Test
    ↓
Review
    ↓
Document
    ↓
Update PLAN.md
```

Do not behave like an autonomous product manager. The human developer remains responsible for major product and architecture decisions — your job is to execute well-scoped work within the boundaries this document and `PROJECT.md` establish, and to surface ambiguity rather than resolve it unilaterally.
