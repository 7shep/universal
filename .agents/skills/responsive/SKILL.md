---
name: responsive
description: Reviews and repairs an existing website or React interface across representative viewport widths in Universal — overflow, wrapping, navigation collapse, touch targets, content order, density, and breakpoint-specific composition — without redesigning the product or changing its visual direction. Source mutation only occurs on explicit /responsive invocation.
---

# /responsive

Review an existing UI across a fixed, representative set of viewport widths and repair concrete
responsive defects: overflow/clipping, bad wrapping, broken navigation collapse, undersized touch
targets, wrong content order, mismatched information density, and breakpoint-specific composition
bugs. This is a **repair** pass, not a redesign and not a visual-direction change: the typography
scale, color palette, component vocabulary, and overall aesthetic stay exactly what they already
are. Source mutation only happens through an explicit `/responsive` invocation — never invoke this
skill's mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, or component, and/or a specific responsive complaint
(e.g. "the pricing table overflows on mobile", "check the dashboard nav at tablet width"). If
empty, infer the target only when the active conversation identifies one page, route, or component
unambiguously, and state that inference before editing. Otherwise ask the user to choose the target
and do not mutate files until they answer.

## Representative viewport set

Every `/responsive` run is evaluated against these five widths unless `$ARGUMENTS` explicitly
narrows the set:

| Label     | Width  | Represents                               |
| --------- | ------ | ---------------------------------------- |
| `mobile`  | 390px  | Small phone (e.g. iPhone 12/13/14 class) |
| `tablet`  | 768px  | Tablet portrait / small split-view       |
| `laptop`  | 1024px | Small laptop / tablet landscape          |
| `desktop` | 1440px | Standard desktop                         |
| `wide`    | 1920px | Large desktop / external monitor         |

If `$ARGUMENTS` names a narrower set (e.g. "check mobile and desktop only"), use that subset and
say so in the report. Do not silently drop a width because it's inconvenient to check — if capture
tooling can't reach a width, say that explicitly instead of skipping it quietly.

## Non-negotiable boundaries

Preserve exactly: business logic, state, routes, APIs, data flow, user-visible functionality,
accessibility semantics, the established visual direction (palette, type scale, component
vocabulary, motion language), and any unrelated in-progress changes already in the working tree.

Do not:

- change the visual direction, palette, typography scale, or component vocabulary — that is
  `/art-direct`'s job, not this skill's;
