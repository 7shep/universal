# `/color`

Improves how color is *used* in an existing Universal UI: palette cohesion, semantic color roles,
contrast, interaction-state colors, and design-token discipline. It does not change what the
palette *is* — it makes the UI use the existing palette more consistently and more legibly.

Full workflow, boundaries, and required report structure live in the skill itself:

- [`.agents/skills/color/SKILL.md`](../../.agents/skills/color/SKILL.md)
- [`.claude/skills/color/SKILL.md`](../../.claude/skills/color/SKILL.md)
- [`.agents/skills/color/reference/contrast-formula.md`](../../.agents/skills/color/reference/contrast-formula.md) —
  the exact WCAG relative-luminance/contrast-ratio computation method, with a fully worked example.

## What it does

Given a page, route, component, directory, or a named color goal, `/color`:

1. Inventories existing design tokens, one-off literal hex/rgb/hsl values, semantic color roles
   (background, surface, text, muted, border, accent, danger, warning, success, focus ring,
   disabled), and any dark-mode/theme-variant mechanism present in the scope.
2. Pulls Universal's `get_design_rules` and `get_taste_profile` guidance (when the MCP is
   connected) as binding input on anti-patterns and constraints touching color.
3. Computes real contrast ratios for every meaningful foreground/background pairing in scope,
   using the WCAG relative-luminance formula — resolving tokens to their literal values first, and
   repeating the computation per theme when more than one theme exists. Every ratio in the report is
   shown with its arithmetic, not asserted.
4. Builds a prioritized repair plan: contrast failures first, then missing/reused interaction-state
   colors, then one-off literals that should route onto an existing token, then missing semantic
   roles, then dark-mode/theme gaps.
5. Applies only the approved/resolved-scope fixes, consolidating one-off values into the *nearest
   existing token* by default.
6. Runs `pnpm format:check` / `pnpm typecheck` / relevant tests / build for the touched workspace,
   recomputes the changed contrast ratios post-edit, and re-runs `review_implementation` to confirm
   no new taste/composition regressions were introduced.

## When to use `/color` vs. neighboring commands

- **vs. `/art-direct`** — `/art-direct` is the only command allowed to pick or change a palette,
  hue family, or overall visual direction. If the request is "switch to a warmer palette" or "make
  it feel more luxury," that is `/art-direct`, not `/color`. `/color` refuses and redirects requests
  that would change the established palette rather than consolidate/repair it.
- **vs. `/audit`** — `/audit` is read-only and covers every design dimension, color included, at a
  broader survey level. Use `/audit` first if you don't yet know whether color is even the problem;
  use `/color` once you know you want a bounded color fix applied.
- **vs. `/polish`** — `/polish`'s color priority ("meet accessible contrast; stay within the
  established palette") is a subset of what `/color` does in depth. Use `/polish` for a general
  bounded refinement pass that happens to touch color lightly; use `/color` when color/contrast/
  token consolidation is the actual focus and needs the full contrast-computation rigor.
- **vs. `/cleanup`** — `/cleanup` also consolidates duplicated tokens, but across *any* visual
  property (radii, spacing, shadows, typography, color included) with a classification workflow
  (safe-mechanical / behavior-sensitive / design-judgment / uncertain). Use `/cleanup` when the
  cleanup target spans multiple token families; use `/color` when the target is specifically
  color/contrast/interaction-state work and you need documented contrast-ratio math.
- **vs. `/review-ui`** — `/review-ui` is read-only, multi-perspective synthesis (including a color
  perspective) with no mutation. Use it to get a ranked cross-cutting report; hand any color findings
  it surfaces to `/color` to actually fix.
- **vs. `/consistency`** — `/consistency` (once shipped) detects broader design-system drift across
  all token families with conditional, selectively-approved mutation. `/color` is narrower and
  color-specific, and always documents contrast math as part of its own workflow.
- **vs. `/typography`** — typography color (e.g. text-on-background contrast for headings/body) is
  in scope for `/color`'s contrast computation; type scale, pairing, and rhythm are `/typography`'s
  job, not `/color`'s.

## Invocation examples

```text
/color Fix low-contrast secondary text on the pricing page.
/color apps/studio/src/routes/Preview — check dark mode contrast.
/color Consolidate one-off hex values in frontend/src/styles.css into existing tokens.
/color packages/ui Button — add missing hover/focus/disabled color treatments.
/color audit contrast only, do not change anything yet.
```

If `$ARGUMENTS` is empty, the skill infers a target only when the active conversation unambiguously
names one page/route/component, and states that inference before editing; otherwise it asks first
and makes no changes until the user answers.

## Mutation behavior

- **Mutates source only on explicit `/color` invocation.** It never edits files as a side effect of
  being merely mentioned or referenced by another skill.
- **May change:** literal color values routed onto existing tokens, new interaction-state color
  rules (hover/active/focus-visible/disabled/selected) for elements already interactive, a token's
  *usage* in the scoped files, and — only when explicitly justified and no existing token fits — one
  new token added to serve a role nothing existing covers.
- **May not change:** the established palette/hue family, the overall visual direction, non-color
  markup structure, business logic, state, routing, or accessibility semantics unrelated to color.
- **Requests that are actually palette swaps or new visual directions are declined and redirected**
  to `/art-direct` rather than reinterpreted as consolidation work.
- Does not stage, commit, push, or open a PR unless explicitly asked.

## Scope and limitations

- Only covers CSS/token-driven UI color — it does not evaluate color inside rasterized images,
  icons, or illustrations (that's `/assets`).
- Contrast ratios are computed from source values it can actually resolve; a color set only by an
  external, un-inspectable runtime source is reported as unverifiable rather than guessed at.
- Does not run an automated browser-based contrast scanner or evaluate colorblind-safe separation
  beyond existing `get_design_rules`/`get_taste_profile` guidance — a suspected colorblind-safety gap
  is reported as a judgment-based observation, not a computed finding.
- Cannot verify a theme variant that exists in code but isn't reachable/toggleable in the current
  environment; that is reported as a limitation, not skipped silently.

## Verification

Every `/color` run reports the exact commands used for that pass. In the general case, from the
repository root or a workspace filter appropriate to the touched files:

```bash
pnpm format:check
pnpm typecheck
pnpm --filter <workspace> test
pnpm build
```

Contrast-ratio math itself is verified by recomputation: the skill computes the ratio before the
edit and again after, using the identical method in
[`reference/contrast-formula.md`](../../.agents/skills/color/reference/contrast-formula.md), and
reports both so a reviewer can check the arithmetic directly rather than trust an assertion.

### Validating changes to the skill itself

This skill ships no test fixtures (no isolated `test-fixtures/` directory, unlike `/cleanup`). To
validate a change to `SKILL.md` or the contrast-formula reference:

1. Re-run the worked example in
   [`reference/contrast-formula.md`](../../.agents/skills/color/reference/contrast-formula.md) by
   hand (or with a small script) and confirm the documented intermediate values and final ratio
   (`4.92`) still match the formula as written.
2. Pick a real component in this repo with at least one CSS custom property and one literal color,
   and walk workflow steps 1-7 manually against it without editing anything, confirming the
   inventory and repair-plan format the skill produces matches what `SKILL.md` specifies.
3. Confirm the two `SKILL.md` trees (`.agents/skills/color` and `.claude/skills/color`) stay
   byte-identical in body content after any edit — only the frontmatter should differ.
