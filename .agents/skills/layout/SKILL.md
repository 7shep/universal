---
name: layout
description: Structural composition pass for an existing website or React interface in Universal — alignment, whitespace, section pacing, density, and visual hierarchy, sized between /polish's touch-ups and /art-direct's full redesign. Mutates source only on explicit invocation, preserves DOM order that carries semantic/accessibility meaning, and calls get_design_rules with the composition category.
---

# /layout

Improve composition, alignment, whitespace, section pacing, density, and visual hierarchy of an
already-implemented UI while preserving functionality and the established art direction. Source
mutation only happens through an explicit `/layout` invocation — never invoke this skill's
mutation steps on your own initiative.

`$ARGUMENTS` names the scope: a page, route, component, or directory, plus an optional layout
focus (for example `apps/studio/src/routes/Preview`, `the pricing page — section pacing feels
uniform`, or `frontend/src/components/Hero alignment and density`). If empty, infer the target only
when the active conversation identifies one page, route, or component unambiguously, and state that
inference before editing. Otherwise ask the user to choose the target and do not mutate files until
they answer.

## Scope: where /layout sits

`/layout` is a **structural presentation pass** — it changes how existing sections, blocks, and
content are arranged in space. It is deliberately sized between two neighbors:

- **Bigger than `/polish`.** `/polish` tightens spacing values, fixes small alignment slips, and
  finishes craft within the current structure. `/layout` can reorder sections visually (via CSS —
  see DOM-order rule below), rebalance column ratios, change section rhythm/pacing across a whole
  page, and rework density and grouping. If a request is a single-property nudge ("bump this gap by
  4px"), that's `/polish`'s job — say so and hand it off, or fold it in only if it's incidental to a
  larger layout change already in scope.
- **Smaller than `/art-direct`.** `/art-direct` runs discovery, selects a creative direction, and
  can change typography systems, color systems, imagery direction, motion language, and the
  fundamental visual thesis of a surface. `/layout` never changes the selected art direction, the
  typographic scale/family system, the color palette/tokens, or the imagery/motion language — it
  rearranges and re-paces what's already there under that direction. **If a request requires a new
  visual thesis, a new component vocabulary, new page sections that don't exist yet, or a change to
  typography/color/motion systems, that exceeds `/layout`'s scope.** State that explicitly and tell
  the user to run `/art-direct` (new direction/major restructure), `/typography` or `/color`
  (system-level changes to those domains), or `/states` (missing interaction states) instead of
  quietly absorbing the request.
- **Not `/responsive`'s job.** `/responsive` owns breakpoint repair — fixing overflow, clipping,
  broken stacking, or touch-target regressions at specific viewports. `/layout` may need to touch
  responsive CSS when a composition change requires it (e.g. a rebalanced grid needs new column
  spans at a breakpoint), but must not perform broader breakpoint repair work beyond what the
  composition change itself requires. If you find unrelated breakpoint bugs while working, note them
  as a limitation for `/responsive` rather than fixing them here.
- **Not `/consistency`.** `/layout` doesn't hunt for design-system drift across unrelated surfaces;
  it improves the composition of the scoped target.

## Non-negotiable boundaries

Preserve exactly: business logic, state, routes, APIs, data flow, user-visible functionality,
the selected art direction (typography system, color system, imagery/motion language), and any
unrelated in-progress changes already in the working tree.

- **Preserve DOM order that carries semantic or accessibility meaning.** Reading order, heading
  order, landmark order, tab order, and form-field order must not change unless the request is
  explicitly about fixing a broken reading/tab order. Achieve visual reflow (e.g. "put the image on
  the left on desktop") with CSS (grid/flex `order`, `grid-template-areas`, source-order-preserving
  layout) rather than moving markup, so assistive-technology and keyboard order stay intact. If a
  requested visual arrangement is impossible without reordering markup in a way that would change
  reading/tab order, say so explicitly and do not make the change silently.
- Do not change the typographic scale/family system, the color palette/tokens, or the motion
  language — those belong to `/typography`, `/color`, and `/animate`.
- Do not perform breakpoint repair beyond what the composition change itself requires — that's
  `/responsive`'s job.
- Do not add feature functionality that wasn't requested.
- Do not add dependencies unless clearly necessary — justify any addition explicitly.
- Do not add decorative gradients, glassmorphism, pills, or rounded cards by default, or nest cards
  inside cards, to "fill" reclaimed whitespace.
- Do not replace an intentional design with generic "clean SaaS" layout defaults (uniform
  three-column grids, centered-everything, interchangeable section templates).
- Never run destructive Git commands, and never stage/commit/push/open a PR unless the user
  explicitly asks.

If a requested change would cross into redesign, a new system, or breakpoint-repair territory, say
so and scope it back to `/layout`, or point to the right command instead of quietly absorbing it.

## Workflow

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components) and a
   layout focus (composition, alignment, whitespace, pacing, density, hierarchy — or "all"). State
   the resolved scope back before touching anything.

2. **Inspect source and design context.** Read the target React/CSS/route files and any directly
   related shared components, tokens, layout primitives, and grid utilities. Identify the existing
   section structure, spacing scale, grid system, and component vocabulary so changes stay
   consistent with them rather than introducing a parallel layout system.

3. **Capture baseline visual evidence.** If browser/screenshot tooling is available in this
   environment (e.g. the `/browse` skill, a Playwright/Puppeteer setup already in the repo, or an
   equivalent), start or use the running dev server and capture desktop (~1440px) and mobile
   (~390px) screenshots of the target surface before editing. If no such tooling exists, do not fake
   it — explicitly record "no screenshot tooling available" and continue with source-only inspection;
   carry that limitation into the final report.

