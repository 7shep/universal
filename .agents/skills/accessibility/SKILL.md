---
name: accessibility
description: Audits accessibility of an existing website or React interface in Universal — semantics, keyboard interaction, focus behavior, labels, contrast, touch targets, and reduced-motion support — and cites the specific WCAG 2.2 success criterion for every deterministic violation. Read-only (audit) by default; repairs source only when explicitly requested via $ARGUMENTS or a user confirmation, and only within the audited categories. Never claims an automated axe/Lighthouse/Pa11y scan ran.
---

# /accessibility

Audit accessibility for an existing route, component, or directory, and — only when explicitly
requested — repair what the audit found within seven bounded categories: semantics, keyboard
interaction, focus behavior, labels, contrast, touch targets, and reduced-motion support.

**Default mode is audit-only.** Do not edit, format, stage, commit, or push a single file unless
this invocation's `$ARGUMENTS` explicitly requests a repair (words like "fix", "repair", "apply
fixes", "resolve" paired with a scope), or the user explicitly confirms a repair after seeing the
proposed plan. A finding being trivially fixable is never itself authorization to fix it.

`$ARGUMENTS` names the scope (a route, component, or directory — for example
`apps/studio/src/routes/Preview`, `packages/ui Button`, or `the pricing page form`) and, optionally,
a repair request and/or a category focus (e.g. `fix contrast issues on the pricing page`, `audit
keyboard interaction in packages/ui/src/Nav.tsx`). If the scope is empty or ambiguous, ask before
reading broadly — do not guess at the whole repository. If a repair request is present but the
scope is not, ask for the scope before touching anything.

## Non-negotiables

- **Mutation is opt-in, per invocation.** No `Edit`, `Write`, `NotebookEdit`, formatter, `git add`,
  `git commit`, or `git push` unless this run's `$ARGUMENTS` explicitly requested a repair, or the
  user confirmed one after seeing the proposed repair set in this same run. Running `/accessibility`
  again later does not carry forward a prior run's authorization.
- **Never claim an automated accessibility scanner ran.** This skill does not integrate axe-core,
  Lighthouse, Pa11y, WAVE, or any other automated checker — none exists in this repository as of
  this writing (verified by search; see [reference/wcag-checks.md](reference/wcag-checks.md)). Every
  check here is computed by direct inspection of source, resolved styles, and — when available —
  real rendered evidence. State plainly, every time, that findings come from manual/computed
  inspection, not a scanner.
- **Cite the WCAG 2.2 success criterion for every deterministic finding**, using the mapping in
  [reference/wcag-checks.md](reference/wcag-checks.md). Never cite a criterion you didn't actually
  verify applies.
