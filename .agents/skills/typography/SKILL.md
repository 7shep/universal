---
name: typography
description: Bounded refinement of an existing website or React interface's typographic system in Universal — font selection and loading strategy, type scale, hierarchy, line length, weight, vertical rhythm, and responsive type behavior — while preserving the established visual direction and the meaning of existing content. Never rewrites copy, changes layout structure, or changes color.
---

# /typography

Refine the typographic system of an existing UI: font selection and loading strategy, type scale,
hierarchy, line length (measure), font weight, vertical rhythm, and responsive type behavior.
Improve typographic craft within the established visual direction; do not redesign it. Source
mutation only happens through an explicit `/typography` invocation — never invoke this skill's
mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, component, viewport (`desktop`, `mobile`, or `both`),
and/or a specific typography goal (e.g. "tighten the heading scale on the pricing page", "fix
mobile line length in article body copy", "swap in a variable font without a loading regression").
If empty, infer the target only when the active conversation identifies one page, route, or
component unambiguously, and state that inference before editing. Otherwise ask the user to choose
the target and do not mutate files until they answer.

## Non-negotiable boundaries

Preserve exactly: business logic, state, routes, APIs, data flow, user-visible functionality,
accessibility semantics, the established color palette and design tokens outside typography, the
existing layout structure (grid/flex composition, spacing rhythm between non-text elements,
section order), and any unrelated in-progress changes already in the working tree.

Do not:

- rewrite, shorten, expand, or otherwise change the meaning or wording of any copy — that is
  `/copy`'s job; a wording change is out of scope even if it would "read better" at the new scale;
- change layout structure — grid/flex composition, container widths not driven by measure,
  section order, or component placement — that is `/layout`'s job; only change type-driven
  dimensions (line length, line height, margin _between text elements_ that is part of vertical
  rhythm);
- change color, including text color, link color, or selection/highlight color — that is
  `/color`'s job; a token rename that happens to touch a `color` property is out of scope here even
  if it lives in the same token file as a typography token being edited;
- introduce a new font family, weight, or loading strategy without accounting for font loading cost
  (added request weight, number of new font files/weights) and layout shift (missing `font-display`
  strategy, no size-adjusted fallback, no preload for a critical above-the-fold font);
- invent a parallel type-token system alongside an existing one — prefer editing existing type
  tokens (scale steps, weight tokens, line-height tokens, font-family tokens) over adding new ones;
  add a new token only when nothing existing covers the need and say why;
- add dependencies (a new font package, a font-loading library) unless clearly necessary — justify
  any addition explicitly;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into copy, layout, or color territory, say so and scope it back
to typography, or ask the user to confirm the larger change and route it to the right command
instead.

## Workflow

Work through these steps in order. Do not skip the proposal step (6) for anything beyond a
trivial, obviously-scoped single-property fix.

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components),
   viewport(s), and typography goal. State the resolved scope back before touching anything.

2. **Inspect source and existing type system.** Read the target React/CSS/route files and any
   directly related shared components, tokens, or styles. Identify the existing type scale, font
   families and weights in use, line-height/vertical-rhythm conventions, and any token file that
   already names typography values (e.g. `--font-size-*`, `--leading-*`, `--font-*`). Note the
   font loading mechanism currently in place (self-hosted `@font-face`, a font-loading package, a
   `<link rel="preload">`/`rel="stylesheet">` pair, or none) so any change stays consistent with it
   or improves it deliberately.

3. **Capture baseline visual evidence.** If browser/screenshot tooling is available in this
   environment (e.g. the `/browse` skill, a Playwright/Puppeteer setup already in the repo, or an
   equivalent), start or use the running dev server and capture desktop (~1440px) and mobile
   (~390px) screenshots of the target surface before editing. If no such tooling exists, do not
   fake it — explicitly record "no screenshot tooling available" and continue with source-only
   inspection; carry that limitation into the final report.

4. **Retrieve Universal design rules.** Call the Universal MCP tool `get_design_rules` with
   `category: "typography"` when the MCP is connected. Treat its `typographyPrinciples`,
   `antiPatterns`, and `implementationConstraints` as binding guidance for this pass. If the target
   surface also has notable spacing/vertical-rhythm questions, `spacingPrinciples` from the same
   response is fair game since rhythm is part of typography. If the MCP is unavailable, say so and
   fall back to `AGENTS.md`'s visual quality principles.

5. **Establish a baseline review.** Call `review_implementation` with the current source of the
   target files (plus visual evidence from step 3, if captured) to get a deterministic baseline
   `status`, `score`, and `findings` before making any change. If the MCP tool is unavailable,
   state that explicitly and proceed on source inspection plus the priorities below.

