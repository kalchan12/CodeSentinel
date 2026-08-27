# CodeSentinel --- Skills and Tool Discovery

## Purpose

This file defines how agents discover and use development capabilities
without polluting the project with unnecessary dependencies.

## Rules

1.  Inspect the repository before installing anything.
2.  Prefer already-installed dependencies.
3.  Check `package.json` and Python project configuration before adding
    packages.
4.  Use the repository's existing package manager.
5.  Do not install global packages unless explicitly required.
6.  Prefer official/documented project integrations.
7.  Verify package/tool versions before using version-specific APIs.
8.  Do not add a dependency only because another model prefers it.

## Capability Areas

-   Next.js / React
-   TypeScript
-   Tailwind / shadcn/ui
-   Tauri
-   FastAPI
-   Pydantic
-   SQLAlchemy / Alembic
-   Celery / Redis
-   PostgreSQL
-   Tree-sitter
-   Semgrep
-   Gitleaks
-   OSV
-   Docker
-   Git
-   Playwright
-   Python testing/security tooling
-   OpenCode / compatible AI providers

## Missing Skill Protocol

If a required tool, package, plugin, or capability cannot be installed
or imported automatically:

1.  Explain what is missing.
2.  Give the exact package/tool name.
3.  Give the appropriate installation command for the
    repository/environment.
4.  Do not invent a replacement without checking the project
    requirements.
5.  Ask the project owner to install it manually if necessary.
6.  Continue only when the required capability is available or an
    approved alternative is chosen.

## Skill Documentation

Do not copy large external documentation into this file. Record only
project-specific usage rules and discovery instructions.
