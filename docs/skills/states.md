# `/states`

Finds and completes missing interaction and application states — hover, focus-visible, active,
selected, disabled, loading, empty, error, success, and skeleton — for an existing React interface,
and keeps that feedback accessible and consistent with the project's established tokens and
primitives.

The full skill definition lives at [`.agents/skills/states/SKILL.md`](../../.agents/skills/states/SKILL.md)
(and the identical body at [`.claude/skills/states/SKILL.md`](../../.claude/skills/states/SKILL.md)).
This page is contributor-facing context: when to reach for it, what it changes, and how to validate
it. Read the SKILL.md before changing the skill's workflow or completion gates.

## What it does

`/states` audits a resolved scope (a page, route, component, or directory) against a fixed
ten-state taxonomy — hover, focus-visible, active, selected, disabled, loading, empty, error,
success, skeleton — using the
[state-coverage matrix](../../.agents/skills/states/reference/state-coverage-matrix.md) to decide
which states a given component type actually needs. It then wires any missing required state to the
component's real data or interaction logic (an existing async call's pending/settled/error result,
real form validity, real selection state, real collection length), applies accessible semantics per
[accessible-state-semantics.md](../../.agents/skills/states/reference/accessible-state-semantics.md),
and reuses existing tokens/primitives for the visual treatment.

It calls the Universal MCP tools `get_design_rules`, `get_taste_profile`, and
`review_implementation` (see [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md)) the same way `/polish`
and `/cleanup` do: as a deterministic backbone for guidance and a before/after quality gate, with
graceful degradation (explicitly stated) when the MCP is not connected.

## When to use it vs. neighboring commands

- **vs. `/audit`** — `/audit` is read-only and covers the whole design-quality surface; `/states` is
  the narrow mutation command specifically for the ten-state interaction/application taxonomy. Use
  `/audit` first if you want a report before deciding what to fix; use `/states` directly when you
  already know you want state coverage completed.
- **vs. `/polish`** — `/polish` is a broader bounded-refinement pass (hierarchy, typography,
  spacing, general a11y finish) that happens to list interaction states as one of eleven priorities.
  `/states` is deeper on that one dimension: it classifies every component against the coverage
  matrix and enforces the `aria-disabled`/`disabled`/`aria-busy` distinctions in detail. Prefer
  `/states` when the request is specifically about missing/incomplete states; prefer `/polish` for a
  general craft pass where states are one of several things to check.
- **vs. `/cleanup`** — `/cleanup` removes redundant or inconsistent existing patterns (e.g. two
  different disabled treatments that should collapse into one). `/states` adds coverage that's
  outright missing. A surface can need both: run `/cleanup` to consolidate, `/states` to fill gaps.
- **vs. `/art-direct`** — `/art-direct` orchestrates net-new discovery through implementation for a
  new or substantially redesigned surface. `/states` only touches an already-implemented surface's
  state coverage; it does not run discovery or select a new direction.
- **vs. `/review-ui`** — `/review-ui` is a read-only, multi-perspective synthesis report (one of its
  perspectives can be interaction states). `/states` is the mutation step you'd run after such a
  report flags missing state coverage.
- **vs. `/accessibility`** — `/accessibility` is the general accessibility audit/repair command
  (contrast, headings, landmarks, broader ARIA correctness). `/states` only owns the accessibility
  semantics intrinsic to the ten states themselves (`aria-busy`, `aria-disabled` vs. `disabled`,
  `aria-selected`/`aria-checked`/`aria-current`, `aria-invalid`). For an accessibility problem
  unrelated to state (e.g. a missing landmark region), use `/accessibility` instead.
- **vs. `/animate`** — `/animate` owns transition and motion design. `/states` may add a state's
  minimal visual treatment (e.g. a disabled-opacity token) but leaves transition timing/easing and
  scroll effects to `/animate`.
- **vs. `/consistency`** — `/consistency` is the general design-system-drift detector across all
  design dimensions. `/states` is scoped specifically to the state taxonomy in its coverage matrix.

## Invocation examples

