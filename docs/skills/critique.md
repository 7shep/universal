# `/critique`

Answer one focused design question with evidence, concisely, without editing anything.

## What it does

`/critique` takes a single, specific design question — optionally scoped to a route, component, or
directory — and answers it directly. It reads the actual current source, gathers whatever rendered
evidence (existing or freshly captured screenshots) and design context (design plan, creative brief,
selected direction, taste profile) is already available, and, when the question calls for it, calls
Universal's design-intelligence MCP tools (`get_design_rules`, `get_taste_profile`,
`review_implementation`). It never assesses from memory: if the evidence needed to answer
responsibly isn't available, it says so explicitly rather than guessing.

The output is a short, direct answer — a clear position, the evidence behind it, and a scoped
recommendation naming a follow-up command when one is warranted — not a comprehensive report.

## When to use it vs. neighboring commands

- **`/critique` vs. `/audit`** — `/audit` is a comprehensive, prioritized sweep across every design
  dimension (hierarchy, composition, typography, spacing, color, responsive, accessibility,
  interaction states, component vocabulary, generic patterns, direction alignment, implementation
  craft) for a scope. `/critique` answers exactly one named question and stops. Use `/audit` when
  the request is "what's wrong with this"; use `/critique` when it's "does this one thing work."
- **`/critique` vs. `/review-ui`** — `/review-ui` runs a coordinated panel of independent critics
  (typography, composition/hierarchy, accessibility, brand/direction, motion, responsive,
  component vocabulary, implementation craft) and synthesizes their findings into one ranked report.
  `/critique` runs no critic panel; it is a single focused pass.
- **`/critique` vs. `/compare`** — `/compare` performs a structured diff between the implementation
  and an explicit reference (a prior screenshot, a competitor, a design file). `/critique` may use a
  design direction or brief for context, but it isn't diffing against a reference artifact as its
  core operation.
- **`/critique` vs. `/polish` / `/cleanup`** — both of those mutate source. `/critique` never does;
  when its answer implies a fix, it names the smallest applicable follow-up command and stops there.
- **`/critique` vs. `/art-direct`** — `/art-direct` runs the full discovery-through-implementation
  workflow, including the stateful Phase 2 Art Director MCP sequence. `/critique` never starts or
  resumes that sequence; it only reads a direction if one is already established.

## Invocation examples

```text
/critique Is the hero CTA prominent enough on the landing page?
/critique apps/studio/src/routes/Preview — does the empty state match the rest of the app's tone?
/critique Does packages/ui Button's disabled state meet contrast requirements?
/critique Is the spacing between the pricing cards consistent with the rest of the page?
```

If `$ARGUMENTS` is empty, or asks for a general review rather than one specific question, `/critique`
asks for a single focused question instead of guessing, or points to `/audit` or `/review-ui` for
broader coverage.

## Mutation behavior

`/critique` is strictly read-only. It never calls `Edit`, `Write`, `NotebookEdit`, a formatter,
`git add`, `git commit`, or `git push` — not even for a one-line fix it is confident about. When its
answer implies a change, it names the change and the command that would make it (`/polish`,
`/cleanup`, `/art-direct`, or a broader `/audit`/`/review-ui` pass), and stops there. Every run's
final report ends with an explicit confirmation that no source files were modified.

## Scope and limitations

- Answers **one** question per invocation. Multi-part or repository-wide requests are redirected to
  `/audit` or `/review-ui` rather than silently expanded.
- Only calls MCP tools that exist in
  [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md): `get_design_rules`, `get_taste_profile`, and
  `review_implementation` — and only the ones the specific question actually needs. It never starts
  or resumes the stateful Phase 2 Art Director session.
- Does not fabricate screenshots, MCP responses, or a design direction that doesn't exist. When a
  relevant evidence type (screenshot tooling, an established direction, MCP connectivity) is
  unavailable, the report states that plainly as an evidence gap rather than folding it silently
  into the answer.
- Reads only the source implicated by the specific question — not the whole surface it lives in —
  to keep the pass focused and cheap.
- Confidence is stated in prose and tied to evidence strength; a low-confidence "cannot answer
  responsibly without X" is a valid and expected outcome, not a failure of the skill.

## Verification

`/critique` ships no test fixtures — the skill's output is a natural-language answer to an
open-ended question, not a deterministic finding set, so there is no fixture harness to walk (unlike
`cleanup`'s `test-fixtures/VALIDATION.md`).

To validate changes to this skill itself:

- Re-read [`.agents/skills/critique/SKILL.md`](../../.agents/skills/critique/SKILL.md) and
  [`.claude/skills/critique/SKILL.md`](../../.claude/skills/critique/SKILL.md) and confirm their
  bodies stay byte-identical apart from frontmatter (`disable-model-invocation`, `argument-hint`,
  and `allowed-tools` differ intentionally; `allowed-tools` must keep excluding `Edit`, `Write`, and
  `NotebookEdit`).
- Confirm [`.agents/skills/critique/reference/answer-format.md`](../../.agents/skills/critique/reference/answer-format.md)
  and [`.claude/skills/critique/reference/answer-format.md`](../../.claude/skills/critique/reference/answer-format.md)
  stay byte-identical.
- Dry-run the workflow against a real question and scope in this repository (for example, one of
  the invocation examples above) and check the report against the seven sections in
  [`SKILL.md`](../../.agents/skills/critique/SKILL.md#required-final-output): question and scope,
  evidence inspected, direct answer, evidence-backed reasoning, recommendation (if any), confidence
  and evidence gaps, and the no-mutation confirmation.
- Confirm every MCP tool name referenced (`get_design_rules`, `get_taste_profile`,
  `review_implementation`) still appears in [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
- Run `pnpm format:check` and `pnpm lint` from the repository root after any edit to these files.
