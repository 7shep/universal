---
name: document
description: Inspects a project's actual implementation and, when one has been established in this conversation or repo, its selected design direction, then creates or updates a Google Stitch-compatible DESIGN.md documenting typography, color, spacing, components, layout, motion, responsive behavior, and implementation guidance. Mutates only the generated design document, never application source. Derives every documented value from the implementation, preserves human-authored sections on update, and marks unknown values explicitly instead of guessing.
---

# /document

Create or update a `DESIGN.md` file that documents the project's real, currently-implemented
design system — typography, color, spacing, components, layout, motion, responsive behavior, and
implementation guidance — in a structure a design-aware coding agent (including Google Stitch) can
consume directly. **This skill mutates exactly one kind of file: the generated design document.**
It never edits application source, tokens, stylesheets, or components; it only reads them.

`$ARGUMENTS` optionally names the project/app/route to document and, if it differs from the
default, the target document path (for example `apps/studio`, `frontend DESIGN.md`, or
`packages/ui docs/DESIGN.md`). If empty, infer the target only when the active conversation
identifies one project or app unambiguously, and state that inference before writing anything.
Otherwise ask which project/path to document. Default document location, when not specified, is
`DESIGN.md` at the root of the resolved project (e.g. `frontend/DESIGN.md` for the `frontend` app).

## Non-negotiable boundaries

- **Mutates only the generated `DESIGN.md`** (create or update). Never edit, format, stage,
  commit, or push any application source file, token file, stylesheet, or component while running
  this skill — not even to fix an obviously stale value. If the implementation itself needs a
  change, say so in the report and point to `/polish`, `/cleanup`, `/color`, `/typography`, or
  `/layout` instead.
- **Mutation only happens on an explicit `/document` invocation.** Never write or overwrite a
  `DESIGN.md` on your own initiative while doing unrelated work.
- **Derive, never invent.** Every documented value (a hex code, a type scale step, a spacing unit,
  a breakpoint, a component prop) must trace back to something actually read in this run — a file
  path and, ideally, a line or selector. If a value can't be found, write it into the document as
  `_Unknown — not found in implementation._` (see
  [reference/design-md-template.md](reference/design-md-template.md)) rather than filling the gap
  with a plausible-sounding guess.
- **Preserve human-authored content on update.** An existing `DESIGN.md` may contain prose,
  sections, or edits a person added. Only the machine-owned regions defined in
  [reference/design-md-template.md](reference/design-md-template.md) (marked with
  `<!-- GENERATED:<section-id> -->` / `<!-- /GENERATED:<section-id> --> ` comment pairs) are
  replaced. Everything outside those markers is carried forward byte-for-byte, in its original
  position.
- Only call MCP tools that exist for this task: `get_design_rules`, and `get_selected_direction`
  strictly as described in step 4 below — never invent a tool name or field, and never start a new
  Phase 2 Art Director session (`start_art_direction` and the discovery/brief/approval sequence)
  from inside this skill. That workflow belongs to `/art-direct`; `/document` only reads an
  already-established outcome, it never drives one.
- Never claim a screenshot, browser check, or MCP call happened when it didn't.

## Workflow

### 1. Resolve scope and target document

Interpret `$ARGUMENTS` as a project/app/route and, optionally, a document path. State the resolved
project and the `DESIGN.md` path back before reading further. If ambiguous or missing and the
conversation doesn't make it obvious, ask rather than guessing at the whole monorepo.

### 2. Read the existing `DESIGN.md`, if any

If a document already exists at the resolved path, read it in full before touching anything else.
Identify:

- every existing `<!-- GENERATED:<section-id> -->` block and its boundaries;
- every section or passage outside those markers — this is human-authored content that must survive
  the update untouched;
- whether it already matches the template's eleven section IDs, or predates this template (older
  headings, missing markers) — in that case, treat unmarked existing sections as human-authored
  (preserve them) and add any missing template sections fresh, wrapped in new markers, in the
  position the template defines.

If no document exists, this is a fresh create — every section starts as a new `GENERATED:*` block.

### 3. Inspect the actual implementation

Use `Glob`/`Grep`/`Read`, scoped to the resolved project, to gather real evidence for each
template section — do not sample so narrowly that a section ends up guessed instead of derived:

- **Typography** — font-family declarations, `@font-face`/`font` imports, type-scale definitions
  (CSS custom properties, a Tailwind/theme config, a design-tokens package), heading/body
  component styles.
- **Color** — color tokens (CSS custom properties, a theme/tokens file, a Tailwind config's
  `colors`), where each is consumed (background, text, border, accent, semantic state), and any
  ad hoc literal colors found directly in component code (flag these separately — they're
  implementation drift, not part of the token system).
- **Spacing** — a spacing scale or base unit if one exists, section-level padding conventions
  (e.g. a `--gutter`-style token), gap/margin patterns repeated across components.
- **Components** — shared UI primitives (a `packages/ui`-style package, a project-local components
  directory): name, purpose, appearance-relevant variants, file path.
- **Layout** — grid/flex conventions, container widths, column counts, composition patterns
  repeated across sections/pages.
- **Motion** — transitions, keyframe animations, scroll-driven effects, their trigger,
  duration/easing, and technique (CSS vs. a JS animation library).
- **Responsive behavior** — actual media query breakpoints or a config's breakpoint tokens, and
  what changes at each for each major surface.
