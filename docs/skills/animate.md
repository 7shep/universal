# `/animate`

`/animate` adds purposeful, bounded motion to an existing website or React interface: transitions
between states, micro-interactions on controls, scroll-triggered reveals, loading/progress
feedback, and a `prefers-reduced-motion` fallback for every animation it adds. It is a **mutation**
skill — source changes only happen on an explicit `/animate` invocation, never as a side effect of
another command.

The skill's full workflow, boundaries, and required report structure live in
[`.agents/skills/animate/SKILL.md`](../../.agents/skills/animate/SKILL.md) (and the identical
[`.claude/skills/animate/SKILL.md`](../../.claude/skills/animate/SKILL.md) for Claude Code). This
page is contributor-facing documentation: when to reach for `/animate` instead of a neighboring
command, what it may and may not change, and how to validate changes to the skill itself.

## What it does

Given a target (page, route, or component) and a motion goal, `/animate`:

1. Inspects the target's existing source and any motion conventions already present (transition
   utilities, duration/easing tokens, an existing animation library, existing
   `prefers-reduced-motion` handling).
2. Calls the Universal MCP tool `get_design_rules` with `category: "motion"` (and
   `get_taste_profile` when connected) for binding duration, easing, and anti-pattern guidance. If
   the MCP is unavailable, it falls back to `AGENTS.md`'s visual quality principles and the
   skill's own [`reference/motion-checklist.md`](../../.agents/skills/animate/reference/motion-checklist.md).
3. Calls `review_implementation` before and after the change to establish a baseline and confirm no
   new taste/composition regressions were introduced.
4. Proposes a bounded motion set (target, trigger, motion, purpose, reduced-motion fallback) before
   editing anything.
5. Implements the approved set, preferring CSS transitions/animations and the Web Animations API
   over adding a dependency, and animating compositor-friendly properties (`transform`, `opacity`)
   by default.
6. Verifies each new animation has a working `prefers-reduced-motion` fallback and does not harm
   keyboard operability or the accessibility tree.
7. Runs the repository's formatting/type/test/build checks scoped to the changed workspace.
8. Reports scope, baseline, motion added, behavior/layout preserved, reduced-motion verification,
   validation results, review findings, and remaining limitations.

## When to use it vs. neighboring commands

- **`/animate` vs. `/polish`** — `/polish` covers bounded visual refinement (hierarchy, typography,
  spacing, responsiveness, accessibility finish) and may touch restrained motion as one of many
  priorities. `/animate` is the dedicated, deeper pass specifically for adding or refining motion:
  use it when the request is centrally about how something moves (a missing loading state, a
  transition that should ease in, a scroll reveal), not about the surrounding visual craft.
