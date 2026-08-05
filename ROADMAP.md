# Universal
> An AI Art Director for React applications.

## Implementation status (2026-07-31)

Phases 1-3 and the Phase 3 follow-ups are implemented: discovery and approval,
differentiated concepts, Design Plan v2, deterministic provider-neutral React generation,
proportional architecture review, immutable runtime workspaces, locked offline builds, isolated
loopback previews, connected Studio/Preview lifecycle states, desktop and mobile rendered QA, one
bounded child-revision loop, explicit acceptance/export, provenance-aware asset processing,
permanent benchmark reporting, and last-known-good recovery. CI is active, and `main` requires
strict, up-to-date `Quality gate` and `Trusted runtime and security` checks. See
[Phase 3 local runtime](docs/PHASE3_RUNTIME.md) and
[Phase 3 follow-up closeout](docs/PHASE3_FOLLOW_UPS.md).

### Phase 4 - release hardening

Phase 4 strengthened the local-first runtime without broadening the product into hosted deployment,
arbitrary packages, or a general-purpose execution sandbox. All five workstreams are shipped:

- Permanent v2 benchmark corpus, report schema, baseline comparison, and weighted regression
  reporting.
- Process-supervision hardening for spawn failures, cancellation/timeout races, and complete
  process-tree cleanup, including group termination after the leader has already exited.
- Safe retention of stale immutable revisions, protecting each project's latest successful build and
  any active operation.
- A Windows, macOS, and Linux validation matrix covering runtime lifecycle, workspace safety, and
  locked builds, with canonicalized export destinations so containment checks hold when the
  workspace root is reached through a symlink. See
  [Release readiness](docs/RELEASE_READINESS.md) for the matrix, the per-operating-system
  reproduction sequence, and the limits of what a green run proves.

- A scoped packaging/distribution decision: the MCP server publishes to npm (see
  [MCP release](docs/MCP_RELEASE.md)); Studio, Preview, and the local runtime ship as a source
  checkout run via `pnpm dev`, with desktop packaging deliberately deferred. See
  [ADR-0004](docs/adr/0004-packaging-and-distribution.md).

Future milestones below describe direction, not shipped hosted, deployment, arbitrary-package, or production-provider capabilities.

---
### Phase 5 � MCP-guided design quality loop

Phase 5 will make Universal useful after initial generation as well as before it. It will provide a
structured, evidence-led workflow for finding and repairing generic or low-quality AI UI without
turning subjective visual taste into an unsupported automated guarantee.

- Add MCP analysis endpoints that return actionable findings: rule/category, severity, affected
  files or selectors, rationale, and a scoped repair recommendation.
- Support an agent-facing skill surface for `/audit`, `/polish`, `/cleanup`, `/art-direct`, and
  `/review-ui`. Skills orchestrate file gathering, evidence capture, MCP analysis, implementation,
  and verification; the MCP remains the reusable source of design intelligence.
- Make visual references first-class in that skill workflow: a workspace agent can inspect images
  attached to a Codex/Cursor-style conversation, derive a structured visual brief (palette,
  typography, composition, material cues, interaction tone, and avoidances), and pass those
  inspectable constraints to Universal alongside source and screenshot evidence. A future MCP
  `referenceAssets` contract can make this native without blocking the useful agent-led version.
- Evolve `review_implementation` into a before/after quality loop: inspect desktop and mobile
  evidence, identify hierarchy, composition, component-vocabulary, accessibility, and generic
  pattern issues, then re-review the targeted repair.
- Keep repairs bounded and traceable: preserve requested functionality, explain the reason for each
  change, and distinguish deterministic checks from recommendations requiring human judgment.

This phase intentionally does not depend on the currently open Phase 5 pull request; that work can
be closed and disregarded.

---

# Vision

Developers can already generate functional websites.

The problem is that almost every AI-generated website looks the same.

Purple gradients.

Cards inside cards.

Generic hero.

Three-column feature grid.

