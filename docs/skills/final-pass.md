# `/final-pass`

`/final-pass` is Universal's release-readiness orchestrator. It runs the last review pass before an
interface ships: it delegates each quality dimension to the command that owns it, applies bounded
fixes within one shared budget across the whole run, runs the repository's real checks, and emits a
release-readiness verdict (`ready`, `ready-with-caveats`, or `not-ready`) with every blocking item
enumerated.

Source: [`.agents/skills/final-pass/SKILL.md`](../../.agents/skills/final-pass/SKILL.md) (agent
tree) and [`.claude/skills/final-pass/SKILL.md`](../../.claude/skills/final-pass/SKILL.md) (Claude
Code slash command). Both trees carry identical bodies and share
[`reference/fix-budget.md`](../../.agents/skills/final-pass/reference/fix-budget.md), which defines
the exact fix-budget numbers, delegate-unavailability handling, and the readiness-verdict rubric.

## What it does

`/final-pass` does not itself judge typography, accessibility, or performance — it is purely an
orchestration layer. In order, it:

1. Resolves scope (target, direction/reference, phases, budget, dry-run) and confirms which of its
   eight delegate commands are actually present in this repository.
2. Runs `/audit` for a read-only evidence baseline.
3. Runs `/responsive`, `/accessibility` (high-severity repairs only), `/states`, `/performance`, and
   `/consistency` (selected blocking items only) — each a bounded, mutation-capable delegate whose
   reported changes are counted against one shared fix budget for the whole run.
4. Runs `/compare` (read-only) against the selected design direction or reference, when one exists.
5. Runs `/polish` last, using whatever budget remains, to reconcile leftover visual-craft findings.
6. Runs the repository's real checks — `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build` — and reports their actual output.
7. Re-verifies the files it touched with a targeted re-pass (typically a scoped `/audit` and, when
   relevant, a scoped `/compare`).
8. Emits the verdict with blocking items enumerated.

## When to use it vs. neighboring commands

| Situation                                                                                                                                                           | Use                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| You want one command to run the whole release-readiness pass and get a ship/no-ship verdict                                                                         | `/final-pass`                                             |
| You want a single evidence-led, read-only audit of one surface, with no fixes                                                                                       | [`/audit`](../../.agents/skills/audit/SKILL.md)           |
| You want a single bounded visual-craft pass (hierarchy, typography, spacing) with no other dimensions                                                               | [`/polish`](../../.agents/skills/polish/SKILL.md)         |
| You want removal of redundant/generic/obsolete UI patterns, not a readiness verdict                                                                                 | `/cleanup`                                                |
| You are starting a new build or a substantial redesign, not reviewing an existing one                                                                               | [`/art-direct`](../../.agents/skills/art-direct/SKILL.md) |
| You want several independent critique perspectives synthesized into one ranked, read-only report                                                                    | [`/review-ui`](../../.agents/skills/review-ui/SKILL.md)   |
| You want only one dimension fixed (just responsiveness, just accessibility, just states, just performance, just consistency, just a comparison against a reference) | Call that command directly instead of `/final-pass`       |

`/final-pass` is the right choice when you need the combined view — every dimension checked, real
checks run, and one verdict — not when you already know which single dimension needs attention.
Calling the narrower command directly is cheaper and keeps the fix budget entirely on that one
concern.

## Invocation examples

```text
/final-pass apps/studio/src/routes/Preview
/final-pass frontend/src/pages/Install against the approved creative brief
/final-pass packages/ui/src/components/PricingTable phases: responsive, accessibility, states
/final-pass examples/demo-site/src/routes/Home budget: 20 files / 500 lines
/final-pass apps/studio/src/routes/Preview dry-run
```

- The first performs the full eight-phase pass with the default fix budget.
- The second adds a reference for the `/compare` phase.
- The third restricts the run to a subset of phases (all others are reported as "excluded by
  request," not "unavailable").
- The fourth raises the default fix budget for a larger, user-authorized run.
- The fifth reports what `/final-pass` would do without applying any fix (every mutation-capable
  delegate is asked for findings only).

## Mutation behavior

`/final-pass` mutates source, but only through its delegated commands, and only up to the shared fix
budget defined in
[`reference/fix-budget.md`](../../.agents/skills/final-pass/reference/fix-budget.md):

- **May change**: whatever `/responsive`, `/accessibility` (high-severity items only),
  `/states`, `/performance`, `/consistency` (selected blocking items only), and `/polish` change
  within their own documented boundaries, up to a combined default cap of 10 files and roughly 250
  changed lines (formatter-only whitespace excluded from the line count) across the entire run.
- **May not change**: business logic, routes, public component APIs, the selected design direction,
  information architecture, or anything that would require a new dependency — these are always
  escalated back to the user, never applied, regardless of remaining budget.
- **`/audit` and `/compare` phases are read-only** — no file changes originate from either.
- A **dry run** (`$ARGUMENTS` names one) disables every mutation: every delegate is asked to report
  only, and `/final-pass` produces the same ten-section report with an empty "files changed" list.
- If reaching a `ready` verdict would require exceeding the budget or crossing into the excluded
  categories above, `/final-pass` does not do it — it reports `ready-with-caveats` or `not-ready`
  and lists the deferred work in the "Escalations and deferred items" report section instead.

## Scope and limitations

- `/final-pass` depends on eight other Phase 5 commands (`/audit`, `/responsive`, `/accessibility`,
  `/states`, `/performance`, `/consistency`, `/compare`, `/polish`). Until all of them are
  implemented and merged, expect the "Delegate availability" section of its report to list some as
  unavailable — see
  [`reference/fix-budget.md#delegate-availability`](../../.agents/skills/final-pass/reference/fix-budget.md)
  for exactly what `/final-pass` does in that case. It never fabricates a missing delegate's output.
- It does not call Universal MCP tools directly except as the documented read-only fallback when
  `/audit` or `/compare` is unavailable — normally, all MCP-backed findings come from the delegated
  commands.
- It does not stage, commit, push, or open a pull request unless explicitly asked.
- Its fix-budget accounting is a heuristic sum of each delegate's self-reported files/lines, not an
  exact computed diff size.

## Verification

`/final-pass` itself only produces Markdown (this doc) plus the two `SKILL.md` trees and their
shared reference file — there is no application code to unit test. To validate a change to the
skill's own instructions:

1. Re-read [`.agents/skills/final-pass/SKILL.md`](../../.agents/skills/final-pass/SKILL.md) and
   [`.claude/skills/final-pass/SKILL.md`](../../.claude/skills/final-pass/SKILL.md) side by side and
   confirm their bodies (everything after the frontmatter) are still byte-identical, and that
   [`reference/fix-budget.md`](../../.agents/skills/final-pass/reference/fix-budget.md) is
   byte-identical in both trees.
2. Confirm every relative link in both `SKILL.md` files and in this document resolves to a real file
   in the repository.
3. Confirm every Universal MCP tool name referenced (`get_design_rules`, `get_taste_profile`,
   `review_implementation`) still appears in
   [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
4. Run this repository's standard checks — `pnpm format:check` and `pnpm lint` — since the skill
   trees and this document are tracked, formatted files.
5. Because `/final-pass` only orchestrates other commands, there is no standalone runtime behavior
   to execute in isolation; validate a live run only once its eight delegate commands are present,
   by invoking `/final-pass` against a real scoped target and checking that the report's phase list,
   fix-budget accounting, and verdict match what actually happened.
