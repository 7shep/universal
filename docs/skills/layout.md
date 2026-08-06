# `/layout`

`/layout` is a repository-local Universal skill that improves the structural presentation of an
already-implemented UI surface: composition, alignment, whitespace, section pacing, density, and
visual hierarchy. It mutates source, but only when explicitly invoked.

Definitions live in [`.agents/skills/layout/SKILL.md`](../../.agents/skills/layout/SKILL.md) and
[`.claude/skills/layout/SKILL.md`](../../.claude/skills/layout/SKILL.md) (identical body; the
`.claude` copy adds `disable-model-invocation: true` and an `argument-hint`). Read the `SKILL.md`
before changing this command's workflow or completion gates.

## What it does

Given a target (page, route, component, or directory) and an optional layout focus, `/layout`:

1. Resolves scope from `$ARGUMENTS` and states it back before touching anything.
2. Inspects the target's React/CSS source, related shared components, and the existing spacing/grid
   system.
3. Captures baseline desktop/mobile screenshots when browser tooling is available.
4. Calls the Universal MCP tool `get_design_rules` with `category: "composition"` (and
   `get_taste_profile` when connected) for binding composition guidance.
5. Calls `review_implementation` for a deterministic baseline before editing.
6. Produces a proposed composition-change set — target, issue, intended change, DOM-order impact,
   preserved behavior — before mutating anything.
7. Implements the smallest structural change that satisfies each approved item, reusing existing
   spacing/grid tokens and primitives.
8. Runs `pnpm format:check`, `pnpm typecheck`, tests, and build for the changed workspace.
9. Re-captures screenshots and re-runs `review_implementation`, comparing against the baseline.
10. Explicitly verifies DOM order (reading/heading/landmark/tab/form-field order) was preserved.
11. Reports using the nine-section structure defined in `SKILL.md`.

## When to use it vs. neighboring commands

`/layout` sits between `/polish` and `/art-direct` in scope, and is careful not to duplicate
`/responsive`, `/typography`, `/color`, `/consistency`, or `/audit`/`/review-ui`.

| Situation                                                                                              | Use instead                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| A single spacing/alignment value needs a small nudge within the current structure                      | [`/polish`](../../.agents/skills/polish/SKILL.md)       |
| The request needs a new visual thesis, new typography/color/motion systems, or brand-new page sections | `/art-direct` (planned)                                 |
| The typographic scale/family system itself needs to change                                             | `/typography` (planned)                                 |
| The color palette, semantic roles, or tokens need to change                                            | `/color` (planned)                                      |
| A specific viewport has overflow, clipping, or broken stacking unrelated to a composition change       | `/responsive` (planned)                                 |
| You need a system-wide drift report before deciding what to fix                                        | `/consistency` (planned)                                |
| You only want a prioritized, read-only finding list, not a mutation                                    | [`/audit`](../../.agents/skills/audit/SKILL.md)         |
| You want several independent critique perspectives synthesized, read-only                              | [`/review-ui`](../../.agents/skills/review-ui/SKILL.md) |
| Redundant/obsolete/generic markup or CSS should be removed without redesigning                         | [`/cleanup`](../../.agents/skills/cleanup/SKILL.md)     |

`/layout` may touch responsive CSS when a composition change requires it (e.g. a rebalanced grid
needs new column spans at a breakpoint), but it must not perform broader breakpoint repair beyond
what that composition change requires — that work belongs to `/responsive`. Any unrelated breakpoint
bugs discovered along the way are reported as a limitation, not fixed silently.

## Invocation examples

```text
/layout Rebalance section pacing on the marketing homepage — every section reads at the same density.
/layout apps/studio/src/routes/Preview alignment and whitespace around the toolbar.
/layout frontend/src/components/Hero density: it feels cramped on desktop, sparse on mobile.
/layout Tighten visual hierarchy on the pricing page so the primary plan reads first.
```

If `$ARGUMENTS` is empty and the active conversation doesn't unambiguously identify one page, route,
or component, `/layout` asks which target before mutating anything.

## Mutation behavior

`/layout` mutates source **only on an explicit `/layout` invocation** — it never triggers its own
mutation steps proactively.

It may change:

- section arrangement, spacing, and grid/column structure;
- alignment and grid discipline within a section;
- section pacing/rhythm across a page (varying density instead of uniform repetition);
- visual hierarchy (heading/content emphasis achieved through layout, not typography-system changes);
- CSS-level reflow (`order`, `grid-template-areas`, source-order-preserving layout) to achieve a
  visual rearrangement while keeping DOM order intact.

It must **not** change:

- business logic, state, routes, APIs, or data flow;
- reading order, heading order, landmark order, tab order, or form-field order in the DOM (visual
  reflow must be CSS-only unless the request is explicitly about fixing a broken order);
- the established art direction's typography system, color system, or motion language;
- breakpoint behavior beyond what the composition change itself requires;
- accessibility semantics.

## Scope and limitations

- `/layout` has no automated DOM-order-diff tool; step 11 of the workflow is a manual check against
  rendered markup or JSX source structure, not a guaranteed catch of every reordering regression.
- Section-pacing and density judgments are taste calls informed by `get_design_rules` /
  `get_taste_profile`, not a deterministic metric. When the right call is ambiguous, `/layout` asks
  rather than asserting certainty.
- If the Universal MCP server is unavailable, `/layout` falls back to `AGENTS.md`'s general visual
  quality principles, which are less specific than the `composition` category's
  `compositionPrinciples` and `antiPatterns` — this is stated explicitly in the report rather than
  silently substituted.
- `/layout` does not generate new imagery, new components, or new page sections; that is
  `/art-direct` or `/assets` territory.

## Verification

A `/layout` run itself validates with:

```bash
pnpm format:check
pnpm typecheck
pnpm --filter <workspace> test   # or pnpm test for a broad change
pnpm --filter <workspace> build  # or the workspace-scoped build
```

plus the Universal MCP calls `get_design_rules` (`category: "composition"`), optionally
`get_taste_profile`, and `review_implementation` (baseline and post-change).

To validate a change to the `/layout` skill definition itself (this file, or either `SKILL.md`):

- Confirm the two `SKILL.md` bodies stay byte-identical outside frontmatter (`diff` them after
  stripping the frontmatter block).
- Confirm every MCP tool name referenced (`get_design_rules`, `get_taste_profile`,
  `review_implementation`) still appears in [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
- Confirm every relative link in this document resolves to a real file in the repository.
- Walk a representative request through the workflow by hand (a page with uniform section pacing,
  or a component with a broken content-to-container ratio) and confirm each numbered step in
  `SKILL.md` produces the artifact it claims to (resolved scope statement, proposed change set,
  DOM-order confirmation, final report with all nine sections).