- **Reduced motion** — whether and how `prefers-reduced-motion` (or an equivalent) is handled.

Cite the file (and selector/line where practical) for every value pulled into the document. If a
project uses a design-tokens package (e.g. `packages/design-tokens`, `packages/design-engine`)
prefer it as the source of truth over re-deriving values from compiled CSS.

### 4. Retrieve design-policy and direction context, only where it actually applies

- Call `get_design_rules` (category closest to the project — `general`, `website`, `typography`,
  `composition`, `imagery`, or `motion`) when the MCP is connected. Use its `categoryPrinciples`,
  `typographyPrinciples`, `spacingPrinciples`, `antiPatterns`, and `implementationConstraints` to
  ground the `implementation-guidance` section — cite the principle, don't paraphrase it as if it
  were your own opinion.
- Call `get_selected_direction` **only** if this conversation already holds a live Art Director
  session at exactly the `concepts-developed` phase (produced earlier in this same conversation,
  typically by `/art-direct`) — pass its exact serialized `session` string forward unedited. Do
  not call `start_art_direction`, run discovery, or otherwise drive a new session just to reach
  that phase; `/document` has no standing to originate or advance an Art Director session. If no
  such live session exists, do not call this tool — instead check whether a Design Plan v2 or a
  selected-direction summary is already committed to the repo or was pasted into the conversation,
  and cite that if found. If neither exists, state in the `overview` section that no design
  direction was found, rather than inventing one or leaving it silently blank.
- If the MCP is unavailable, say so explicitly and derive `implementation-guidance` from
  `AGENTS.md`'s visual quality principles plus the implementation evidence gathered in step 3.

### 5. Draft every section from evidence

Build each of the eleven sections defined in
[reference/design-md-template.md](reference/design-md-template.md) strictly from what steps 3-4
actually produced. For anything not determinable, write the literal
`_Unknown — not found in implementation._` marker rather than a plausible value. Populate
`open-questions` with every such gap as a plain sentence — this section always exists, even if it
just says "None."

### 6. Merge with the existing document

- **Create:** write the full template, every section wrapped in its `GENERATED:<section-id>` pair,
  with today's date in each pair's `updated` attribute.
- **Update:** replace only the content strictly between each existing `GENERATED:<section-id>` pair
  with the freshly derived content (refresh the `updated` date on every section actually
  regenerated). Leave every byte outside all `GENERATED:*` pairs exactly as it was. Append any
  template section that's missing entirely, newly wrapped in its marker pair, in the position the
  template defines.

### 7. Write the file

Write (create or overwrite in place) only the resolved `DESIGN.md` path. Do not touch any other
file.

### 8. Verify before reporting

- Confirm every section the template requires is present in the written file.
- Spot-check a sample of documented values (at minimum one per section that has content) against
  the actual source file cited for it — catch a transcription error before reporting, not after.
- Confirm every passage that existed outside `GENERATED:*` markers in the original file is still
  present, unchanged, in the same relative position.
- Confirm no application source, token, stylesheet, or component file was touched — a `git status`/
  `git diff` check limited to the resolved project's source paths (excluding the `DESIGN.md` itself)
  should show nothing.

### 9. Report

Use exactly the structure in [Required final report](#required-final-report) below.

## Required final report

1. **Scope** — resolved project/app and the `DESIGN.md` path written.
2. **Mode** — created new, or updated existing (and, if updated, which `GENERATED:<section-id>`
   blocks changed vs. stayed identical because the underlying implementation hadn't changed).
3. **Evidence inspected** — files read for each template section (typography, color, spacing,
   components, layout, motion, responsive, reduced-motion), and which MCP tools were called or
   explicitly unavailable/inapplicable (including why `get_selected_direction` was or wasn't
   called).
4. **Sections written** — the eleven section IDs, one line each: derived from evidence, or marked
   unknown, or preserved as human-authored (not touched).
5. **Human-authored content preserved** — explicit confirmation of what was found outside
   `GENERATED:*` markers in an existing file and that it was carried forward unchanged (or "no
   existing document — nothing to preserve").
6. **Open questions** — the exact contents of the `open-questions` section, restated here.
7. **Validation performed** — the spot-checks and the source-untouched check from step 8, with real
   results.
8. **Explicit confirmation that no application source, token, stylesheet, or component file was
   modified** — only the `DESIGN.md` path from item 1.
9. **Remaining limitations** — anything unresolved (MCP unavailable, no design direction found,
   ambiguous scope resolved by inference, sections left largely `Unknown`).

Never soften item 8 into "no significant changes" — it must state plainly that the only file
written was the `DESIGN.md` path reported in item 1.

## Known limitations

- `/document` cannot originate or advance a Phase 2 Art Director session; it can only read one that
  already exists at the right phase in the current conversation, or a design plan already committed
  to the repo. A project with no prior `/art-direct` run and no committed plan will have its
  direction marked unknown — that is correct behavior, not a gap to work around.
- Design-tokens spread across compiled/generated CSS (rather than a source token file) can only be
  documented as observed values, not as the authoring intent behind them; note this distinction in
  `open-questions` when it applies.
- This skill does not run screenshot/visual capture — it documents what the implementation declares,
  not how it renders. Pair with `/audit` or `/review-ui` for rendered-evidence findings.