4. **Retrieve Universal design rules.** Call the Universal MCP tool `get_design_rules` with
   `category: "composition"`. Treat the returned `compositionPrinciples`, `spacingPrinciples`,
   `antiPatterns`, and `implementationConstraints` as binding guidance for this pass. Also call
   `get_taste_profile` when the MCP is connected, for any `composition`-scoped principles/
   anti-patterns it lists. If the MCP is unavailable, say so explicitly and fall back to
   `AGENTS.md`'s visual quality principles.

5. **Establish a baseline review.** Call `review_implementation` with the current source of the
   target files (plus visual evidence from step 3, if captured) to get a deterministic baseline
   `status`, `score`, and `findings` before making any change. If the MCP tool is unavailable, state
   that explicitly and proceed on source inspection plus the priorities below.

6. **Produce a proposed composition-change set before editing.** For each issue, write one line
   each for: _target_ (file/section/selector), _issue_, _intended change_, _DOM-order impact_ (none
   / CSS-only reflow / requires markup reorder — flag the last case per the boundary above),
   _behavior that must remain unchanged_. Keep this list bounded to composition/alignment/
   whitespace/pacing/density/hierarchy — cut anything that's really a typography, color, motion, or
   breakpoint-repair concern.

7. **Implement only the approved/requested scope.** Make the smallest structural change that
   achieves each item. Prefer existing spacing/grid tokens and layout primitives over inventing new
   ones; introduce a new primitive only if it improves consistency and nothing existing covers it.
   Use CSS-level reflow (not markup reordering) wherever a visual rearrangement is needed but reading
   order must be preserved.

8. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope
   is broad), and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If
   formatting is needed, format only the files changed by this `/layout` run, then inspect the diff
   and reject unrelated formatter edits. Report exact commands and outcomes; do not claim a check
   passed without having run it.

9. **Inspect affected views.** Re-capture desktop and mobile screenshots of the changed surface
   using the same tooling as step 3, when available. If unavailable, state that no post-change visual
   inspection occurred.

10. **Re-run `review_implementation`** for materially changed React/CSS files (final content, plus
    fresh visual evidence when available). Compare against the step-5 baseline.

11. **Verify DOM-order and behavior preservation explicitly.** Confirm reading order, heading order,
    landmark order, tab order, and form-field order are unchanged (diff the rendered markup order, or
    reason through the DOM structure if no rendering tool is available) and that no unrelated
    breakpoint repair crept in beyond what the composition change required.

12. **Address practical high-severity findings** surfaced by step 10 within the bounded scope. Leave
    medium/low-severity findings that would require expanding scope, and note them as remaining
    limitations instead of pulling them in silently.

13. **Report** using the format below.

## Layout priorities (in rough order of impact)

1. Visual hierarchy (what should be seen first, second, third — and whether the layout delivers that)
2. Section pacing and rhythm (varied section density instead of uniform block-after-block repetition)
3. Whitespace (intentional breathing room, not leftover gaps or cramped stacking)
4. Alignment and grid discipline (consistent baseline/edge alignment across a section)
5. Density (information-per-viewport tuned to the surface's purpose — dashboard vs. marketing page)
6. Composition balance (asymmetry where it serves the direction, not accidental lopsidedness)
7. Coherent layout vocabulary (reuse existing grid/section primitives instead of inventing new ones)
8. Removal of generic AI-looking layout defaults (uniform three-column grids, centered-everything,
   interchangeable section templates) — only when they weren't an intentional part of the current
   direction

## MCP tools used

- `get_design_rules` with `category: "composition"` — required every run; also read
  `spacingPrinciples` and `antiPatterns` from the same response.
- `get_taste_profile` — composition-scoped principles/anti-patterns, when connected.
- `review_implementation` — baseline (step 5) and post-change (step 10) deterministic review.

If any MCP tool is unavailable, state that plainly in the report rather than silently skipping the
step, and fall back to `AGENTS.md`'s visual quality principles and source-level reasoning.

## Required final report

Always output these nine sections, in order:

1. **Scope** — resolved target(s), layout focus
2. **Boundary check** — confirmation the request fits `/layout` (not `/polish`, `/art-direct`,
   `/responsive`, `/typography`, `/color`, or `/consistency`), or an explicit statement that part of
   the request was escalated/deferred and to which command
3. **Baseline issues** — from source inspection, `get_design_rules`, `review_implementation`, and/or
   screenshots
4. **Files changed and why** — one line per file
5. **DOM order and behavior preserved** — reading/heading/landmark/tab/form-field order, logic,
   state, routes, APIs, and accessibility semantics confirmed unchanged, and how
6. **Validation performed** — exact commands run and their results (or "not run: <reason>")
7. **Before/after evidence** — screenshot paths/descriptions, or "no screenshot tooling available"
   stated plainly (never fabricated)
8. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred
9. **Remaining limitations** — anything out of scope, unavailable tooling, deferred findings, or
   breakpoint issues noted for `/responsive`

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.

## Known limitations

- `/layout` has no automated way to detect DOM-order changes beyond manual inspection of the
  rendered markup or source JSX structure — there is no dedicated accessibility-tree diff tool in
  this workflow. Treat step 11 as a careful manual check, not a guaranteed catch.
- Section-pacing judgments (what counts as "too uniform" or "too dense") are taste calls informed by
  `get_design_rules`/`get_taste_profile`, not a deterministic metric — disagreements should be
  resolved by asking the user rather than asserting certainty.
- When the MCP server is unavailable, composition guidance falls back to `AGENTS.md`'s general
  visual-quality principles, which are less specific than the `composition` category's
  `compositionPrinciples`/`antiPatterns`.