Another CTA.

Universal exists to fix that.

Instead of generating another website, it generates an art-directed experience.

The goal is to make AI-generated websites feel intentionally designed.

---

# Core Philosophy

Design before code.

Composition before components.

Taste before implementation.

The Design Engine should think like a creative director, not a frontend engineer.

---

# MVP

A local desktop/web application.

Input:

- Design prompt
- Style controls
- Images (optional)

Output:

- React/Vite project
- Live preview
- Three design directions

No backend.

No authentication.

No deployment.

No functionality generation.

Static UI only.

---

# Architecture

User Prompt

↓

Design Director

↓

Design Specification

↓

Composition Engine

↓

React Generator

↓

Design Linter

↓

Preview Renderer

↓

Revision Loop

---

# Milestone 1

Project setup

Goal:

Establish a clean monorepo.

Tasks

- setup pnpm workspace
- setup TurboRepo
- React + Vite studio
- shared packages
- linting
- prettier
- typescript

Deliverable

Running studio.

---

# Milestone 2

Design Specification Engine

Goal

Convert natural language into structured design specifications.

Example

Prompt

"Luxury mechanical keyboard company."

↓

JSON

Brand

Mood

Typography

Spacing

Motion

Avoid

Composition

---

# Milestone 3

Composition Library

Goal

Create reusable page structures.

Examples

- Editorial
- Minimal
- Product
- Portfolio
- Storytelling
- Magazine
- Interactive
- Experimental

Implemented as validated composition contracts, signatures, catalogs, diversity checks, and selection primitives.

---

# Milestone 4

React Generator

Goal

Generate React code from specification.

Phase 3 status

Implemented with provider-neutral contracts, a deterministic provider, a fixed React/Vite/TypeScript template, strict manifest validation, and successful locked production builds. Tailwind is not part of the fixed Phase 3 dependency set.

---

# Milestone 5

Live Preview

Phase 3 status

Implemented as immutable rebuild-and-reload: the runtime serves ready production output on a distinct loopback origin, Preview embeds it in a scripts-only sandboxed iframe, and failed regeneration retains the prior successful build.

---

# Milestone 6

Design Linter

Goal

Detect generic AI websites.

Rules

Reject

- centered hero
- repeated cards
- excessive gradients
- nested cards
- repeated section widths
- generic SaaS layouts

Output

Human-readable report.

Phase 3 status

Implemented with deterministic plan, source, architecture, runtime-policy, and rendered-evidence
checks. Subjective visual judgment remains explicitly human rather than being represented as a
machine guarantee.

---

# Milestone 7

Revision Loop

User

↓

Select Hero

↓

"Make this more editorial."

↓

Regenerate Hero only.

Phase 3.2 status

Implemented as one bounded child revision driven by rendered findings, followed by rebuild,
recapture, comparison, and explicit accept or reject. Interactive section selection, multi-step
revision history, and user-directed rollback remain Phase 4 product work.

---

# Milestone 8

Variants

Generate

Version A

Version B

Version C

Compare visually.

Status

Not started. Three-way variant generation and comparison remain Phase 4 product work.

---

# Future

## Screenshot Critique

Upload screenshot.

Generate improvement plan.

---

## Component Inspector

Click element.

Find React component.

Regenerate only that component.

---

## Style Packs

Installable design philosophies.

Examples

Apple

Stripe

Notion

Editorial

Luxury

Cyberpunk

Brutalist

Magazine

---

## Multi-Agent Design Reviews

Designer

↓

Typography Critic

↓

Animation Critic

↓

Accessibility

↓

Brand Critic

↓

Final Design

---

# Non-Goals

Do not become:

- Figma
- Framer
- Lovable
- Bolt
- Full-stack generator

Stay focused.

Beautiful React UI generation.

Nothing else.

---

# Success Criteria

The generated websites should never make users say:

"This looks AI-generated."

Instead, they should say:

"I would've assumed a designer built this."
