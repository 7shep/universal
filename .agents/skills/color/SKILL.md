---
name: color
description: Bounded improvement of palette cohesion, semantic color roles, contrast, interaction-state colors, and design-token usage in an existing Universal UI — consolidates one-off hex values into existing tokens and documents real contrast-ratio computations. Never swaps the established palette or introduces an unrelated visual direction; that belongs to /art-direct.
---

# /color

Evaluate and improve how color is _used_ in an existing UI: palette cohesion, semantic color roles
(background/surface/text/muted/accent/border/danger/success/warning, etc.), contrast compliance,
interaction-state colors (hover/active/focus/disabled/selected), and design-token discipline.
Source mutation only happens through an explicit `/color` invocation — never invoke this skill's
mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, component, directory, or a specific color goal (for
example `apps/studio/src/routes/Preview`, `fix low-contrast secondary text on the pricing page`, or
`consolidate one-off hex values in frontend/src/styles.css`). If empty, infer the target only when
the active conversation identifies one page, route, or component unambiguously, and state that
inference before editing. Otherwise ask the user to choose the target and do not mutate files until
they answer.

## Non-negotiable boundaries

- **Never swap the established palette or introduce an unrelated visual direction.** `/color`
  consolidates and corrects the palette that already exists (or the one set by the active Design
  Plan/selected direction when one exists); it does not pick a new hue family, mood, or theme. A
  request to change the actual visual direction ("make it feel more luxury," "switch to a warm
  palette") belongs to `/art-direct`, not this skill — say so and stop rather than reinterpreting the
  request.
- **Never assert contrast compliance without computing it.** Every contrast claim in this skill's
  output must show the actual computed ratio against a real foreground/background pair drawn from
  the source (see [reference/contrast-formula.md](reference/contrast-formula.md)), not a general
  claim like "this looks readable" or "this meets WCAG AA."
- **Consolidate into existing tokens by default.** When multiple one-off hex/RGB/HSL values are
  functionally the same role, replace them with the nearest existing design token rather than
  minting a new one. Only introduce a new token when no existing token can correctly serve the role
  (state that reasoning explicitly) and doing so doesn't itself constitute a palette change.
- **Never invent a semantic role that doesn't exist in the project's token system without saying so.**
  If a project has no token for a role a fix needs (e.g. no `--color-danger`), either reuse the
  closest matching existing surface/text token, or propose adding exactly the one new token needed
  and say why nothing existing covers it — do not add a parallel ad hoc token system.
- Preserve exactly: business logic, state, routing, non-color markup structure, accessibility
  semantics beyond color/contrast, and any unrelated in-progress changes already in the working tree.
- Do not add a color/theming dependency or CSS-in-JS system to solve what existing tokens/CSS
  variables can already solve.
- Do not stage, commit, push, or open a PR unless the user explicitly asks for it.
- Never claim a screenshot, browser check, or MCP call happened when it didn't.

If a requested change would cross into a new visual direction or palette swap, say so plainly and
either scope it back to consolidation/contrast/token work, or tell the user to run `/art-direct`
instead.

## Workflow

### 1. Resolve scope

Interpret `$ARGUMENTS` as a route, component, directory, or named color goal. If ambiguous or
missing, ask before touching files. State the resolved scope back before continuing.

### 2. Inspect current color usage

Read the target source, its co-located styles, and shared token/theme files (CSS custom properties,
a theme object, Tailwind config, or an equivalent). Build an inventory of:

- **existing tokens** and what each currently resolves to (name → value, and where it's defined);
- **one-off literal colors** (hex/rgb/hsl values not routed through a token) used in the scope, with
  file:line for each;
- **semantic roles already in play** (background, surface, text, muted/secondary text, border,
  accent/brand, interactive/link, danger, warning, success, focus ring, disabled) and which token or
  literal currently serves each;
- **dark mode / theme variants**, if present — a `prefers-color-scheme` media query, a `.dark`
  class/data-attribute scheme, a theme provider, or duplicated token sets per theme. If the project
  has no theme-variant mechanism at all, state that plainly rather than assuming one; do not add a
  dark-mode system as a side effect of this skill unless explicitly asked.
- **interaction-state color handling** for interactive elements in scope: hover, active, focus-visible,
  disabled, and selected states, and whether each currently has a distinct, intentional color
  treatment or silently reuses the resting/base color.

### 3. Retrieve Universal design rules and taste guidance

Call the Universal MCP tools `get_design_rules` (category `general` or `website`, and `composition`
when layout-adjacent color use is in scope) and `get_taste_profile` when the MCP is connected. Treat
returned `antiPatterns` and `implementationConstraints` touching color as binding guidance for this
pass — for example, flag unearned gradients or decorative color treatments the taste profile calls
out. If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles.

If a Design Plan (v1 `designTokens.colors` or a Design Plan v2 color section) or a selected art
direction is available in the conversation or repo, treat its palette as the source of truth for
what the "established palette" is — this skill must stay inside it, not replace it.

### 4. Establish a baseline review

Call `review_implementation` with the current source of the target files (plus visual evidence if
capturable per step 6) to get a deterministic baseline `status`, `score`, and `findings` before
making any change. If the MCP tool is unavailable, state that explicitly and proceed on source
inspection plus steps 5-7 below.

### 5. Compute real contrast ratios

For every meaningful text/icon-on-background and interactive-control/border-on-background pairing
touched by the scope (not just the ones that look risky), compute the actual contrast ratio using
the WCAG relative-luminance formula in
[reference/contrast-formula.md](reference/contrast-formula.md). For each pairing, record: the exact
foreground and background values used (resolve tokens/variables to their literal color first), the
computed ratio, the applicable WCAG threshold (4.5:1 for normal text, 3:1 for large text ≥24px/19px
bold and for non-text UI components/graphical objects), pass/fail, and — when a theme variant exists
— repeat the computation for each theme (light/dark/etc.) separately, since the same token name can
resolve to different literal values per theme.

Never round in the pass direction, and never state a ratio without showing the computation (or a
clear reference to the exact luminance/ratio arithmetic performed).

### 6. Capture visual evidence, if available

If browser/screenshot tooling is available in this environment (e.g. the `/browse` skill, a
Playwright/Puppeteer setup already in the repo, or an equivalent), start or use the running dev
server and capture the target surface in both light and dark/theme variants when both exist, and
at a state that shows hover/focus/active/disabled treatments where practical (e.g. via forced
pseudo-class inspection or interaction). If no such tooling exists, do not fake it — record "no
screenshot tooling available" and continue with source-only inspection and the computed ratios from
step 5; carry that limitation into the final report.

### 7. Build the consolidation and repair plan before editing

For each issue found across steps 2-6, write one line each for: _target_ (file/selector/token),
_issue_ (one-off literal, contrast failure, missing/incorrect semantic role, missing or reused
interaction-state color, inconsistent token usage), _intended change_ (which existing token to route
onto, or the exact new token proposed with justification), and _behavior/visual-direction that must
remain unchanged_. Keep the list bounded to what's in scope.

Prioritize in this order:

1. Contrast failures on real content (computed in step 5) — especially body text, links, and
   disabled/placeholder text that's still expected to be legible enough to convey state.
2. Missing or reused-from-resting interaction-state colors on interactive elements (hover/focus/
   active/disabled/selected all resolving to the same color as resting state).
3. One-off literal colors duplicating an existing token's role — consolidate onto the token.
4. Inconsistent or missing semantic roles (e.g. danger/success/warning text using arbitrary literals
   instead of a shared role).
5. Dark mode / theme-variant gaps — a literal or token that isn't defined for a theme the project
   otherwise supports, or a hardcoded light-only color surviving into a dark-mode tree.

### 8. Implement only the approved/resolved scope

Make the smallest change that fixes each item in the repair plan. Route literals onto the nearest
correct existing token. Do not touch colors outside the resolved scope even if they show the same
pattern — note them as out-of-scope observations in the report instead.

### 9. Run checks

From the repository root, run what's applicable to the changed workspace: `pnpm format:check`,
`pnpm typecheck`, `pnpm --filter <workspace> test` (or `pnpm test` if scope is broad), and
`pnpm build` (or the workspace-scoped build) for changed packages/apps. If formatting is needed,
format only the files changed by this `/color` run and inspect the diff for unrelated formatter
edits. Report exact commands and outcomes; do not claim a check passed without having run it.

### 10. Recompute contrast and re-inspect

Recompute the contrast ratios from step 5 against the post-edit values for every pairing that
changed, using the same method, and confirm each now meets its threshold (or document why it
doesn't and what's blocking it). Re-capture screenshots per step 6's tooling, if available, for both
theme variants when present.

### 11. Re-run `review_implementation`

Call it again for materially changed React/CSS files (final content, plus fresh visual evidence when
available). Compare against the step-4 baseline. Address practical high-severity findings within the
bounded scope; leave medium/low findings that would require expanding scope, and note them as
remaining limitations.

### 12. Report

Use the format in [Required final report](#required-final-report) below.

## Required final report

Always output these nine sections, in order:

1. **Scope** — resolved target(s) and color goal.
2. **Palette and token inventory** — existing tokens found, one-off literals found (with
   file:line), semantic roles covered/missing, theme variants present or explicitly absent.
3. **Contrast computations** — every pairing checked, exact values used, computed ratio, threshold,
   pass/fail, before and after (per theme, when applicable) — never asserted without the computation
   shown or referenced.
4. **Files changed and why** — one line per file, mapped to the repair plan from workflow step 7.
5. **Palette and behavior preserved** — explicit confirmation that the established palette/visual
   direction, non-color markup, business logic, state, and routing were not altered.
6. **Validation performed** — exact commands run and their results (or "not run: <reason>").
7. **Before/after evidence** — screenshot paths/descriptions per theme, or "no screenshot tooling
   available" stated plainly (never fabricated).
8. **Universal review findings addressed** — baseline vs. re-review findings, what was fixed vs.
   deferred.
9. **Remaining limitations** — out-of-scope patterns noticed but not touched, unavailable tooling,
   deferred findings, or theme variants that couldn't be verified.

Never claim a screenshot, browser check, or MCP call happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.

## When the MCP is unavailable

If `get_design_rules`, `get_taste_profile`, or `review_implementation` cannot be reached, say so
explicitly in the report's relevant sections and fall back to: `AGENTS.md`'s visual quality
principles, direct inspection of the project's existing token system, and the contrast-ratio method
in [reference/contrast-formula.md](reference/contrast-formula.md), which does not depend on the MCP.
Do not skip the contrast computation step just because the MCP is down — it is a deterministic
calculation this skill performs itself.

## Known limitations

- This skill does not evaluate color in rasterized images/icons/illustrations for contrast; that is
  `/assets` territory. It only covers CSS/token-driven UI color.
- It does not run an automated browser-based contrast scanner; ratios are computed from source
  values, which requires literal colors to be resolvable from the source inspected (a value set only
  by an external, un-inspectable runtime source cannot be verified and must be reported as such).
- It does not evaluate colorblind-safe palette separation beyond what contrast ratios and existing
  `get_design_rules`/`get_taste_profile` guidance cover — flag a suspected colorblind-accessibility
  gap as a judgment-based observation, not a computed finding.
- It cannot verify a theme variant that exists in code but isn't reachable/toggleable in the current
  environment; note that as a limitation rather than skipping the token-level check.