- perform general craft polish unrelated to responsive behavior (that is `/polish`'s job) — stay
  scoped to overflow, wrapping, navigation, touch targets, content order, density, and
  breakpoint-specific composition;
- introduce a new breakpoint system or grid architecture when a targeted fix at the existing
  breakpoints resolves the defect;
- remove content or features to "make room" at a narrow width — reflow, restructure, or
  progressively disclose instead of deleting;
- add dependencies unless clearly necessary — justify any addition explicitly;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into redesign or visual-direction territory, say so and scope it
back to responsive repair, or ask the user to confirm the larger change (and point them at
`/art-direct` or `/polish`) before proceeding.

## Workflow

### 1. Resolve scope

Interpret `$ARGUMENTS` as a page/route/component and, optionally, a narrowed viewport subset or a
specific complaint. State the resolved target and viewport set back before touching anything.

### 2. Inspect source and layout mechanism

Read the target React/CSS/route files and any directly related shared layout components, tokens,
and breakpoint definitions (media queries, container queries, CSS Grid/Flexbox rules, any
`useMediaQuery`-style hooks). Identify:

- the existing breakpoint values already in use (they may not match the representative set exactly
  — note the mapping, don't invent new breakpoints unless the defect requires it);
- navigation structure and how/whether it collapses (hamburger, tab bar, off-canvas, priority nav);
- components most likely to break at narrow or wide widths (tables, multi-column layouts, fixed
  widths, `nowrap` text, absolutely positioned elements, fixed-height containers).

### 3. Capture per-viewport baseline evidence

For **every** width in the resolved viewport set, attempt to capture real evidence — do not
describe a viewport you did not actually inspect:

- If browser/screenshot tooling is available in this environment (the `/browse` skill, a
  Playwright/Puppeteer setup already in the repo, or an equivalent), start or use the running dev
  server and capture a screenshot at each resolved width, noting the exact pixel width used.
- If no such tooling exists, do not fake it. Explicitly record "no screenshot tooling available" as
  a limitation for every width you could not capture, and fall back to source-only inspection:
  reason from the actual CSS/markup about what will happen at each width (fixed widths that exceed
  the viewport, `flex-wrap: nowrap` where wrapping is needed, media query breakpoints that leave
  gaps, etc.) and label that reasoning as inference, not observed evidence.
- Partial capture is allowed and must be reported honestly: if tooling captures `mobile` and
  `desktop` but times out on the rest, say exactly which widths have real screenshots and which
  fall back to source-only inference.

### 4. Retrieve Universal design guidance

Call `get_design_rules` with category `website` or `composition` (whichever fits the target) and
`get_taste_profile`, when the MCP is connected, and treat their responsive-relevant
`implementationConstraints` and `antiPatterns` as binding guidance. If the MCP is unavailable, say
so and fall back to `AGENTS.md`'s visual quality principles.

### 5. Establish a baseline review

Call `review_implementation` with the current source of the target files, plus any visual evidence
from step 3, to get a deterministic baseline `status`, `score`, and `findings` before making any
change. If the MCP tool is unavailable, state that explicitly and proceed on source inspection plus
the checklist below.

### 6. Build per-viewport findings

Work through [reference/viewport-checklist.md](reference/viewport-checklist.md) at each resolved
width. For every defect found, record: viewport(s) affected, target (file/selector/component),
the concrete symptom (e.g. "table overflows container at 390px, no horizontal scroll affordance"),
and the intended fix. Cover, at minimum, wherever relevant to the target:

- **Overflow/clipping** — content wider than its container, unintended horizontal scroll, clipped
  text or media.
- **Wrapping** — text or inline elements wrapping badly (orphaned words, broken buttons, labels
  colliding).
- **Navigation** — collapse/expansion behavior at each width, reachability of every nav item,
  no dead zones between collapsed and expanded states.
- **Touch targets** — interactive elements below ~44x44px (or the project's established minimum)
  at touch-relevant widths (`mobile`, `tablet`).
- **Content order** — DOM/visual order that still makes sense once layout reflows (no
  reading-order regressions from CSS reordering, no orphaned or reordered content that loses
  meaning).
- **Density** — information density appropriate to the width (not desktop-density crammed onto
  mobile, not mobile-sparse wasted space on wide screens).
- **Breakpoint-specific composition** — layout that intentionally changes shape between
  breakpoints (column count, stacked vs. side-by-side) does so cleanly, without an awkward
  in-between state at widths between the defined breakpoints.

### 7. Produce a proposed repair set before editing

For each finding, write one line each for: _target_ (file/component/selector), _viewport(s)
affected_, _issue_, _intended change_, _behavior/content that must remain unchanged_. Keep the list
bounded to responsive defects only — cut anything that is really a `/polish`, `/cleanup`, or
`/art-direct` concern and name which command it belongs to instead.

### 8. Implement only the approved/resolved scope

Make the smallest change that fixes each item: adjust existing media queries/breakpoints, fix
flex/grid rules, correct `min-width`/`max-width`/`overflow` handling, reorder content via layout
(not by deleting it), enlarge touch targets, or fix navigation collapse logic. Prefer editing
existing breakpoint tokens/utilities over inventing new ones. Do not change colors, type scale, or
component identity while fixing a responsive defect.

### 9. Run checks

From the repository root, run what's applicable to the changed workspace: `pnpm format:check`,
`pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope is broad), and
`pnpm build` (or the workspace-scoped build) for changed packages/apps. If formatting is needed,
format only the files changed by this `/responsive` run, then inspect the diff and reject unrelated
formatter edits. Report exact commands and outcomes; do not claim a check passed without having run
it.

### 10. Re-capture per-viewport evidence

Re-capture the same viewport set as step 3, using the same tooling, for every changed surface. If
tooling was unavailable in step 3, it remains unavailable here — say so again rather than
implying the situation changed.

### 11. Re-run `review_implementation`

For materially changed React/CSS files (final content, plus fresh visual evidence when available).
Compare against the step-5 baseline.

### 12. Address practical high-severity findings

Surfaced by step 11, within the bounded responsive scope. Leave medium/low-severity findings that
would require expanding scope, and note them as remaining limitations instead of pulling them in
silently.

### 13. Report

Use the format in [Required final report](#required-final-report) below.

## MCP usage and unavailability

This skill calls only `get_design_rules`, `get_taste_profile`, and `review_implementation` — the
tools documented in [`docs/MCP_REFERENCE.md`](../../../docs/MCP_REFERENCE.md#get_design_rules). It
never invokes the stateful Phase 2 Art Director sequence (`start_art_direction` and friends) — that
belongs to `/art-direct`, and a responsive repair pass has no session to resume. If any of the three
tools is unavailable or errors, say so explicitly in the report and continue with source inspection
plus the checklist in [reference/viewport-checklist.md](reference/viewport-checklist.md).

## Required final report

Always output these nine sections, in order:

1. **Scope** — resolved target, resolved viewport set (and why, if narrowed from the default five)
2. **Per-viewport evidence** — for each width: screenshot captured (with path) or "no screenshot
   tooling available — source-only inference," stated plainly per width
3. **Baseline findings** — from source inspection, `review_implementation`, and/or screenshots,
   organized by viewport and category (overflow, wrapping, navigation, touch targets, content
   order, density, breakpoint composition)
4. **Files changed and why** — one line per file
5. **Behavior preserved** — logic/state/routes/APIs/accessibility semantics/visual direction
   confirmed unchanged
6. **Validation performed** — exact commands run and their results (or "not run: <reason>")
7. **Before/after per-viewport evidence** — screenshot paths/descriptions per width, or "no
   screenshot tooling available" stated plainly (never fabricated)
8. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred
9. **Remaining limitations** — anything out of scope, unavailable tooling, unreachable viewports,
   or deferred findings

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool or
viewport unavailability as a limitation rather than omitting it silently.
