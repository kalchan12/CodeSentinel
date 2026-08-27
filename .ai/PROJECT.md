# CodeSentinel --- Project Definition

## Identity

**Codename:** CodeSentinel\
**Academic title:** Local-First Secure Source Code Analysis & Risk
Assessment Platform\
**Type:** Computer Science / Software Engineering capstone

## Purpose

CodeSentinel is a local-first desktop security analysis platform for
developers. It analyzes local projects and GitHub repositories for
source-code vulnerabilities, exposed secrets, insecure configuration,
vulnerable dependencies, and repository hygiene issues.

Findings from multiple analysis providers are normalized, correlated,
risk-scored, stored, and presented through a desktop dashboard. Optional
AI assistance provides contextual explanations and remediation guidance.

## Core Goals

1.  Keep source code and scan data local by default.
2.  Orchestrate multiple deterministic security analyzers through one
    pipeline.
3.  Normalize heterogeneous analyzer output into a common finding model.
4.  Correlate overlapping findings.
5.  Calculate transparent, explainable risk scores.
6.  Provide actionable developer-focused remediation information.
7.  Keep AI optional and privacy-bounded.
8.  Maintain a modular architecture that can accept new
    analyzers/providers.

## Current Scope

-   Local repository scanning
-   GitHub repository acquisition
-   Deterministic security rules
-   Semgrep integration
-   Secret detection with redaction
-   AST-based checks for supported languages
-   Dependency manifest parsing and OSV lookup
-   Configuration/security hygiene checks
-   Git/repository hygiene checks
-   Finding normalization
-   Finding correlation
-   Risk scoring
-   PostgreSQL persistence
-   Asynchronous scan processing
-   Optional OpenAI-compatible/LLM review
-   Desktop/web dashboard

## Non-Goals

CodeSentinel is not:

-   a cloud SaaS security platform
-   a replacement for every commercial SAST/SCA product
-   a penetration-testing framework
-   a generic code-quality linter
-   an AI-only vulnerability scanner
-   a SOC/SIEM platform

## Principles

**Local-first:** cloud upload is never required for normal deterministic
analysis.

**AI optional:** the product remains useful with AI disabled.

**Analyzer independence:** analyzers must not own application
persistence or UI concerns.

**Explainability:** risk decisions should be understandable.

**Security by design:** repositories are untrusted input.

**Incremental engineering:** stabilize existing functionality before
expanding scope.

## Current Maturity

Functional academic prototype with an existing end-to-end vertical
slice. The codebase already contains the main analysis, worker,
persistence, and dashboard foundations, but several stability, desktop
integration, real-time, UX, and hardening tasks remain.
