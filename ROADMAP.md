# Universal
> An AI Art Director for React applications.

## Implementation status (2026-07-29)

### Complete

Phases 1-3 are implemented: monorepo and Studio foundations; discovery and explicit brief approval;
differentiated concepts and Design Plan v2; composition and taste policy; deterministic,
provider-neutral React generation; immutable runtime workspaces; locked offline builds; isolated
loopback previews; connected Studio/Preview lifecycle states; deterministic rendered-evidence
benchmarking; and last-known-good recovery. See [Phase 3 local runtime](docs/PHASE3_RUNTIME.md).

### Next: Phase 4 - release hardening

Phase 4 strengthens the local-first runtime without broadening the product into hosted deployment,
arbitrary packages, or a general-purpose execution sandbox.

- **In progress:** permanent v2 benchmark corpus, report schema, baseline comparison, and regression
  reporting.
- **In progress:** process-supervision hardening for spawn failures, cancellation/timeout races, and
  complete process-tree cleanup.
- **To do:** safe retention of stale immutable revisions while protecting every project's latest
  successful build and active operations.
- **To do:** a Windows, macOS, and Linux validation matrix for runtime lifecycle, workspace safety,
  and locked builds.
- **To do:** release-readiness documentation, reproducible verification guidance, and a scoped
  packaging/distribution decision.

The remaining milestones and Future section describe direction. They do not claim shipped hosted,
deployment, arbitrary-package, production-provider, or OS/container-sandbox capabilities.

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

---

# Milestone 8

Variants

Generate

Version A

Version B

Version C

Compare visually.

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