6. **Produce a proposed repair set before editing.** For each issue, write one line each for:
   _target_ (file/component/selector), _issue_, _intended change_, _font-loading/layout-shift
   impact if a font family or weight is changing_, _behavior/layout/color that must remain
   unchanged_. Keep this list bounded to what's in scope — cut anything speculative, anything that
   would rewrite copy, restructure layout, or touch color, and anything outside the resolved scope
   from step 1.

7. **Implement only the approved/requested scope.** Make the smallest change that fixes each item
   in the repair set. Prefer editing existing type tokens (scale, weight, line-height, family) over
   inventing new ones; introduce a new token only if it improves consistency and nothing existing
   covers it. When changing a font family:
   - account for loading cost — prefer variable fonts or a bounded weight subset over adding many
     static weights, and note the added transfer size;
   - set an explicit `font-display` strategy (or the loader's equivalent) and, where practical, a
     size-adjusted fallback stack to bound layout shift;
   - preload only a genuinely critical above-the-fold font, and do not preload fonts that are not
     used on initial render.

8. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope
   is broad), and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If
   formatting is needed, format only the files changed by this `/typography` run, then inspect the
   diff and reject unrelated formatter edits. Report exact commands and outcomes; do not claim a
   check passed without having run it.

9. **Inspect affected views.** Re-capture desktop and mobile screenshots of the changed surface
   using the same tooling as step 3, when available. If unavailable, state that no post-change
   visual inspection occurred. Where a font family or weight changed, look specifically for content
   reflow or shift between the fallback and loaded states, and note whether that could be observed
   with the available tooling.

10. **Re-run `review_implementation`** for materially changed React/CSS files (final content, plus
    fresh visual evidence when available). Compare against the step-5 baseline.

11. **Address practical high-severity findings** surfaced by step 10 within the bounded scope.
    Leave medium/low-severity findings that would require expanding scope (into layout, color, or
    copy) and note them as remaining limitations pointing to the right command instead of pulling
    them in silently.

12. **Report** using the format below.

## Typography priorities (in rough order of impact)

1. Hierarchy (heading scale steps read as a clear, intentional sequence; body vs. emphasis vs.
   caption text are visually distinct)
2. Type scale consistency (sizes come from the established scale/tokens, not arbitrary one-off
   values)
3. Line length / measure (body copy sits in a readable range, roughly 45-90 characters per line;
   narrower for captions, wider only when intentional)
4. Line height and vertical rhythm (leading appropriate to size and measure; consistent rhythm
   between text blocks)
5. Font weight usage (a bounded, purposeful set of weights; no arbitrary or redundant weights)
6. Font loading strategy and layout shift (appropriate `font-display`, fallback stack, preload
   scoped to critical fonts, bounded number of font files/weights requested)
7. Responsive type behavior (scale and measure adapt sensibly across viewports — fluid/clamp scales
   or breakpoint steps, no overflow/clipping/orphaned headings at target viewports)
8. Consistency with the selected art direction's typography (do not override the established
   typeface pairing or voice; only sharpen its execution)

## MCP usage and fallback

Calls `get_design_rules` (`category: "typography"`) and `review_implementation`, per
[`docs/MCP_REFERENCE.md`](../../../docs/MCP_REFERENCE.md#get_design_rules) and
[`docs/MCP_REFERENCE.md`](../../../docs/MCP_REFERENCE.md#review_implementation). Does not use
`get_taste_profile` or the stateful Phase 2 Art Director sequence — those belong to `/audit`,
`/review-ui`, and `/art-direct` respectively. If either MCP tool is unavailable, say so explicitly
in the report, fall back to `AGENTS.md`'s visual quality principles and the priorities above, and
do not fabricate a design-rules or review response.

## Required final report

Always output these eight sections, in order:

1. **Scope** — resolved target(s), viewport(s), typography goal
2. **Baseline issues** — from source inspection, `review_implementation`, and/or screenshots
3. **Files changed and why** — one line per file
4. **Behavior, layout, color, and copy preserved** — logic/state/routes/APIs/accessibility
   semantics, layout structure, color tokens, and content wording confirmed unchanged
5. **Validation performed** — exact commands run and their results (or "not run: <reason>")
6. **Before/after evidence** — screenshot paths/descriptions (including any observed font-swap
   reflow), or "no screenshot tooling available" stated plainly (never fabricated)
7. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred, and any finding redirected to `/copy`, `/layout`, or `/color`
8. **Remaining limitations** — anything out of scope, unavailable tooling, or deferred findings

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.
