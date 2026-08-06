# `/accessibility`

Audits accessibility for an existing route, component, or directory and cites the specific
WCAG 2.2 success criterion for every deterministic violation. Repairs source only when explicitly
requested, and only within seven bounded categories: semantics, keyboard interaction, focus
behavior, labels, contrast, touch targets, and reduced-motion support.

Source: [`.agents/skills/accessibility/SKILL.md`](../../.agents/skills/accessibility/SKILL.md) and
[`.claude/skills/accessibility/SKILL.md`](../../.claude/skills/accessibility/SKILL.md) (identical
body; the `.claude` copy adds `disable-model-invocation`, `argument-hint`, per Claude Code skill
conventions). Check mapping:
[`.agents/skills/accessibility/reference/wcag-checks.md`](../../.agents/skills/accessibility/reference/wcag-checks.md).

## What it does

1. Resolves a scope and a mode — `audit` (default) or `audit + repair` (only when `$ARGUMENTS`
   explicitly requests a repair, or the user confirms one after seeing the proposed repair set).
2. Reads the scoped source, stylesheets/tokens, and shared primitives it depends on.
3. Gathers whatever rendered evidence already exists, and captures fresh evidence only if
   screenshot/browser tooling is already available in the environment (e.g. the `/browse` skill).
   It never fabricates a screenshot or a scan result.
4. Runs the checks in
   [`reference/wcag-checks.md`](../../.agents/skills/accessibility/reference/wcag-checks.md) —
   semantics, keyboard interaction, focus behavior, labels, contrast, touch targets, and
   reduced-motion support — resolving real values (literal colors, literal dimensions, literal CSS
   rules) rather than estimating them.
5. Optionally calls the Universal MCP tools `get_design_rules`, `get_taste_profile`, and
   `review_implementation` for additional taste-policy-sourced findings; these are always
   `judgment`-classified and are additive, not required, since the WCAG-cited checks don't depend
   on MCP.
