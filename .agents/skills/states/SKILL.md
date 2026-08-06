---
name: states
description: Finds and completes missing interaction and application states — hover, focus-visible, active, selected, disabled, loading, empty, error, success, and skeleton — for an existing React interface in Universal, wiring each state to real data/logic and keeping disabled/loading semantics accessible. Mutates source only on explicit invocation.
---

# /states

Find and complete missing interaction and application states for an existing UI surface: hover,
focus-visible, active, selected, disabled, loading, empty, error, success, and skeleton. Improve
completeness and accessibility of state feedback; do not redesign the surface or invent states its
data layer cannot produce. Source mutation only happens through an explicit `/states` invocation —
never invoke this skill's mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, component, or directory, and/or a specific state focus
(for example `packages/ui Button`, `the settings form error and success states`, or `apps/studio
sidebar loading/empty states`). If empty, infer the target only when the active conversation
identifies one page, route, or component unambiguously, and state that inference before editing.
Otherwise ask the user to choose the target and do not mutate files until they answer.

## Non-negotiable boundaries

Preserve exactly: business logic, state shape, routes, APIs, data flow, existing user-visible
functionality, and any unrelated in-progress changes already in the working tree.

Do not:

- add a state a component's real data/logic layer cannot produce — no `loading` state on a
  component with no async dependency, no `error` state with no fallible operation behind it, no
  `empty` state on something that never renders a collection. See
  [reference/state-coverage-matrix.md](reference/state-coverage-matrix.md) footnotes for the
  conditional cases;
- fake a state visually without wiring it to the thing that actually drives it (no timer-based
  "success" flash with no backing signal, no hard-coded `disabled` with no condition, no skeleton
  that never clears because nothing toggles it off);
- use bare `disabled` where `aria-disabled` is required to keep a control focusable/discoverable, or
  vice versa — see [reference/accessible-state-semantics.md](reference/accessible-state-semantics.md);
- invent new visual language for a state treatment when an existing token or primitive already
  covers it — reuse the established hover/focus/disabled/loading treatment rather than introducing a
  parallel one;
- turn a states task into a wholesale redesign, restyle unrelated elements, or change information
  architecture;
- add dependencies unless clearly necessary — justify any addition explicitly;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into redesign or new-functionality territory (e.g. "add a
multi-step save flow"), say so and scope it back to completing existing states, or ask the user to
confirm the larger change before proceeding.

## Scope boundaries against neighboring commands

- **`/audit`** — read-only evidence report; `/states` is the mutation counterpart specifically for
  interaction/application state coverage, not the general audit.
- **`/polish`** — broader bounded visual refinement (hierarchy, typography, spacing, a11y finish);
  `/states` is narrower and specifically about completing the interaction/application state set.
  Route pure typography/spacing work to `/polish`.
- **`/cleanup`** — removes redundant/inconsistent/generic patterns; `/states` adds missing coverage.
  If a component has a redundant duplicated state treatment, `/cleanup` handles consolidating it,
  `/states` handles a state that's outright missing.
- **`/accessibility`** — broader a11y audit/repair; `/states` only touches the accessibility
  semantics that are intrinsic to the ten interaction/application states listed above (e.g.
  `aria-busy`, `aria-disabled` vs. `disabled`). It does not perform a general accessibility sweep
  (color contrast unrelated to state, heading structure, landmark regions).
- **`/animate`** — purposeful motion and transitions; `/states` may add a state's minimal visual
  treatment (e.g. a disabled opacity token) but leaves transition/motion design for `/animate`.
- **`/consistency`** — design-system drift generally; `/states` is scoped to the specific
  interaction/application state taxonomy in the coverage matrix.

## Does this skill mutate source?

Yes. `/states` edits component markup, event wiring, and styling to add or repair missing states.
Mutation happens only when a user explicitly invokes `/states` — never as a side effect of another
skill or of general conversation. Everything through the proposed-repair-set step (step 6 below) is
read-only.

## Workflow

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components) and,
   if given, a state focus. State the resolved scope back before touching anything.

2. **Inspect source and existing state coverage.** Read the target React/CSS/route files, their
   direct children, and the shared tokens/primitives they use. For each component, note:
   - its real data/interaction model — what async calls, form validation, selection state, and
     collection data it actually has;
   - which of the ten states already exist, and whether each is wired to real logic or merely
     styled;
   - existing token/primitive patterns for hover/focus/active/disabled/loading treatments elsewhere
     in the codebase, so additions stay consistent rather than introducing a new visual language.

