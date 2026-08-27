# CodeSentinel --- UI/UX Design System

## Design Direction

**Modern developer security tooling with subtle cyberpunk character.**

Priority order:

1.  Usability
2.  Clarity
3.  Accessibility
4.  Professional/security-tool credibility
5.  Cyberpunk visual character

Avoid gaming UI, excessive neon, excessive glow, decorative clutter, and
low-contrast text.

Reference feel: modern IDE + GitHub Security + professional security
tooling.

## Color Tokens

Use semantic tokens, not scattered hardcoded colors.

### Base

-   Background: `#090A0F`
-   Surface: `#0D1117`
-   Elevated surface: `#151A22`
-   Border: `#252B36`

### Brand

-   Primary violet: `#8B5CF6`
-   Secondary cyan: `#22D3EE`

### Text

-   Primary: `#F4F4F5`
-   Secondary: `#A1A1AA`
-   Muted: `#71717A`

### Status

-   Success: green semantic token
-   Warning: yellow/amber semantic token
-   Danger: red semantic token
-   Info: cyan/blue semantic token

Severity must always be distinguishable by more than color alone.

## Typography

Use a clean modern sans-serif UI font.

Hierarchy: - Display: strong but restrained - Page title: 24--32px -
Section title: 18--22px - Body: 14--16px - Metadata: 12--13px - Code:
monospace font

## Layout

-   Use a stable application shell.
-   Sidebar navigation remains predictable.
-   Content uses consistent max widths and spacing.
-   Prefer 8px-based spacing increments.
-   Use moderate corner radii.
-   Use elevation through subtle surface contrast rather than heavy
    shadows.

## Interaction Principles

-   Clear primary action per screen.
-   Progressive disclosure for complex security data.
-   Preserve user context when opening finding details.
-   Use confirmation only for destructive/irreversible actions.
-   Provide clear loading, empty, success, and error states.
-   Never make security status depend only on color.
-   Keyboard focus must always be visible.
-   Avoid unnecessary animation; respect reduced-motion preferences.

## Core Components

-   Button
-   Input
-   Select
-   Dialog
-   Dropdown
-   Tabs
-   Tooltip
-   Toast
-   Card
-   Badge
-   Table
-   Skeleton
-   Progress
-   Code viewer
-   Finding card
-   Risk score
-   Severity badge
-   Scan status
-   Analyzer status

## Primary Screens

Dashboard → Projects → Project Detail → New Scan → Scan Progress →
Findings → Finding Detail → Dependencies → Secrets → Reports → AI
Analysis → Settings

## Finding UI

Show: - title - severity - risk score - confidence - file/line -
evidence - code context - impact - explanation - remediation -
contributing analyzers

## Responsive Behavior

The desktop layout is primary. Smaller windows must preserve: -
navigation access - readable content - usable tables - accessible
controls

Prefer responsive tables, detail drawers/pages, and progressive
disclosure over horizontal UI overflow.

## Accessibility

-   Semantic HTML.
-   Keyboard navigation.
-   Visible focus.
-   WCAG-conscious contrast.
-   Accessible labels.
-   Screen-reader-friendly status changes.
-   Reduced-motion support.

## Consistency Rule

New UI must reuse existing design tokens/components before introducing
alternatives. Any deliberate change to the design system must update
this file.
