---
name: cleanup
description: Use when explicitly asked to clean up an existing route, component, directory, or CSS/design-token surface in Universal — removing duplicated tokens, conflicting or obsolete CSS, redundant wrappers, cards-inside-cards, inconsistent radii/spacing/shadows/typography, one-off styles that should use an established primitive, repeated component variants, stale classes/selectors, or generic AI UI treatments, all without changing intended behavior, accessibility, or public APIs.
---

# /cleanup

Implementation-cleanup workflow for existing Universal UI. It removes redundant, inconsistent,
obsolete, or generic patterns from already-working code. It is **not** a redesign command and
**not** a general dead-code sweep — every removal needs concrete evidence, and behavior must be
unchanged when the mutation is done.

`$ARGUMENTS` names the scope: a route, component, directory, or cleanup focus (for example
`apps/studio/src/routes/Preview`, `packages/ui Button variants`, or `design tokens in
apps/studio/src/styles`). If empty, ask which scope to clean up rather than guessing at the whole
repository.

## Non-negotiables

- Preserve functionality, accessibility, public APIs, state, routes, and any unrelated local
  changes already in the working tree.
- Never delete code because it merely _looks_ unused. Verify imports, re-exports, dynamic/runtime
  lookups (string-based component or route lookups, generated manifests, template files under
  `packages/local-runtime/template`), tests, fixtures, and config references first. If verification
  is inconclusive, classify the item **uncertain** and leave it.
- Never use destructive Git commands (`reset --hard`, `checkout -- <path>` on files you didn't
  touch, `clean -fd`, force-push, history rewrites).
- Do not add a dependency to solve a cosmetic problem — reuse or extend an existing primitive.
- Do not stage, commit, push, or open a PR unless the invoking user explicitly asks for it.
- Do not redesign the page, change copy or information architecture, flatten meaningful semantic
  structure, remove accessibility attributes, or invent a new design system while cleaning up.
- Never claim a visual check happened if it did not.

## Workflow

### 1. Resolve scope

