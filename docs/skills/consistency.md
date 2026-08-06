# `/consistency`

`/consistency` finds where Universal's design system has drifted — the same semantic thing (a
primary button, a card corner radius, a heading scale, a breakpoint) implemented with silently
divergent values in different components or routes — and reports it. It is a **conditional
mutation** skill: the default invocation is entirely read-only, and it only edits a file when the
user explicitly names which findings to repair.

Skill sources: [`.agents/skills/consistency/SKILL.md`](../../.agents/skills/consistency/SKILL.md)
and [`.claude/skills/consistency/SKILL.md`](../../.claude/skills/consistency/SKILL.md) (identical
body; the `.claude` copy adds `disable-model-invocation` and an `argument-hint`). Rubric detail
lives in
[`.agents/skills/consistency/reference/inventory-and-drift.md`](../../.agents/skills/consistency/reference/inventory-and-drift.md).

## What it does

1. Resolves a scope (a route, component, directory, or "the design system") and, optionally, a
   dimension focus.
2. Builds an **inventory of the values actually in use** across that scope, before judging
   anything — every distinct token, typography value, spacing value, radius, control style, state
   coverage, and responsive breakpoint, with every file/selector where each value appears.
3. Cross-references that inventory against Universal's design intelligence
   (`get_design_rules`, `get_taste_profile`) and the project's own shared tokens/primitives to
   understand which value, if any, the system already treats as canonical.
4. Classifies every divergence as **drift** (unintentional, same role, no signal of intent),
   **deliberate variation** (a real variant/theme/context, left untouched), **ambiguous** (asks
   the user rather than guessing), or **dead code** (deferred to `/cleanup`, not repaired here).
5. Reports drift findings with occurrence lists and a proposed convergence target. This is the
   terminal step of a default invocation — nothing is edited.
6. Only if the user names specific finding IDs to repair (in the same invocation or a follow-up),
   unifies exactly those findings' occurrences onto the established or confirmed value, one
   occurrence at a time, then runs checks and re-verifies behavior.

## When to use it vs. neighboring commands

| Command                                                      | Boundary against `/consistency`                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/audit`                                                     | `/audit` is a broad, read-only quality pass (hierarchy, accessibility, generic AI patterns, and more) over one target. `/consistency` is narrower and specifically comparative — it exists to compare instances of the same semantic thing against each other.                                                    |
| `/polish`                                                    | `/polish` bounded-refines a single target's craft. `/consistency`'s unit of work is a pattern compared _across_ multiple locations, not one surface.                                                                                                                                                              |
| `/cleanup`                                                   | `/cleanup` removes redundant, obsolete, or dead code. `/consistency` unifies patterns that are all still live and used, just diverged from each other. A candidate that turns out to be dead code gets deferred to `/cleanup`, not repaired here.                                                                 |
| `/art-direct`                                                | `/art-direct` proposes a new design direction or token set. `/consistency` never invents a new value — it only converges onto a value already established in the codebase or explicitly confirmed by the user.                                                                                                    |
| `/review-ui`                                                 | `/review-ui` synthesizes several independent design-critique perspectives into one ranked report. `/consistency` runs a single, mechanically-grounded comparison pass over concrete values, not subjective critique.                                                                                              |
| `/typography`, `/color`, `/layout`, `/states`, `/responsive` | Each of these deepens and improves one dimension on its own initiative once invoked (e.g. `/typography` may introduce a better scale). `/consistency` only flags cross-instance divergence within a dimension and repairs the specific selected instances — it does not redesign or upgrade the dimension itself. |

## Invocation examples

```text
/consistency
/consistency apps/studio/src/routes spacing
/consistency packages/ui Button controls
/consistency the design system radii
/consistency repair consistency-001 consistency-004
```

- No arguments: the skill asks which scope to inspect rather than guessing at the whole monorepo.
- A scope with no dimension: inspects all seven dimensions (tokens, typography, spacing, radii,
  controls, states, responsive) within that scope, sampling if the scope is large.
- A scope with a dimension: narrows the inventory and findings to that dimension only.
- `repair <finding-ids>`: switches the invocation from detect-and-report into a scoped repair for
  exactly the named finding IDs (from this run or a prior report). IDs that don't resolve stop the
  skill rather than being guessed at.

## Mutation behavior

- **Default invocation never touches a file.** No `Edit`, `Write`, `NotebookEdit`, formatter, or
  git mutation command runs unless the user has explicitly selected finding IDs to repair.
- **Repair is scoped to exactly the selected findings.** The skill will not silently fix "every
  other instance of this same pattern" it notices while repairing a selected finding — new
  divergence found mid-repair is reported for a later round, not folded in.
- **No repo-wide sweeps.** Even for one selected finding, every occurrence site is enumerated and
  edited individually and traceably; the skill will not run a blind global find-and-replace.
- **Behavior and public component APIs are preserved.** A repair may not change props, exported
  types, event handling, routing, state, or accessibility semantics. If unifying a value would
  require an API change, the skill stops and flags it instead of making the change.
- **Deliberate variation is never "fixed."** A divergence classified as an intentional
  variant/theme/context is reported as preserved, with the reasoning, and left alone.

## Scope and limitations

- Sampling on a large or unscoped inventory (e.g. "the whole design system") can miss a divergent
  instance outside the sampled set; the report says explicitly when coverage was sampled rather
  than exhaustive.
- Source-only classification cannot always resolve drift vs. deliberate variation with certainty —
  the skill uses an explicit "ambiguous, ask the user" path for exactly that reason instead of
  guessing.
- `review_implementation` (called during a repair's verification step) does not inspect screenshot
  pixels; visual before/after confirmation is only as strong as whatever capture tooling (e.g.
  `/browse`) is actually available in the environment.
- Only `get_design_rules`, `get_taste_profile`, and `review_implementation` are used from the
  Universal MCP; the stateful Phase 2 Art Director sequence is out of scope (that's `/art-direct`).

## Verification

The skill itself ships no executable code — it is a Markdown workflow definition plus a reference
rubric, so `pnpm typecheck` and `pnpm test` are not meaningful checks for changes to it. To validate
an edit to `.agents/skills/consistency/SKILL.md` or `.claude/skills/consistency/SKILL.md`:

- Run `pnpm format:check` and `pnpm lint` from the repository root — both cover Markdown formatting
  and repository-wide lint configuration and will catch structural issues.
- Confirm the `.agents` and `.claude` copies stay body-identical (frontmatter aside) — e.g.
  `diff <(sed '1,/^# \/consistency/d' .agents/skills/consistency/SKILL.md) <(sed '1,/^# \/consistency/d' .claude/skills/consistency/SKILL.md)`
  should produce no output.
- Walk a small real or fixture scope by hand through steps 1-4 (resolve scope, inventory, retrieve
  design intelligence, classify) and check that the resulting classifications match what a human
  would call drift vs. intentional variation for that scope, the same way `cleanup`'s
  `test-fixtures/VALIDATION.md` documents a fixture walk for `/cleanup`.
- Verify every relative link in this document and in `SKILL.md` resolves to a real file in the
  repository.
