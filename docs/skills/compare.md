# `/compare`

Read-only comparison of an existing Universal route or component against a supplied reference. Use
it when you already have something concrete to compare the implementation against — a screenshot, a
mockup image, a live reference URL, a `DESIGN.md`, or a previously selected Universal art direction
— and you want a prioritized, source-located report of where the implementation matches, drifts, or
outright breaks against that reference.

`/compare` never edits, formats, stages, commits, or pushes anything. It reports; other skills fix.

## When to use it vs. neighboring commands

- **vs. `/critique`** — `/critique` answers one focused design question with evidence and needs no
  external reference. `/compare` always requires a supplied, validated reference and produces a full
  prioritized difference report across every dimension the reference supports, not a single answer.
  Ask "is this hero's hierarchy clear?" with `/critique`; ask "does this page still match
  `DESIGN.md`?" with `/compare`.
- **vs. `/audit`** — `/audit` is an unreferenced evidence sweep against Universal's own design rules
  and taste policy; it needs no external reference and covers general craft broadly. `/compare` is
  always reference-driven — without a reference that actually validates, it stops rather than
  quietly falling back to an unreferenced sweep. If you don't have a reference, use `/audit`.
- **vs. `/polish`, `/layout`, `/color`, `/typography`** — these mutate. `/compare` never does. It
  names which of these should apply each fix and stops there; it does not queue or invoke them.
- **vs. `/cleanup`** — `/cleanup` removes redundant/obsolete/generic patterns from working code, with
  or without a reference. `/compare` only produces findings; it never removes anything.
- **vs. `/art-direct`** — `/art-direct` runs the full discovery-through-implementation Art Director
  workflow and can produce a new selected direction. `/compare` can _read_ an existing selected
  direction (via `get_art_direction_session`) as one of its five reference types, but it never
  starts, advances, or mutates an Art Director session.
- **vs. `/consistency`** — `/consistency` detects design-system drift _within_ the codebase itself
  (token/component inconsistency across files). `/compare` measures drift/defect against an
  _external_ reference supplied for this run, not internal cross-file consistency.
- **vs. `/review-ui`** — `/review-ui` synthesizes multiple internal critique perspectives without
  requiring an external reference. `/compare` is single-purpose: implementation vs. one (or more)
  supplied external references.

## Invocation examples

```text
/compare apps/studio/src/routes/Preview against artifacts/preview-mockup.png
/compare the pricing page against DESIGN.md
/compare frontend/src/pages/Home.tsx against https://example.com/reference-landing
/compare packages/ui Button against the selected direction, session <session-string>
/compare the installation page against screenshots/install-old.png and note anything that's just
  responsive adaptation rather than a real regression
```

If the target or the reference is missing or ambiguous, `/compare` asks before reading or fetching
anything — it does not guess at either.

## Reference types

| Reference type               | How it's validated                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screenshot / mockup image    | `Read` the file; valid only if it exists and actually renders as image content.                                                                     |
| Reference URL                | Rendered with whatever browsing tooling already exists in this environment (e.g. `/browse`); valid only if the page actually loaded and was viewed. |
| `DESIGN.md` / design doc     | `Read` the file; valid only if it exists and holds substantive, filled-in design content.                                                           |
| Selected Universal direction | `get_art_direction_session` with a session string the user supplies; valid only if the session validates at phase `direction-selected` or later.    |

If the resolved reference does not validate — a missing file, an inaccessible URL with no rendering
tooling available, an empty/templated `DESIGN.md`, or an invalid/unavailable session — `/compare`
stops the comparison entirely and reports why, instead of proceeding on assumption or memory. See
[`.agents/skills/compare/reference/reference-resolution.md`](../../.agents/skills/compare/reference/reference-resolution.md)
for the full validation rules.

## Mutation behavior

`/compare` may not change anything, ever, under any invocation. It has no bounded-mutation mode,
unlike `/accessibility` or `/consistency`. Every actionable finding names the mutating skill that
should apply it (`/polish`, `/layout`, `/color`, `/typography`, or — for changes too large for a
bounded fix — `/art-direct`) and stops there.

## Scope and limitations

- Universal has no automated pixel-diffing tool. `/compare` never reports a "pixel-perfect" or
  percentage-match figure; all visual comparison is perceptual (an image or render actually viewed),
  and the report says so explicitly per finding via the evidence type
  (`source` / `screenshot` / `rendered-url` / `design-doc` / `direction` / `mcp`).
- `review_implementation` (see
  [MCP tool reference](../MCP_REFERENCE.md#review_implementation)) is a deterministic source-level
  reviewer; it does not inspect image pixels either, and `/compare` never treats its findings as
  evidence that a visual comparison against the reference happened.
- A "selected direction" reference depends on the user supplying a valid Art Director session
  string in the same conversation. Universal does not persist Art Director sessions to disk, so
  `/compare` cannot discover or resume one on its own.
- URL references depend on browsing tooling already being available and wired up in the current
  environment (for example the `/browse` skill). `/compare` does not install or configure new
  capture infrastructure to satisfy a URL reference.
- Every reported difference is classified as `intentional-divergence`, `drift`, or `defect` — see
  [`.agents/skills/compare/reference/classification.md`](../../.agents/skills/compare/reference/classification.md)
  for the rubric. `/compare` never defaults an unconfirmed difference to `intentional-divergence`;
  absent concrete evidence it was deliberate, it is reported as `drift`.

## Verification

`/compare` ships no source-mutating fixtures — it never edits code, so there is nothing to validate
against a before/after diff the way `/cleanup`'s fixtures do. To validate changes to the skill
itself:

- Read the updated `SKILL.md` end to end and confirm every internal link
  (`reference/reference-resolution.md`, `reference/classification.md`, `reference/finding-schema.md`,
  and the `docs/MCP_REFERENCE.md#review_implementation` anchor) resolves to a real file/anchor.
- Confirm the `.agents/skills/compare/SKILL.md` and `.claude/skills/compare/SKILL.md` bodies stay
  byte-identical below the frontmatter, and that the three `reference/` files stay byte-identical
  between both trees.
- Confirm `.claude/skills/compare/SKILL.md`'s `allowed-tools` list excludes `Edit`, `Write`, and
  `NotebookEdit`.
- Walk each of the five reference types (screenshot, mockup, URL, `DESIGN.md`, selected direction)
  against the validation rules in `reference/reference-resolution.md` with both a passing and a
  failing example, and confirm the skill's documented behavior actually stops on the failing case
  rather than continuing into comparison.
- Run `pnpm format:check` and `pnpm lint` from the repository root; this is a markdown-only change,
  so `pnpm typecheck` and `pnpm test` are not meaningful and are not required.