6. Classifies every finding `deterministic` or `judgment`, reusing the exact vocabulary from
   [`.agents/skills/audit/reference/finding-schema.md`](../../.agents/skills/audit/reference/finding-schema.md#deterministic-vs-judgment),
   and cites the specific WCAG 2.2 success criterion for every `deterministic` finding.
7. In audit mode, stops and reports. In repair mode, proposes a bounded repair set, implements only
   what's on it, runs the repository's checks, and recomputes the touched checks to confirm the fix
   actually clears the cited criterion.

It never claims an automated accessibility scanner (axe-core, Lighthouse, Pa11y, WAVE) ran. No such
tool is integrated in this repository; every finding here comes from direct inspection and
computation, and the report says so explicitly every time.

## When to use it vs. neighboring commands

- **`/audit`** — broader design-quality audit (hierarchy, composition, typography, spacing, color,
  responsive, accessibility, states, component vocabulary, generic patterns, craft) with
  accessibility as one of many dimensions, less rigorously cited. Use `/accessibility` when
  accessibility is the actual concern and you want WCAG 2.2-cited findings and an optional bounded
  repair. Use `/audit` for a general quality pass that happens to touch accessibility.
- **`/polish`** — bounded visual refinement across hierarchy, typography, spacing, responsiveness,
  and accessibility together. Use `/accessibility` when accessibility is the whole ask and you want
  criterion-level rigor and a dedicated audit-first gate; use `/polish` when accessibility is one
  part of a broader craft pass.
- **`/cleanup`** — removes redundant/inconsistent implementation without changing behavior; it is
  not a place to repair accessibility. Route accessibility regressions found during `/cleanup` to
  `/accessibility` instead.
- **`/review-ui`** — multi-perspective, strictly read-only synthesis where accessibility is one of
  eight critics. Use `/review-ui` when you want several lenses reconciled into one ranked report;
  use `/accessibility` for a dedicated, WCAG-cited pass with an optional repair step.
- **`/art-direct`**, **`/consistency`**, and the other Phase 5 commands — out of scope entirely.
  `/accessibility` never runs discovery and never chases design-system drift.

## Invocation examples

```text
/accessibility apps/studio/src/routes/Preview
/accessibility packages/ui/src/Button.tsx focus and touch targets
/accessibility the checkout form — audit labels and keyboard interaction only
/accessibility apps/studio/src/routes/Pricing repair contrast issues
/accessibility packages/ui/src/Nav.tsx fix the suppressed focus indicator
```

The first three invocations are audit-only by default (no repair keyword). The last two explicitly
request a repair, so `/accessibility` proposes a bounded repair set for confirmation-equivalent
authorization before touching any file.

## Mutation behavior

- **Default: read-only.** No `Edit`, `Write`, `NotebookEdit`, formatter, or git mutation command
  runs unless this invocation explicitly requested a repair or the user confirmed one in-conversation
  after seeing the proposed set.
- **Repair mode is bounded to the seven audited categories** — semantics, keyboard interaction,
  focus behavior, labels, contrast, touch targets, reduced-motion support. It will not redesign,
  restyle beyond what compliance requires, change copy, add product features, or expand scope beyond
  the resolved target.
- **Repairs prefer existing tokens/primitives.** A contrast fix reuses an existing token that already
  clears the threshold when one exists; a new token is introduced only when nothing existing clears
  it, and that addition is called out explicitly in the report.
- **Every repair is re-verified** by recomputing the same check that flagged it (recompute the
  contrast ratio, re-read the label/focus/motion rule, re-resolve touch-target dimensions) before
  the run is reported as complete.
- **Authorization does not carry across invocations.** A prior `/accessibility ... repair` run does
  not authorize mutation on a later, differently scoped invocation.

## Scope and limitations

- All checks are static/manual: computed from source, resolved styles, and — only when available —
  real rendered evidence captured by existing tooling in the environment. It cannot observe actual
  screen-reader announcement behavior or assistive-technology name/role/value computation across
  real browser+AT combinations; those require independent verification outside this skill.
- Contrast and touch-target checks require statically resolvable values. Theme- or runtime-derived
  values that can't be resolved from source are reported as evidence gaps, not findings — the skill
  does not guess at a ratio or a pixel size.
- `wcag_criterion` citations reflect WCAG 2.2 numbering. 2.4.11 Focus Not Obscured (Minimum) and
  2.5.8 Target Size (Minimum) are 2.2-only additions; if a project's compliance target is WCAG 2.1,
  the report flags these citations as 2.2-only.
- Repair mode will never restructure navigation, rebuild a design-token system, or add a dependency
  to satisfy a finding — those are reported as deferred, with a note on what larger effort (likely a
  `/polish`, `/cleanup`, or `/art-direct` invocation) would be needed instead.

## Verification

`/accessibility` itself runs, when in repair mode: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` (or a `--filter <workspace>` scoped subset for a narrow change), and
`pnpm build` for changed packages/apps — plus a recomputation of every deterministic check the repair
touched. Audit-mode runs perform no repository checks because nothing was mutated.

To validate a change to the skill itself (its `SKILL.md` or `reference/wcag-checks.md`):

1. Give a fresh subagent only `SKILL.md` and `reference/wcag-checks.md`, plus a small fixture
   surface with a known, deliberately introduced violation in each of the seven categories (for
   example: an icon-only button with no accessible name, an `outline: none` rule with no
   replacement, two colors whose contrast ratio you've precomputed to fail 4.5:1, an unlabeled
   `<input>`, a `tabIndex` value greater than `0`, a control smaller than 24x24px, and a decorative
   CSS animation with no `prefers-reduced-motion` guard).
2. Ask it to run the audit workflow (mode: audit) and report findings, without telling it which
   category each fixture exercises.
3. Confirm it: classifies each introduced violation `deterministic` with the correct WCAG 2.2
   citation from `reference/wcag-checks.md`; does not claim an automated scanner ran; and does not
   modify any file (since no repair was requested).
4. Re-run with an explicit repair request against the same fixture and confirm it proposes a bounded
   repair set before editing, fixes only the seven-category findings, and recomputes each fix to
   confirm the criterion is cleared.

This repository does not yet ship a committed fixture directory for `/accessibility` (unlike
`/cleanup`'s `test-fixtures/`); treat the above as the manual validation procedure until one is
added, and do not claim an automated fixture suite ran.
