# `/document`

Creates or updates a Google Stitch-compatible `DESIGN.md` that documents a project's actual,
currently-implemented design system: typography, color, spacing, components, layout, motion,
responsive behavior, and implementation guidance. Every value in the document is derived from real
source (tokens, stylesheets, components) — never invented — and unknown values are marked
explicitly rather than guessed.

Skill source: [`.agents/skills/document/SKILL.md`](../../.agents/skills/document/SKILL.md) and
[`.claude/skills/document/SKILL.md`](../../.claude/skills/document/SKILL.md) (identical body,
different frontmatter). Section template and worked example:
[`.agents/skills/document/reference/design-md-template.md`](../../.agents/skills/document/reference/design-md-template.md).

## What it does

1. Resolves the target project/app/route and the `DESIGN.md` path (default: `DESIGN.md` at the
   project root).
2. Reads any existing `DESIGN.md` in full, identifying which content is machine-owned (wrapped in
   `<!-- GENERATED:<section-id> -->` / `<!-- /GENERATED:<section-id> --> ` comment pairs) versus
   human-authored (everything else).
3. Inspects the real implementation — CSS custom properties, token/theme config files, shared UI
   primitives, layout/grid conventions, transitions/animations, media queries, and
   `prefers-reduced-motion` handling — citing the file (and selector/line where practical) behind
   every documented value.
4. Calls the `get_design_rules` MCP tool for policy grounding, and `get_selected_direction` only
   when a live Art Director session already sits at exactly the right phase in the current
   conversation (typically produced earlier by `/art-direct`) or a Design Plan v2/selected
   direction is already committed to the repo — it never originates or advances a new Art Director
   session itself.
5. Writes the eleven-section template (overview, typography, color, spacing, components, layout,
   motion, responsive, reduced motion, implementation guidance, open questions), replacing only the
   `GENERATED:*` regions of an existing file and leaving everything else untouched.
6. Verifies the written file against the template, spot-checks values against source, and confirms
   no application file was modified.

## When to use it vs. neighboring commands

- **vs. `/audit`** — `/audit` produces a read-only, evidence-led critique of a UI surface (what's
  wrong and why); `/document` produces a factual reference document of what the system currently
  is, with no judgment about whether it's good. Run `/audit` to find problems; run `/document` to
  record the system so future work (human or agent) doesn't have to re-derive it.
- **vs. `/polish`, `/cleanup`, `/color`, `/typography`, `/layout`** — those commands change
  application source to fix or improve the implementation. `/document` never touches application
  source, tokens, stylesheets, or components — only the generated `DESIGN.md`. If `/document`
  surfaces a stale or inconsistent value, it reports that as an open question; it does not fix it.
- **vs. `/art-direct`** — `/art-direct` runs the full discovery -> brief -> direction ->
  Design Plan v2 -> implementation workflow, including originating and driving an Art Director MCP
  session. `/document` never starts or advances that session; it only reads an outcome that
  already exists (a live session at the right phase in the same conversation, or a plan already
  committed to the repo). Run `/art-direct` to establish a direction; run `/document` afterward to
  write it down alongside the implemented tokens.
- **vs. `/review-ui`** — `/review-ui` synthesizes multiple critique perspectives into a ranked,
  read-only findings report. `/document` doesn't rank or critique anything; it's a single
  descriptive pass that produces a persistent artifact (`DESIGN.md`) rather than a one-off report.
- **vs. `/compare`, `/consistency`, `/final-pass`** (other Phase 5 commands) — `/compare` checks
  the implementation against an external reference; `/consistency` detects and optionally repairs
  design-system drift; `/final-pass` orchestrates a release-readiness pass across commands.
  `/document` doesn't compare, detect drift, or orchestrate — it only documents current state. A
  natural sequence is `/consistency` (fix drift) then `/document` (record the now-consistent
  system).

## Invocation examples

```text
/document frontend
/document apps/studio DESIGN.md
/document packages/ui docs/DESIGN.md
/document the pricing page, focus on typography and color
```

If `$ARGUMENTS` is empty and the conversation already makes the target project unambiguous,
`/document` infers it and states the inference before writing. Otherwise it asks which
project/app/path to document rather than guessing across the whole monorepo.

## Mutation behavior

- **May change:** exactly one file — the resolved `DESIGN.md` (created if absent, updated if
  present).
- **Within that file, may change:** only the content strictly between existing (or newly added)
  `<!-- GENERATED:<section-id> -->` / `<!-- /GENERATED:<section-id> --> ` marker pairs, for the
  eleven section IDs defined in
  [`reference/design-md-template.md`](../../.agents/skills/document/reference/design-md-template.md).
- **Never changes:** any application source file, token file, stylesheet, or component; anything in
  `DESIGN.md` outside a `GENERATED:*` marker pair (human-authored prose, custom sections, notes);
  any other file in the repository.
- Mutation happens only on an explicit `/document` invocation — never as a side effect of other
  work in the same conversation.

## Scope and limitations

- `/document` cannot originate or advance a Phase 2 Art Director session. A project with no prior
  `/art-direct` run and no committed design plan gets its direction marked unknown in the
  `overview` section — that's correct, not a defect.
- It documents declared/authored values, not rendered output — it does not capture screenshots or
  verify how the system actually renders. Pair with `/audit` or `/review-ui` for rendered-evidence
  findings.
- Values baked into compiled/generated CSS (rather than a source token file) can only be documented
  as observed, not as authored intent; this distinction is called out in `open-questions` when it
  applies.
- If a project has no discernible token system, scale, or convention for a given section, that
  section is documented as `_Unknown — not found in implementation._` rather than backfilled with
  an invented default.

## Verification

`/document`'s own workflow includes:

- confirming every one of the eleven template sections is present in the written file;
- spot-checking at least one documented value per non-empty section against the source file cited
  for it;
- confirming every passage that existed outside `GENERATED:*` markers in the prior file is still
  present, unchanged, in the same relative position;
- a `git status`/`git diff` check scoped to the resolved project's source paths (excluding the
  written `DESIGN.md`) to confirm no application file was touched.

### Validating changes to the skill itself

Because this skill only ever produces Markdown, contributors changing `SKILL.md` or
`reference/design-md-template.md` should:

- run `pnpm format:check` (and `pnpm format` if it fails on the touched files) and `pnpm lint` from
  the repository root;
- manually verify every relative link in the changed files resolves to a real path in the repo;
- manually verify every MCP tool name referenced (`get_design_rules`, `get_selected_direction`)
  still appears in [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md);
- dry-run the workflow against a project with an existing hand-edited `DESIGN.md` (or a fixture
  file containing both `GENERATED:*` blocks and free-form prose) and confirm by inspection that a
  simulated update would touch only the marked regions.

`pnpm typecheck` and `pnpm test` are not meaningful for a Markdown-only change and are not part of
this skill's own validation loop.
