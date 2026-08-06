---
name: compare
description: Read-only comparison of an existing Universal route or component against a supplied reference — a screenshot, mockup, reference URL, DESIGN.md, or a selected Universal art direction — reporting prioritized visual differences classified as intentional-divergence, drift, or defect, each with source locations and a recommendation routed to the appropriate mutating skill. Never edits, formats, stages, commits, or pushes anything; stops if the reference cannot actually be inspected.
---

# /compare

Compare the current implementation of a route or component against a supplied reference — a
screenshot, a mockup image, a reference URL, a `DESIGN.md`, or a selected Universal art direction —
and report prioritized visual differences with source locations and actionable recommendations.
**This skill is strictly read-only.** Never edit, format, stage, commit, or push any file, even a
one-line fix that would obviously resolve a difference. Route every recommended fix to `/polish`,
`/layout`, `/color`, `/typography`, or another mutating skill instead of applying it here.

`$ARGUMENTS` names the target (route, component, or directory) and the reference to compare it
against (a screenshot/mockup file path, a URL, `DESIGN.md` or another design-doc path, or "selected
direction" plus the session/summary to compare against). Both a target and a reference are required.
If either is missing or the reference is ambiguous, ask before reading or fetching anything — never
guess at an unscoped comparison or an unnamed reference.

## Non-negotiables

- Read-only: no `Edit`, `Write`, `NotebookEdit`, formatter, `git add`, `git commit`, or `git push`
  during this skill, under any circumstance, even for a one-line fix. If the user wants something
  fixed, name the mutating skill that should do it (see [Routing fixes](#routing-fixes-not-applying-them)) —
  do not apply it yourself.
- **Resolve and validate the reference before comparing anything.** A reference is only usable once
  it has actually been inspected in this run — a local image actually read, a URL actually rendered
  by available browsing tooling, a design doc actually read, or a direction actually retrieved from
  a real session. If the reference cannot be resolved this way (missing file, broken/inaccessible
  URL with no rendering tooling available, a `DESIGN.md` that doesn't exist at the given path, or an
  invalid/unavailable art-direction session), **stop the comparison** and report exactly why instead
  of proceeding on assumption, memory, or the user's description of the reference.
- Never assert a pixel-level or automated visual diff that did not actually happen. Universal has no
  pixel-diffing tool: `review_implementation` performs deterministic source review only and
  explicitly does not inspect image pixels. Viewing an image (a local screenshot/mockup, or a page
  rendered through browsing tooling) is a real perceptual/visual inspection and may be reported as
  such — but describe it as visual inspection, never as "pixel-perfect," "pixel-diffed," or a
  percentage-match figure, unless a real pixel-diffing tool actually ran and produced that number.
- Classify every reported difference as exactly one of `intentional-divergence`, `drift`, or
  `defect` (see [reference/classification.md](reference/classification.md)). Never leave a
  difference unclassified, and never default to `defect` for something that might be an intentional
  choice you can't yet confirm — use `drift` and say what would confirm it either way.
- Give a source location for every difference: the implementation-side file/selector/component, and
  the reference-side location (image region description, URL element, `DESIGN.md` section, or
  direction attribute).
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not invent tool names or fields, and do not attempt the stateful Phase
  2 Art Director sequence (`start_art_direction` and friends) — `/compare` may only _read_ an
  existing session via `get_art_direction_session` when the reference is a selected direction; it
  never starts, mutates, or advances one. That belongs to `/art-direct`.
- Load only the source relevant to the resolved target (target files, their direct imports, shared
  tokens/primitives they use). Do not pull in unrelated parts of the monorepo.

## Reference types and how to validate each

Full detail, including what counts as "actually inspected" per type, is in
[reference/reference-resolution.md](reference/reference-resolution.md). Summary:

- **Screenshot or mockup image file** — read it directly. Valid only if the path exists and the
  image actually renders as content, not a broken/empty file.
- **Reference URL** — render it with whatever browsing tooling already exists in this environment
  (the `/browse` skill, or an existing Playwright/Puppeteer setup already wired into the repo).
  Valid only if the page actually loaded and was actually viewed. If no such tooling exists in this
  environment, the URL cannot be validated — do not describe a URL from its slug, domain, or prior
  knowledge.
- **`DESIGN.md` or another design document** — read it. Valid only if the file exists at the given
  path and contains substantive design content (not a stub/placeholder).
- **Selected Universal direction** — call `get_art_direction_session` with the session string the
  user supplies. Valid only if the session validates and reports a phase at or beyond
  `direction-selected` (or later, e.g. `plan-created`). Universal does not persist Art Director
  session state to disk, so `/compare` cannot look one up on its own — the user (or the invoking
  conversation) must supply the session string. Compare against the plan/direction's stated
  typography, color, composition, and motion decisions, not against a rendered image, since a
  direction is a decision set, not a picture.

If none of these validate, stop and report the failure in step 2 of the workflow below rather than
continuing into comparison.

## Workflow

### 1. Resolve target and reference

Parse `$ARGUMENTS` into the implementation target (route/component/directory) and the reference
(type + location). State both back before doing anything else. If either is missing or the
reference's type is unclear (e.g., a bare word with no path/URL/session attached), ask.

### 2. Validate the reference

Follow [reference/reference-resolution.md](reference/reference-resolution.md) for the resolved
reference type. Actually attempt the inspection (read the file, render the URL, call
`get_art_direction_session`). Record exactly what happened.

- **If validation succeeds:** continue to step 3, carrying forward what was actually observed
  (image contents, rendered page contents, document contents, or direction decisions).
- **If validation fails:** stop here. Do not proceed into comparison. Report, using the same
  structure as [Required final output](#required-final-output) but with an explicit note in section
  1 that the comparison could not run, exactly what was attempted and why it failed, and — only if
  genuinely useful — what the user would need to provide (a working path, an accessible URL, a real
  `DESIGN.md`, or a valid session string) to retry.

### 3. Gather implementation evidence

Once the reference is validated, gather the implementation side:

- The target's entry component(s)/page(s), direct children, co-located/imported CSS and design
  tokens, and shared primitives it reuses — via `Glob`/`Grep`/`Read`, scoped to the target.
- **Existing screenshots** of the target, if already present in the repository.
- **Fresh desktop/mobile screenshots**, only if capture tooling is already available and wired up in
  this environment (e.g. the `/browse` skill against an already-running or trivially startable dev
  server). If no such tooling exists, do not fake it — record "no screenshot tooling available" and
  compare on source plus whatever reference evidence step 2 produced.

### 4. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` for the category closest to the comparison focus (`general`, `website`,
  `typography`, `composition`, `imagery`, or `motion`).
- `get_taste_profile` for the active taste policy's principles and anti-patterns, to help decide
  whether a difference is a defect against Universal's own guardrails even absent the reference.
- `review_implementation` with the target's current (unmodified) source and any visual evidence from
  step 3, per
  [`docs/MCP_REFERENCE.md#review_implementation`](../../../docs/MCP_REFERENCE.md#review_implementation).
  Remember this tool does not inspect image pixels — treat its findings as deterministic source-level
  input, not as evidence that a visual comparison against the reference happened.

If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles for judging deviations.

### 5. Compare and classify

For every dimension where the reference and the implementation can actually be compared (typography,
color/palette, composition/layout, spacing, imagery, motion/interaction cues, copy, component
vocabulary — only the dimensions the reference evidence actually supports), identify concrete
differences. For each one:

- Describe what the reference shows/states and what the implementation currently does.
- Classify it per [reference/classification.md](reference/classification.md) as
  `intentional-divergence` (a deliberate, defensible departure — e.g. a documented constraint, a
  responsive adaptation, or a difference the design doc/direction explicitly allows), `drift` (an
  unintentional or unconfirmed deviation with no evidence it was deliberate — the default when
  uncertain), or `defect` (a difference that also breaks a concrete principle, anti-pattern,
  accessibility rule, or the reference's own explicit requirement).
- Do not classify something as `intentional-divergence` without a cited reason (a comment, a
  documented constraint, a responsive-necessity argument, or an explicit statement from the user in
  this conversation). Absent that, use `drift`.

### 6. Build findings

Populate every field in [reference/finding-schema.md](reference/finding-schema.md) for each
difference: `id`, `category`, `severity`, `confidence`, `implementation_location`,
`reference_location`, `evidence` (typed `source` | `screenshot` | `rendered-url` | `design-doc` |
`direction` | `mcp`), `rationale`, `classification`, `recommendation`, and `route_to` (the mutating
skill that should apply the fix, or `none` if it's informational only).

### 7. Report

Use exactly the structure in [Required final output](#required-final-output). Do not add a "fixes
applied" section — there are none.

## Routing fixes, not applying them

`/compare` never edits files. Point each actionable difference at the skill that owns that kind of
change instead:

- Spacing, alignment, density, composition, whitespace pacing → `/layout`
- Palette, semantic color roles, contrast, color tokens → `/color`
- Type scale, pairing, line-length/line-height, hierarchy via type → `/typography`
- General bounded visual refinement that doesn't cleanly fit one of the above, or a mix of small
  items → `/polish`
- A difference too large for a bounded fix (a different composition thesis entirely, a new
  direction) → say so and point at `/art-direct` instead of any of the above.

`/compare` itself never queues or triggers these — it names the right next command per finding and
stops.

## Boundaries against neighboring commands

- **vs. `/critique`** — `/critique` answers one focused design question with evidence and no
  required external reference. `/compare` always requires a supplied, validated reference and
  produces a full prioritized difference report across every dimension the reference supports, not
  an answer to a single question.
- **vs. `/audit`** — `/audit` is an unreferenced evidence sweep: it judges a surface against
  Universal's own design rules/taste policy and general craft, with no external reference required
  or expected. `/compare` is always reference-driven; without a validated reference it stops rather
  than falling back to an unreferenced audit. If the user actually wants an unreferenced sweep,
  point them at `/audit` instead of quietly running one.
- **vs. `/consistency`** — `/consistency` detects internal design-system drift (component/token
  inconsistency across the codebase itself). `/compare` measures drift/defect against an external
  reference, not internal consistency.
- **vs. `/review-ui`** — `/review-ui` runs multiple internal critique perspectives and synthesizes
  them; it does not require or validate an external reference either.

## Known limitations

- Universal has no automated pixel-diffing tool. All visual comparison is perceptual (a person or
  model actually viewing images/renders), never a computed pixel/percentage match.
- A "selected direction" reference depends on the user supplying a valid session string in this
  conversation; Universal does not persist Art Director sessions to disk, so `/compare` cannot
  discover one on its own.
- URL references depend on browsing tooling already being available and wired up in this
  environment; `/compare` does not install or configure new capture infrastructure.
- `review_implementation` is a source-level, deterministic reviewer — it never substitutes for
  actually viewing the reference.

## Required final output

1. **Target and reference resolved** — the target scope; the reference type and location; how the
   reference was validated (or, if invalid, exactly what was attempted and why it failed — in which
   case this is the final section and the report stops here).
2. **Evidence inspected** — implementation files read; screenshots found/captured (with paths) or
   explicitly absent; which MCP tools were called and which were unavailable.
3. **Executive assessment** — 3-6 sentences: overall alignment with the reference, the one or two
   differences that matter most, and how confident this comparison is given the evidence gathered.
4. **Differences ordered by severity and impact** — using the schema from step 6, each tagged
   `intentional-divergence`, `drift`, or `defect`, high severity first.
5. **What already matches the reference** — concrete, specific credit; not filler.
6. **Recommended repair order** — a short sequenced list naming which command should apply each fix
   (`/polish`, `/layout`, `/color`, `/typography`, `/art-direct`), reflecting dependency and impact.
7. **Evidence gaps and limitations** — every unavailable tool, missing viewport, or evidence type the
   reference didn't support, stated plainly.
8. **Explicit confirmation that no source files were modified during this comparison.**

Never soften item 8 into "no significant changes" — it must state plainly that nothing was edited,
formatted, staged, committed, or pushed. Never claim a screenshot, browser render, or MCP call
happened when it didn't.