- **Classify every finding `deterministic` or `judgment`**, reusing the exact vocabulary and rubric
  in [`.agents/skills/audit/reference/finding-schema.md`](../audit/reference/finding-schema.md#deterministic-vs-judgment).
  A fact is `deterministic` only when it is mechanically checkable from source, resolved styles, or
  computation you actually performed (a literal contrast ratio, a confirmed-suppressed focus rule
  with no replacement, an input with no associated label, a computed hit-area below 24x24px). A
  finding that needs human taste or product context (is this heading skip actually confusing? is
  this motion essential to the interaction?) is `judgment`, even if it's accessibility-adjacent.
- **Repairs stay inside the seven audited categories.** Never use a repair invocation to redesign,
  restyle beyond what's needed for compliance, change copy, add features, or touch files outside the
  resolved scope. If a fix would require a larger change (a new design token system, a full
  navigation rework), say so and stop short of it rather than silently expanding scope.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not invent tool names or fields, and do not attempt the stateful
  Phase 2 Art Director sequence — that belongs to `/art-direct`.
- Never claim a viewport, screenshot, or rendered check happened when it didn't.

## Scope boundaries against neighboring commands

- `/audit` covers the full quality surface (hierarchy, composition, typography, spacing, color,
  responsive, accessibility, states, component vocabulary, generic patterns, craft) at a shallower
  accessibility depth. Use `/accessibility` when accessibility is the actual concern and you want
  WCAG-cited findings and an optional bounded repair; use `/audit` for a broader design-quality pass
  that happens to include an accessibility dimension.
- `/polish` may touch accessibility as one of several bounded refinement priorities alongside
  hierarchy, typography, and spacing. Use `/accessibility` when accessibility is the whole ask and
  you want criterion-level rigor; `/polish` when accessibility is one part of a broader craft pass.
- `/cleanup` removes redundant/inconsistent implementation; it is not the place for accessibility
  repair. If `/cleanup` surfaces an accessibility regression, hand it to `/accessibility`.
- `/review-ui` runs a multi-perspective read-only review (one of its eight critics is accessibility)
  and never mutates. Use `/review-ui` when accessibility is one lens among several you want
  synthesized; use `/accessibility` when you want a dedicated, WCAG-cited pass with an optional
  repair step.
- `/art-direct` and `/consistency` are out of scope entirely — this skill neither runs discovery nor
  chases design-system drift.

## Workflow

### 1. Resolve scope and mode

Parse `$ARGUMENTS` into a concrete target (files/routes/components) and a mode:

- **audit** (default) — no repair keyword present and no prior confirmation in this run.
- **audit + repair** — `$ARGUMENTS` explicitly requests a repair, or the user confirms one after
  seeing this run's proposed repair set (step 8).

State the resolved scope and mode back before reading anything. If a category focus was named
(semantics, keyboard, focus, labels, contrast, touch targets, reduced-motion), note it — otherwise
cover all seven wherever the scope makes them relevant.

### 2. Discover relevant files

Use `Glob`/`Grep`, scoped to the resolved target, to find:

- the entry component(s)/page(s) and their direct children;
- co-located or imported CSS/stylesheets and design tokens (for resolving actual colors, sizes, and
  motion rules);
- shared primitives from `packages/ui` or a project-local components directory that the scope
  reuses (fixing a shared primitive fixes every consumer — note that leverage in the report);
- form-related markup and its label associations;
- existing tests documenting intended keyboard/focus behavior.

Read only what the scope touches. If the scope is a whole directory or app, sample representative
files and say so rather than silently reading everything.

### 3. Gather available evidence

Collect whatever already exists — never manufacture any of it:

- **Existing screenshots or rendered evidence** relevant to the scope, from conventional output
  locations or paths the user names.
- **Fresh rendered evidence**, only if capture tooling is already available and wired up (e.g. the
  `/browse` skill, or a Playwright/Puppeteer setup already in the repo) against an already-running
  or trivially startable dev server — invoke it read-only. This is the only way to verify
  render-dependent checks (focus indicator actually visible at runtime, focus not obscured by an
  overlapping element, keyboard trap behavior). If no such tooling exists, say so explicitly and
  continue with source-only inspection; every render-dependent check that can't be confirmed this
  way stays a source-level inference (or is dropped to an evidence gap) rather than a firm finding.
- **Design context** already committed or already present in the conversation (a design plan,
  creative brief, selected direction, taste profile export). Absence is normal.

Every finding in the final report must trace back to something actually inspected here.

### 4. Run the deterministic checks

Work through [reference/wcag-checks.md](reference/wcag-checks.md) category by category
(semantics, keyboard interaction, focus behavior, labels, contrast, touch targets, reduced motion).
For each check:

- Resolve the actual values involved (literal colors for contrast, literal dimensions for touch
  targets, literal attribute presence for labels/names, literal CSS rules for focus/motion) — never
  estimate a contrast ratio or a pixel size without resolving the real value from source, tokens, or
  computed styles.
- Compute contrast ratios explicitly and show the computation (foreground hex, background hex,
  resulting ratio, threshold) in the finding's evidence.
- If a value can't be resolved statically (theme-derived, runtime-computed, dependent on user data),
  record it as an evidence gap instead of guessing.

### 5. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` (category `general` or `website`) for `implementationConstraints` and
  `antiPatterns` touching accessibility.
- `get_taste_profile` for principles with `appliesTo: 'controls'` (and any others touching
  accessibility) and their `severityDefault`/`allowWhen` exceptions.
- `review_implementation` with the scoped files' current, unmodified content and any visual evidence
  from step 3, shaped per
  [`docs/MCP_REFERENCE.md#review_implementation`](../../../docs/MCP_REFERENCE.md#review_implementation).
  Treat its `findings` as additional deterministic input, not a replacement for the WCAG-mapped
  checks in step 4 — this tool applies Universal's taste policy, not a WCAG conformance test.

If the MCP is unavailable, say so explicitly and continue — the WCAG-cited checks in step 4 do not
depend on it. Only the taste-policy-sourced findings are unavailable without MCP; they are
`judgment` findings regardless, so their absence narrows scope rather than downgrading anything.

### 6. Build findings

For each finding, populate every field below — see
[`audit/reference/finding-schema.md`](../audit/reference/finding-schema.md) for the base schema and
worked examples:

- **id** — stable, kebab-case, unique within this report (e.g. `a11y-001`);
- **category** — one of: semantics, keyboard, focus, labels, contrast, touch-targets,
  reduced-motion;
- **severity** — `high` (blocks access entirely: unreachable control, unlabeled required input,
  contrast failure on body text, suppressed focus with no replacement), `medium` (degrades access:
  borderline contrast on secondary text, ambiguous heading skip, small-but-not-tiny touch target),
  or `low` (minor refinement);
- **confidence** — evidence strength in prose, tied to what was actually inspected;
- **location** — file path with line/selector, component, or viewport;
- **evidence** — the concrete resolved fact (computed ratio with both hex values and the threshold,
  the exact attribute/CSS rule, a described rendered observation with its path) — never a bare
  assertion;
- **wcag_criterion** — the specific WCAG 2.2 success criterion number and name from
  [reference/wcag-checks.md](reference/wcag-checks.md) (e.g. "1.4.3 Contrast (Minimum)"), required
  for every `deterministic` finding; omit or mark "not applicable — judgment call" for pure
  `judgment` findings that don't map to a specific numbered criterion;
- **recommendation** — a scoped, actionable fix naming the file/selector; note if it exceeds this
  skill's repair categories;
- **classification** — `deterministic` or `judgment`, per the shared rubric.

Cover all seven categories wherever the scope and evidence make them relevant; skip a category
explicitly (stating why) rather than silently omitting it.

### 7. Audit-only stop point

If mode is **audit**, stop here. Produce the report per [Required final output](#required-final-output)
below with sections 5-8 explicitly marked not applicable, and confirm plainly that no source file
was modified. Do not propose fixes as if they were about to happen — offer them as what a
`/accessibility <scope> repair` (or equivalent explicit) invocation would address.

### 8. Propose the repair set (repair mode only)

Before editing anything, write one line each for every finding this run is authorized to touch:
_target_ (file/selector), _finding id_, _intended change_, _behavior/semantics that must remain
unchanged_. Include only findings inside the seven categories and inside the resolved scope. Leave
out anything that would require expanding scope (new tokens, structural redesign, new dependencies)
— note those as deferred instead. If the repair request in `$ARGUMENTS` was broad ("fix
accessibility issues"), this proposed set is itself the confirmation surface — proceed once it's
written, since the user already authorized repair; if mutation was instead triggered by an
in-conversation confirmation, that confirmation already covers this exact proposed set.

### 9. Implement only the proposed set

Make the smallest change that satisfies each finding: add the missing label/`aria-label`, restore a
visible focus treatment, adjust a resolved color to clear its threshold using an existing token when
one already meets it (introduce a new token only if no existing token clears the threshold and note
that addition explicitly), resize/space a touch target, add a `prefers-reduced-motion` guard around
non-essential motion. Preserve exactly: business logic, state, routes, APIs, data flow, visual
direction outside the specific compliance fix, and any unrelated in-progress changes already in the
working tree. Do not rewrite a whole component when a targeted attribute/CSS change fixes the issue.

### 10. Run checks

From the repository root, run what's applicable to the changed workspace: `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope is broad),
and `pnpm build` (or the workspace-scoped build) for changed packages/apps. If formatting is needed,
format only the files this run changed, then inspect the diff and reject unrelated formatter edits.
Report exact commands and outcomes; never claim a check passed without having run it.

### 11. Re-verify

Recompute, using the same method as step 4, every deterministic check this run touched (recompute
the contrast ratio, re-read the label/focus/motion rule, re-resolve the touch-target dimensions) to
confirm the fix actually clears the cited criterion. If render-dependent evidence was captured in
step 3, re-capture it for the changed surface. Re-run `review_implementation` for materially changed
React/CSS files and compare against the step-6 baseline findings.

### 12. Report

Use exactly the structure in [Required final output](#required-final-output) below.

## Required final output

1. **Scope, mode, and authorization** — resolved scope; mode (`audit` or `audit + repair`); if
   repair, exactly how mutation was authorized (the `$ARGUMENTS` wording or the in-conversation
   confirmation).
2. **Evidence inspected** — files read; rendered evidence found/captured (with paths) or explicitly
   absent; design-context artifacts found or explicitly absent; which MCP tools were called and
   which were unavailable; explicit statement that no automated accessibility scanner (axe/
   Lighthouse/Pa11y/WAVE) was run.
3. **Findings by category and severity** — using the schema from step 6, high severity first, every
   deterministic finding carrying its WCAG 2.2 criterion citation.
4. **What is already working well** — concrete, specific credit; not filler.
5. **Files changed and why** (repair mode only; "not applicable — audit-only run" otherwise) — one
   line per file, mapped to the finding id(s) it addresses.
6. **Behavior and semantics preserved** (repair mode only) — what was verified unchanged and how.
7. **Validation performed** (repair mode only) — exact commands run and their results, or "not run:
   `<reason>`".
8. **Before/after evidence** (repair mode only) — recomputed check results per finding, and
   rendered evidence paths/descriptions or "no screenshot tooling available" stated plainly.
9. **Remaining findings and deferred repairs** — everything not fixed (out of mode, out of the seven
   categories, or deferred because it would expand scope), each with why.
10. **Evidence gaps and limitations** — every unresolvable check, unavailable tool, missing viewport,
    or unknown design direction, stated plainly.
11. **Explicit confirmation of what was and wasn't modified** — for audit mode, state plainly that
    nothing was edited, formatted, staged, committed, or pushed; for repair mode, state plainly and
    exactly which files were modified and that nothing beyond the proposed repair set (step 8) was
    touched.

Never soften item 11 into "no significant changes," and never claim a rendered check, screenshot, or
automated scan happened when it didn't.

## Known limitations

- All checks are static/manual: computed from source, resolved styles, and — only when available —
  real rendered evidence. This skill cannot observe actual screen-reader announcement behavior,
  actual assistive-technology name/role/value computation across browser+AT combinations, or
  runtime-only failures (JS errors that break a widget only in certain states). Findings dependent
  on those require independent manual or automated-tool verification outside this skill.
- Contrast and touch-target checks require statically resolvable values; theme- or runtime-derived
  values that can't be resolved from source are reported as evidence gaps, not findings.
- Repair mode only fixes what's inside the seven categories and the resolved scope; it will never
  restructure navigation, rebuild a design-token system, or add new dependencies to satisfy a
  finding — those are reported as deferred with a note on what larger effort would be needed.
- `wcag_criterion` citations reflect WCAG 2.2. If a project's compliance target is 2.1, 2.4.11 and
  2.5.8 findings are 2.2-only additions and should be flagged as such.