Interpret `$ARGUMENTS` as a route, component, directory, or named cleanup focus (e.g. "duplicated
radii", "card nesting"). If it's ambiguous or missing, ask before touching files.

### 2. Inspect before touching anything

Read the scoped source, its co-located styles, its tests, and every call/import site (`Grep` for
the component/class/token name across the repo, not just the scoped directory). Identify:

- existing reusable primitives and tokens the scope should already be using (`packages/ui`, shared
  token files, established variant patterns);
- current behavior, state, routes, and accessibility semantics that must survive unchanged;
- unrelated local changes already present — leave those alone.

### 3. Find candidates with evidence

Look for the required cleanup categories, each backed by a concrete pointer (file:line, selector,
or duplicate pair) — not a vibe:

- duplicated visual tokens (same color/spacing/radius value hard-coded in multiple places instead
  of the shared token);
- conflicting or obsolete CSS declarations (dead overrides, rules a later selector always beats,
  leftover from a prior visual direction);
- redundant wrappers (a `<div>`/styled wrapper doing nothing a parent or primitive doesn't already
  do);
- unnecessary cards-inside-cards structures (nested bordered/shadowed containers with no
  distinct semantic grouping);
- inconsistent radii, spacing, shadows, and typography (one-off values that drift from the
  established scale for no stated reason);
- one-off styles that duplicate an established primitive's job;
- repeated component variants that should collapse into one parameterized variant;
- stale classes and selectors — only after confirming zero references (see Non-negotiables);
- generic AI UI treatments not supported by the selected direction (unearned gradients, decorative
  pills, generic three-column grids) — cross-check against `get_design_rules` before flagging;
- accidental responsiveness regressions (fixed widths, missing wrap/overflow handling introduced by
  drift, not by intent);
- accessibility regressions caused by presentation markup (e.g. a `<div>` doing a button's job, lost
  focus order from wrapper nesting).

### 4. Classify every candidate

| Class              | Meaning                                                                                                                        | Action                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Safe mechanical    | Pure deduplication/consolidation with no behavior or markup-semantics change (e.g. two identical spacing literals → one token) | Apply directly                                                                     |
| Behavior-sensitive | Touches markup structure, state, event handling, or a11y tree, even if visually inert                                          | Apply carefully, re-verify behavior and a11y after                                 |
| Design-judgment    | Requires a taste call (e.g. "is this card nesting meaningful or accidental?")                                                  | Check against `get_design_rules` / the plan before applying; if still unclear, ask |
| Uncertain          | Can't confirm zero references, unclear intent, or evidence is circumstantial                                                   | Do not change; report it as retained                                               |

### 5. Retrieve design guidance for design-judgment items

Call `get_design_rules` (category matching the scope — `website`, `typography`, `composition`,
`imagery`, `motion`, or `general`) before deciding a design-judgment candidate is actually
inconsistent or generic. Prefer the project's existing selected direction/plan over inventing a new
rule.

### 6. Present the plan before mutating

Before any behavior-sensitive or design-judgment change, show a concise plan: candidate, class,
evidence, proposed fix. Get past this checkpoint before making changes that aren't purely
mechanical. Skip this pause only for a small number of clearly safe-mechanical fixes.

### 7. Make small, traceable changes

One concern per edit where practical. Prefer consolidating onto an existing token/primitive over
introducing a new one. Keep diffs scoped to the resolved scope plus the specific reference sites
being updated.

### 8. Verify imports and usages after every removal

Re-run the reference search for anything deleted or renamed (class, token, component, export). A
removal that breaks a reference is a bug, not a cleanup.

### 9. Run the repository's checks

From the repository root (or filtered to the touched workspace for a narrow change):

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

```bash
# narrower, faster iteration when the change is confined to one workspace
pnpm --filter <workspace> lint
pnpm --filter <workspace> typecheck
pnpm --filter <workspace> test
pnpm --filter <workspace> build
```

Run whichever subset is proportional to the size of the change; run the full root gate before
calling behavior-sensitive work done.

### 10. Inspect affected responsive UI when visual structure changed

If markup or layout structure moved, check the affected UI at desktop and mobile widths (per
`AGENTS.md`'s completion gate and `CONTRIBUTING.md`'s UI evidence expectations). Only report a
visual check as performed if it actually ran.

### 11. Re-run implementation review for materially changed React/CSS

For design-facing changes to React/CSS, call `review_implementation` with the final changed source
files (and visual evidence if it was captured) to confirm no new taste or composition regressions
were introduced by the cleanup itself. This is a guardrail on the cleanup, not a redesign pass —
address only findings caused by this change.

### 12. Report

Use the structure in [Final report](#final-report) below.

## Final report

1. **Scope inspected** — resolved scope and what was read (source, styles, tests, call sites).
2. **Cleanup candidates and classifications** — each candidate, its class, and its evidence.
3. **Changes made** — concrete diff summary per change, mapped back to its candidate.
4. **Behavior and semantics preserved** — what was verified unchanged (functionality, a11y, public
   API, routes, state) and how.
5. **Items intentionally retained and why** — every "uncertain" candidate and why it wasn't touched.
6. **Validation performed** — exact commands run and their results; note anything skipped and why.
7. **Visual/MCP review results** — `get_design_rules`/`review_implementation` calls made, findings,
   and what was fixed vs. left; state plainly if no visual check occurred.
8. **Remaining risks or uncertainty** — anything a human should double check.

## Common mistakes

- Deleting a class/export because a text search inside the scoped directory found no hits, without
  checking the rest of the repo, generated manifests, or the `packages/local-runtime/template`
  fixed template.
- Treating "design-judgment" candidates as mechanical and applying them without checking
  `get_design_rules` or the selected direction first.
- Skipping `review_implementation` on a materially changed React/CSS file because the change felt
  small.
- Reporting a visual check that didn't happen, or a validation command that wasn't actually run.
- Widening scope into a redesign because a cleaner pattern was tempting — stop at removing
  inconsistency, don't introduce a new system.
