# Design Studio
> An AI Art Director for React applications.

---

# Vision

Developers can already generate functional websites.

The problem is that almost every AI-generated website looks the same.

Purple gradients.

Cards inside cards.

Generic hero.

Three-column feature grid.

Another CTA.

Design Studio exists to fix that.

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

No implementation yet.

Just schemas.

---

# Milestone 4

React Generator

Goal

Generate React code from specification.

Requirements

- React
- Vite
- TypeScript
- Tailwind

Must compile successfully.

---

# Milestone 5

Live Preview

Goal

Automatically run generated project.

Display inside iframe.

Support regeneration.

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
