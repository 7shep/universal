---
name: animate
description: Adds purposeful motion to an existing UI — transitions, micro-interactions, scroll effects, loading feedback, and reduced-motion fallbacks — without redesigning layout/visuals or harming performance or accessibility.
---

# /animate

Add purposeful, bounded motion to an existing website or React interface: transitions between
states, micro-interactions on controls, scroll-triggered reveals, loading/progress feedback, and a
`prefers-reduced-motion` fallback for every animation this skill adds. Improve how the interface
moves; do not redesign what it looks like. Source mutation only happens through an explicit
`/animate` invocation — never invoke this skill's mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, or component, a motion goal (e.g. "add a loading
state to the submit button", "animate route transitions", "add scroll reveals to the feature
list"), and/or a viewport focus. If empty, infer the target only when the active conversation
identifies one page, route, or component unambiguously, and state that inference before editing.
Otherwise ask the user to choose the target and do not mutate files until they answer.

## Non-negotiable boundaries

Preserve exactly: business logic, state, routes, APIs, data flow, user-visible functionality,
accessibility semantics, layout, and any unrelated in-progress changes already in the working tree.

Do not:

- change composition, spacing, color, typography, or visual hierarchy — that is `/layout`,
  `/color`, `/typography`, or `/polish`;
- redesign a component's structure or markup to accommodate an animation; adapt the animation to
  the existing structure instead;
- add an animation library or dependency (Framer Motion, GSAP, react-spring, Lottie, etc.) unless
  one is already a dependency of the project, or the motion genuinely cannot be built with CSS
  transitions/animations plus the Web Animations API within reasonable effort — and even then,
  state the justification explicitly before adding it;
- add motion that has no functional or feedback purpose (decorative bouncing, spinning, or
  attention-seeking effects with no state change to communicate);
- add motion that autoplays continuously and cannot be paused/skipped (looping background
  animation, infinite marquees) unless it's core to the product and already present in the design
  direction;
- animate properties that force layout/paint on every frame (`width`, `height`, `top`, `left`,
  `margin`) when a `transform`/`opacity` equivalent achieves the same effect;
- ship any animation without a corresponding `prefers-reduced-motion` fallback that removes or
  substantially shortens the motion while preserving the resulting state change;
- introduce motion that traps focus, hides focus indicators during a transition, delays a control
  from being operable, or removes content from the accessibility tree while it is still visible;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into layout/visual redesign or requires a new dependency, say so
and scope it back to motion, or ask the user to confirm the larger change before proceeding.

## Workflow

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components) and a
   motion goal (which interaction, transition, scroll effect, or loading state needs motion).
   State the resolved scope back before touching anything.

2. **Inspect source and existing motion conventions.** Read the target React/CSS files and any
   directly related shared components, tokens, or styles. Identify: existing transition/animation
   utilities, easing/duration tokens, any animation library already in the project's
   `package.json`, existing `prefers-reduced-motion` handling, and interactive elements that
   currently have no feedback state (no hover/active/focus/loading treatment). Reuse existing
   motion tokens and utilities instead of inventing new ones.

3. **Retrieve Universal design rules for motion.** Call the Universal MCP tool `get_design_rules`
   with `category: "motion"` (and `get_taste_profile` when connected). Treat the returned
   `motionPrinciples`, `categoryPrinciples`, `antiPatterns`, and `implementationConstraints` as
   binding guidance for this pass — durations, easing character, what motion is expected vs.
   gratuitous, and reduced-motion expectations. If the MCP is unavailable, say so explicitly and
   fall back to `AGENTS.md`'s visual quality principles and
   [reference/motion-checklist.md](reference/motion-checklist.md).

4. **Capture baseline evidence.** If browser/screenshot or recording tooling is available in this
   environment (e.g. the `/browse` skill, a Playwright/Puppeteer setup already in the repo), start
   or use the running dev server and note the current (static or already-animated) behavior of the
   target interaction/transition before editing. If no such tooling exists, do not fake it —
   record "no browser tooling available" and continue with source-only inspection.

