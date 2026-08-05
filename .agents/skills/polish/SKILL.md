---
name: polish
description: Bounded visual refinement of an existing website or React interface — hierarchy, typography, spacing, responsiveness, accessibility, and implementation finish, without redesigning or changing behavior.
---

# /polish

Apply bounded, traceable visual refinement to an existing UI. Improve craft; do not redesign.
Source mutation only happens through an explicit `/polish` invocation — never invoke this skill's
mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, component, viewport (`desktop`, `mobile`, or `both`),
and/or a specific polish goal (e.g. "tighten spacing on the pricing table", "fix mobile nav
overflow"). If empty, infer the target only when the active conversation identifies one page, route,
or component unambiguously, and state that inference before editing. Otherwise ask the user to
choose the target and do not mutate files until they answer.

## Non-negotiable boundaries

Preserve exactly: business logic, state, routes, APIs, data flow, user-visible functionality,
accessibility semantics, and any unrelated in-progress changes already in the working tree.

Do not:

- turn a polish task into a wholesale redesign or swap the established design direction;
- add feature functionality that wasn't requested;
- rewrite whole components when a targeted change fixes the issue;
- add dependencies unless clearly necessary — justify any addition explicitly;
- add decorative gradients, glassmorphism, pills, or rounded cards by default, or nest cards
  inside cards;
- replace an intentional design with generic "clean SaaS" styling;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into redesign or functional territory, say so and scope it back
to polish, or ask the user to confirm the larger change before proceeding.

## Workflow

Work through these steps in order. Do not skip the proposal step (6) for anything beyond a
trivial, obviously-scoped single-property fix.

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components),
   viewport(s), and goal. State the resolved scope back before touching anything.

2. **Inspect source and design context.** Read the target React/CSS/route files and any directly
   related shared components, tokens, or styles. Identify the existing design system, component
   vocabulary, and constraints so changes stay consistent with them rather than introducing a
   parallel style.

3. **Capture baseline visual evidence.** If browser/screenshot tooling is available in this
   environment (e.g. the `/browse` skill, a Playwright/Puppeteer setup already in the repo, or an
   equivalent), start or use the running dev server and capture desktop (~1440px) and mobile
   (~390px) screenshots of the target surface before editing. If no such tooling exists, do not
   fake it — explicitly record "no screenshot tooling available" and continue with source-only
   inspection; carry that limitation into the final report.

4. **Retrieve Universal design rules and taste guidance.** Call the Universal MCP tools
   `get_design_rules` (relevant category — `general`, `website`, `typography`, `composition`,
   `imagery`, or `motion`) and `get_taste_profile` when the MCP is connected. Treat their
   `antiPatterns`, `categoryPrinciples`, and `implementationConstraints` as binding guidance for
   this pass. If the MCP is unavailable, say so and fall back to `AGENTS.md`'s visual quality
   principles.

5. **Establish a baseline review.** Call `review_implementation` with the current source of the
   target files (plus visual evidence from step 3, if captured) to get a deterministic baseline
   `status`, `score`, and `findings` before making any change. If the MCP tool is unavailable,
   state that explicitly and proceed on source inspection plus the priorities below.

6. **Produce a proposed repair set before editing.** For each issue, write one line each for:
   _target_ (file/component/selector), _issue_, _intended change_, _behavior that must remain
   unchanged_. Keep this list bounded to what's in scope — cut anything speculative or outside the
   resolved scope from step 1.

7. **Implement only the approved/requested scope.** Make the smallest change that fixes each item
   in the repair set. Prefer editing existing tokens/utility classes over inventing new ones;
   introduce a new primitive only if it improves consistency and nothing existing covers it.

8. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope
   is broad), and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If
   formatting is needed, format only the files changed by this `/polish` run, then inspect the diff
   and reject unrelated formatter edits. Report exact commands and outcomes; do not claim a check
   passed without having run it.

9. **Inspect affected views.** Re-capture desktop and mobile screenshots of the changed surface
   using the same tooling as step 3, when available. If unavailable, state that no post-change
   visual inspection occurred.

10. **Re-run `review_implementation`** for materially changed React/CSS files (final content, plus
    fresh visual evidence when available). Compare against the step-5 baseline.

11. **Address practical high-severity findings** surfaced by step 10 within the bounded scope.
    Leave medium/low-severity findings that would require expanding scope, and note them as
    remaining limitations instead of pulling them in silently.

12. **Report** using the format below.

## Polish priorities (in rough order of impact)

1. Visual hierarchy (heading scale, emphasis, primary action clarity)
2. Typography (scale, line-length, line-height, font pairing consistency)
3. Spacing and rhythm (consistent scale, no cramped or arbitrary gaps)
4. Alignment and grid discipline
5. Coherent component vocabulary (reuse existing patterns instead of inventing new ones)
6. Color and contrast (meet accessible contrast; stay within the established palette)
7. Responsive composition (no overflow/clipping/orphaned content at target viewports)
8. Interaction states: focus-visible, hover, active, loading, empty, and error states
9. Restrained motion, with `prefers-reduced-motion` respected
10. Removal of generic AI-looking treatments (default gradient heroes, cards-in-cards, unearned
    glassmorphism/pills) — only when they weren't an intentional part of the current direction
11. Consistency with the selected art direction (do not override it)

## Required final report

Always output these eight sections, in order:

1. **Scope** — resolved target(s), viewport(s), goal
2. **Baseline issues** — from source inspection, `review_implementation`, and/or screenshots
3. **Files changed and why** — one line per file
4. **Behavior preserved** — logic/state/routes/APIs/accessibility semantics confirmed unchanged
5. **Validation performed** — exact commands run and their results (or "not run: <reason>")
6. **Before/after evidence** — screenshot paths/descriptions, or "no screenshot tooling available"
   stated plainly (never fabricated)
7. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred
8. **Remaining limitations** — anything out of scope, unavailable tooling, or deferred findings

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.