3. **Classify each component against the coverage matrix.** Use
   [reference/state-coverage-matrix.md](reference/state-coverage-matrix.md) to map each component to
   its closest row and determine which states are required (`R`), conditionally required (`C` — only
   if the stated precondition genuinely exists in this component's data/logic), or not applicable
   (`—`). Do not add a state whose precondition doesn't exist in this component.

4. **Retrieve Universal design rules and taste guidance.** Call the Universal MCP tools
   `get_design_rules` (category `general`, `website`, or `composition`, whichever is closest to the
   target) and `get_taste_profile` when the MCP is connected. Use their `antiPatterns` and
   `implementationConstraints` to keep additions consistent with the established direction. If the
   MCP is unavailable, say so and fall back to `AGENTS.md`'s visual quality principles.

5. **Establish a baseline review.** Call `review_implementation` with the current source of the
   target files to get a deterministic baseline `status`, `score`, and `findings` before making any
   change. If the MCP tool is unavailable, state that explicitly and proceed on source inspection
   plus the matrix.

6. **Produce a proposed repair set before editing.** For each gap, write one line each for:
   _target_ (file/component), _missing or broken state_, _matrix row and required/conditional
   status_, _real signal it will be wired to_ (the actual data/logic that will drive it — never
   "will simulate"), _accessible semantics to use_ (per
   [reference/accessible-state-semantics.md](reference/accessible-state-semantics.md)), _token/
   primitive to reuse_. Drop anything where the required precondition doesn't actually exist in the
   component.

7. **Implement only the approved/resolved scope.** For each item in the repair set:
   - wire the state to the real signal identified in step 6 (an existing async call's pending/
     settled/error result, real form validity, real selection state, real collection length) —
     never a decorative constant;
   - use the accessible semantics from
     [reference/accessible-state-semantics.md](reference/accessible-state-semantics.md), in
     particular `aria-disabled` vs. native `disabled`, and `aria-busy` scoped to the region actually
     loading;
   - reuse the existing token/primitive for the visual treatment; introduce a new primitive only if
     nothing existing covers the pattern, and say so explicitly.

8. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope
   is broad), and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If
   formatting is needed, format only the files changed by this `/states` run, then inspect the diff
   and reject unrelated formatter edits. Report exact commands and outcomes; do not claim a check
   passed without having run it.

9. **Inspect affected views for the added states, when tooling allows.** If browser/screenshot
   tooling is available in this environment (e.g. the `/browse` skill, or an existing Playwright/
   Puppeteer setup), exercise each newly wired state (hover, keyboard focus, disabled precondition,
   an in-flight async call, an empty/error/success data condition) and capture evidence. If no such
   tooling exists, do not fake it — record "no interaction-state tooling available" and continue
   with source-only verification; carry that limitation into the final report.

10. **Re-run `review_implementation`** for materially changed React/CSS files. Compare against the
    step-5 baseline.

11. **Address practical high-severity findings** surfaced by step 10 within the bounded scope. Leave
    findings that would require expanding scope, and note them as remaining limitations.

12. **Report** using the format below.

## Required final report

Always output these eight sections, in order:

1. **Scope** — resolved target(s) and state focus, if any.
2. **Coverage assessment** — per component: matrix row used, states already present and correctly
   wired, states missing, states explicitly out of scope because their precondition doesn't exist
   (with why).
3. **Files changed and why** — one line per file, naming the state(s) it now covers and the real
   signal each is wired to.
4. **Accessibility semantics applied** — for each disabled/loading state touched, which of
   `disabled`/`aria-disabled` and `aria-busy` was used and why, per
   [reference/accessible-state-semantics.md](reference/accessible-state-semantics.md).
5. **Validation performed** — exact commands run and their results (or "not run: <reason>").
6. **State evidence** — interaction-state screenshots/descriptions captured, or "no interaction-
   state tooling available" stated plainly (never fabricated).
7. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred.
8. **Remaining limitations** — any states intentionally left uncovered, unavailable tooling, or
   deferred findings.

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.

## Known limitations

- `/states` relies on the coverage matrix's classification; a component that doesn't map cleanly
  onto an existing row needs a judgment call — state the mapping used rather than silently forcing a
  fit.
- Without MCP connectivity, `get_design_rules`/`get_taste_profile`/`review_implementation` guidance
  is unavailable and the skill falls back to `AGENTS.md` principles plus the matrix alone; say so
  explicitly.
- Without browser/screenshot tooling, added states are verified by source inspection only (correct
  wiring, correct ARIA attributes, correct class/token usage), not by visually exercising them.
- `/states` does not add states to purely presentational components with no interaction model — it
  will report those as not applicable rather than inventing interactivity.