5. **Establish a baseline review.** Call `review_implementation` with the current source of the
   target files to get a deterministic baseline `status`, `score`, and `findings` before making any
   change. If the MCP tool is unavailable, state that explicitly and proceed on source inspection.

6. **Produce a proposed motion set before editing.** For each animation to add, write one line
   each for: _target_ (element/component/selector), _trigger_ (state change, scroll position,
   hover, route change, load), _motion_ (what moves, which CSS properties, approximate
   duration/easing), _purpose_ (what it communicates — not "looks nice"), and _reduced-motion
   fallback_ (what happens instead when `prefers-reduced-motion: reduce` is set). Keep this list
   bounded to what's in scope for the resolved goal — cut anything speculative.

7. **Implement only the approved/requested motion set.** Prefer CSS transitions/animations and the
   Web Animations API over a new dependency. Animate compositor-friendly properties (`transform`,
   `opacity`) by default; only animate other properties when the effect genuinely requires it and
   note why. Reuse or extend existing duration/easing tokens; introduce new ones only if none exist
   and the project would clearly benefit from a shared scale. Every animation added in this step
   must ship its `prefers-reduced-motion` fallback in the same edit, not as a follow-up.

8. **Wire reduced-motion and interruption handling.** Confirm each new animation: respects
   `prefers-reduced-motion` (via a CSS media query or the equivalent JS `matchMedia` check),
   remains interruptible/skippable where relevant (e.g. a route transition doesn't block
   navigation, a loading animation doesn't hide the ability to cancel), and does not remove
   interactive elements from tab order or hide focus outlines mid-transition.

9. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope
   is broad), and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If
   formatting is needed, format only the files changed by this `/animate` run and inspect the diff
   for unrelated formatter edits. Report exact commands and outcomes; do not claim a check passed
   without having run it.

10. **Re-inspect affected views.** Re-check the changed interaction/transition using the same
    tooling as step 4, at both normal motion and with `prefers-reduced-motion: reduce` simulated,
    when tooling supports it. If unavailable, state that no post-change visual/motion inspection
    occurred.

11. **Re-run `review_implementation`** for materially changed React/CSS files (final content).
    Compare against the step-5 baseline.

12. **Address practical high-severity findings** surfaced by step 11 within the bounded scope.
    Leave medium/low-severity findings that would require expanding scope, and note them as
    remaining limitations instead of pulling them in silently.

13. **Report** using the format below.

## What this skill does when the MCP is unavailable

If `mcp__universal__get_design_rules`, `get_taste_profile`, or `review_implementation` cannot be
reached, state that plainly in the report, fall back to `AGENTS.md`'s visual quality principles and
[reference/motion-checklist.md](reference/motion-checklist.md) for duration/easing/performance
defaults, and continue the rest of the workflow on source inspection alone. Never fabricate an MCP
response.

## Required final report

Always output these eight sections, in order:

1. **Scope** — resolved target(s) and motion goal
2. **Baseline** — existing motion conventions found, missing feedback states identified, and
   `review_implementation` baseline findings (or "not run: <reason>")
3. **Motion added** — the proposed motion set from step 6, with final trigger/motion/
   purpose/reduced-motion-fallback per item, and the file(s) it lives in
4. **Behavior and layout preserved** — confirmation that logic/state/routes/APIs/layout/visual
   design were unchanged, and how that was verified
5. **Reduced-motion and accessibility verification** — for every animation added, how its
   `prefers-reduced-motion` fallback was confirmed and any focus/tab-order/interruptibility checks
6. **Validation performed** — exact commands run and their results (or "not run: <reason>")
7. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred
8. **Remaining limitations** — anything out of scope, unavailable tooling, or deferred findings

Never claim a screenshot, browser check, reduced-motion simulation, or MCP call happened when it
didn't. State tool unavailability as a limitation rather than omitting the step silently.