```text
/states packages/ui Button
/states Tighten the settings form's error and success states
/states apps/studio sidebar loading and empty states
/states examples/demo-site/src/components/DataTable skeleton and empty coverage
```

If `$ARGUMENTS` is empty and the active conversation doesn't unambiguously identify one target, the
skill asks which scope to work on rather than guessing across the monorepo.

## Mutation behavior

`/states` mutates source, but only:

- within the resolved scope from step 1 of its workflow;
- for states that the coverage matrix marks required or conditionally required **and** whose
  precondition genuinely exists in that component's real data/logic layer;
- by wiring to a real signal (an actual async result, actual validity, actual selection, actual
  collection length) — never a decorative constant, timer, or hard-coded boolean;
- using accessible semantics from
  [accessible-state-semantics.md](../../.agents/skills/states/reference/accessible-state-semantics.md);
- by reusing existing tokens/primitives for the visual treatment, introducing a new primitive only
  when nothing existing covers the pattern (and saying so explicitly in the report).

It will not: invent a state a component structurally cannot reach, redesign layout/hierarchy/
information architecture, change business logic or public APIs, add motion/transition design, or
run a general accessibility sweep beyond the ten-state semantics above. Mutation only happens on an
explicit `/states` invocation — it is never triggered as a side effect of another skill.

## Scope and limitations

- Coverage decisions depend on the fixed matrix in
  [reference/state-coverage-matrix.md](../../.agents/skills/states/reference/state-coverage-matrix.md).
  A component that doesn't map cleanly onto an existing row requires a judgment call, which the
  skill must state explicitly rather than silently forcing a fit.
- Without Universal MCP connectivity, `get_design_rules`/`get_taste_profile`/`review_implementation`
  guidance is unavailable; the skill falls back to `AGENTS.md`'s visual quality principles plus the
  matrix alone, and must say so.
- Without browser/screenshot tooling in the environment, added states are verified by source
  inspection (correct wiring, correct ARIA attributes, correct token usage) rather than by visually
  exercising hover/focus/loading/etc. — the skill states this plainly instead of fabricating visual
  evidence.
- `/states` does not add interactivity to purely presentational components; it reports those as not
  applicable.

## Verification

A `/states` run itself reports, in its required final output:

1. Scope resolved.
2. Coverage assessment per component (matrix row, present/missing/out-of-scope states).
3. Files changed and the real signal each newly-wired state uses.
4. Accessibility semantics applied (`disabled` vs. `aria-disabled`, `aria-busy` scope).
5. Validation commands run and their exact results.
6. State evidence (interaction-state screenshots/descriptions, or explicit absence of tooling).
7. Universal `review_implementation` findings addressed vs. deferred.
8. Remaining limitations.

### Validating changes to the skill itself

This skill ships no runnable test fixtures — its `reference/` material (the coverage matrix and the
accessibility-semantics guide) is prose guidance, not executable rules, so there is no fixture
harness to run the way `/cleanup` has
[`test-fixtures/VALIDATION.md`](../../.agents/skills/cleanup/test-fixtures/VALIDATION.md). To
validate an edit to `.agents/skills/states/SKILL.md` or its `reference/` files:

1. Confirm the `.agents/skills/states/` and `.claude/skills/states/` bodies are still byte-identical
   apart from frontmatter (`disable-model-invocation`, `argument-hint`) — a plain diff of the two
   `SKILL.md` files after stripping the frontmatter block should show no differences.
2. Confirm every relative link inside the changed file resolves to a real file in this repository.
3. Confirm every MCP tool name referenced (`get_design_rules`, `get_taste_profile`,
   `review_implementation`) still appears in [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
4. Walk at least one example from each row of the coverage matrix mentally against a real component
   in the repo (e.g. `packages/ui`) to confirm the required/conditional classification still makes
   sense before shipping a matrix change.
5. Run `pnpm format:check` and `pnpm lint` from the repository root; these are markdown/documentation
   changes, so `pnpm typecheck`/`pnpm test` are not meaningful unless the change also touches
   TypeScript source.