- **`/animate` vs. `/layout`** — `/layout` governs composition, alignment, whitespace, pacing,
  density, and hierarchy. `/animate` must not change any of those; it animates the layout that
  already exists. If a motion request implies restructuring the layout (e.g. "make this section a
  scroll-pinned sequence" requiring new markup/composition), scope that part to `/layout` first.
- **`/animate` vs. `/cleanup`** — `/cleanup` removes redundant/inconsistent/obsolete patterns,
  including generic or unearned motion that doesn't belong. `/animate` only adds or refines
  intentional motion; it does not audit or remove existing animations except where doing so is
  required to add the requested motion cleanly (and that removal must be reported).
- **`/animate` vs. `/art-direct`** — `/art-direct` sets the original motion direction (via
  `motionPrinciples` and the Design Plan v2) as part of a new or substantially redesigned
  interface. `/animate` operates on an already-implemented interface to add or refine specific
  motion within an existing direction; it does not choose a new motion language.
- **`/animate` vs. `/audit` and `/review-ui`** — both of those are read-only. If you want a
  diagnosis of what's missing or wrong with an interface's motion before deciding what to add, run
  `/audit` or `/review-ui` (motion is one of their review dimensions) first, then hand the result to
  `/animate` to implement.
- **`/animate` vs. `/performance`** — `/performance` repairs evidence-backed, user-visible
  performance regressions. `/animate` must not introduce new ones (it defaults to
  compositor-friendly properties and bounds continuous/looping animation), but if a project already
  has a performance problem caused by existing motion, that repair belongs to `/performance`, not
  `/animate`.

## Invocation examples

```text
/animate Add a loading state to the newsletter submit button in frontend/src/components/Newsletter.tsx.
/animate Animate the mobile nav drawer open/close in apps/studio/src/routes/AppShell.
/animate Add scroll-reveal to the feature list on the marketing homepage.
/animate frontend/src/routes/Pricing — add a transition when the billing-period toggle changes.
```

If `$ARGUMENTS` is empty and the active conversation doesn't unambiguously identify one target,
the skill asks which page/route/component to animate rather than guessing across the monorepo.

## Mutation behavior

`/animate` **mutates source** — but only:

- CSS/style declarations that add transitions, keyframe animations, or a
  `prefers-reduced-motion` media query;
- markup changes strictly required to attach a transition/animation (e.g. adding a class, a
  `data-state` attribute, or an `aria-live` region for loading feedback) — not structural
  redesign;
- minimal script/hook changes needed to trigger or sequence an animation (e.g. adding an
  `IntersectionObserver` for a scroll reveal, a pending/loading flag for a submit button) that do
  not alter the underlying business logic or data flow.

It never touches: business logic, application state shape, routes, public APIs, layout/composition,
color, typography, copy, or accessibility semantics beyond what's required to keep a new animation
accessible. It never stages, commits, pushes, or opens a PR unless explicitly asked, and it never
runs destructive Git commands.

Dependencies: `/animate` does not add an animation library by default. It only adds one when the
library is already a project dependency, or the requested motion cannot reasonably be built with
CSS transitions/animations and the Web Animations API — and in that case the skill's report must
state the justification explicitly.

## Scope and limitations

- `/animate` does not run automated visual regression testing; verification depends on whatever
  browser/screenshot tooling (e.g. `/browse`, an existing Playwright/Puppeteer setup) is already
  wired into the environment. When none exists, the skill says so explicitly rather than fabricating
  a check.
- `/animate` cannot verify `prefers-reduced-motion` behavior in a real browser without that tooling;
  in that case it verifies the fallback is present and correct by source inspection (the media query
  or `matchMedia` branch exists and produces the same end state) and reports that limitation.
- It does not evaluate whether a scroll effect performs well on low-end devices; it applies the
  performance defaults in
  [`reference/motion-checklist.md`](../../.agents/skills/animate/reference/motion-checklist.md) and
  relies on `review_implementation`/the checks in step 9 of the workflow to catch what they can.
- It relies on `get_design_rules`/`get_taste_profile`/`review_implementation` for policy guidance;
  without the Universal MCP connected, guidance falls back to `AGENTS.md` and the skill's own
  checklist, which is necessarily less specific to the active taste profile.

## Verification

A contributor changing `.agents/skills/animate/SKILL.md`,
`.claude/skills/animate/SKILL.md`, or
`.agents/skills/animate/reference/motion-checklist.md` (and its `.claude` mirror) should:

1. Confirm both `SKILL.md` files still have byte-identical bodies (everything after the closing
   frontmatter `---`) — only frontmatter may differ (`.claude` adds `argument-hint` and
   `disable-model-invocation: true`).
2. Confirm `.agents/skills/animate/reference/motion-checklist.md` and
   `.claude/skills/animate/reference/motion-checklist.md` stay byte-identical.
3. Re-check that every MCP tool named in the skill (`get_design_rules`, `get_taste_profile`,
   `review_implementation`) still exists with a matching name and category list in
   [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
4. Re-check that every relative link in the SKILL.md files and this page resolves to a real file.
5. Walk a small worked example against the skill's non-negotiable boundaries — for instance, a
   request to "make the hero section slide in from all directions with a bouncing logo": confirm
   the skill's boundaries correctly flag the bouncing logo as gratuitous/no-purpose motion and scope
   the request back to a single restrained entrance transition with a reduced-motion fallback,
   rather than implementing it as asked.

This skill ships no `test-fixtures/` directory (unlike `/cleanup`); its guidance is validated by
the worked-example walk-through above rather than isolated before/after fixture files, since motion
correctness depends on runtime/browser behavior that static fixtures cannot represent.
