---
name: consistency
description: Detects design-system drift across components and routes in Universal — inconsistent tokens, typography, spacing, radii, control styling, states, and responsive patterns — by inventorying actual values in use before judging anything. Default mode is read-only detect-and-report; repairs only the specific inconsistencies the user explicitly selects, never a repo-wide sweep.
---

# /consistency

Find where a design system has drifted — the same semantic thing (a primary button, a card radius,
a heading scale, a breakpoint) implemented with silently divergent values across components and
routes — and report it. **Repair is opt-in and item-scoped.** Default mode never edits a file; it
only runs when the user names specific findings to fix, and even then it fixes exactly those
findings, not every occurrence of a similar-looking problem in the repository.

`$ARGUMENTS` optionally names a scope (route, component, directory, or "the design system"), a
dimension focus (tokens, typography, spacing, radii, controls, states, responsive), and/or a repair
selection (one or more finding IDs from a prior `/consistency` report, e.g. `repair consistency-002
consistency-005`). If empty, ask which scope to inspect rather than guessing at the whole
repository — the monorepo is too large to inventory unscoped. If a repair selection references IDs
that don't exist in the current or a just-produced report, say so and stop instead of guessing what
was meant.

## What this is not

- **Not `/cleanup`.** `/cleanup` removes redundant, obsolete, dead, or generic code — things that
  shouldn't exist anymore. `/consistency` unifies patterns that are all still live and all still
  used, but have drifted apart from each other. If a candidate turns out to be dead code (a stale
  class with zero references) rather than a divergent-but-live pattern, say so and hand it to
  `/cleanup` instead of repairing it here.
- **Not `/audit`.** `/audit` is a broad, read-only, evidence-led quality pass across hierarchy,
  accessibility, generic AI patterns, and more. `/consistency` is narrower and specifically
  comparative: it only exists to compare instances of the same semantic thing against each other and
  against the system's established values.
- **Not `/typography`, `/color`, `/layout`, `/states`, or `/responsive`.** Those commands each
  deepen and improve one dimension on their own initiative once invoked. `/consistency` only flags
  cross-instance divergence within a dimension and repairs the specific divergent instances a human
  selected — it does not redesign or upgrade the dimension itself.
- **Not `/polish`.** `/polish` improves the craft of a single bounded target. `/consistency`'s unit
  of work is a _pattern compared across multiple locations_, not a single surface.
- **Not `/art-direct`.** `/consistency` never proposes a new design direction, token set, or scale —
  it only unifies onto a value already established or explicitly chosen by the user.

## Non-negotiables

- **Inventory before judgment.** Never assert a value is "the standard" from memory, from a token
  file's stated intent, or from what looks conventional. Build the actual-values inventory (step 2)
  from the real, current source first, and treat the token file's declared value as one data point
  in that inventory, not as ground truth by default.
- **Drift vs. deliberate variation is a judgment call, not a default.** A different value is not
  automatically drift. When intent is unclear (different semantic role, a component variant, a
  clearly distinct context), classify it as deliberate variation and leave it alone, or ask — never
  assume divergence is a mistake.
- **Default mode is read-only.** No `Edit`, `Write`, `NotebookEdit`, formatter, `git add`,
  `git commit`, or `git push` unless the user has explicitly selected specific finding IDs to
  repair in this invocation or a prior one being resumed.
- **Repair is scoped to exactly what was selected.** Never expand a selected repair into "while I'm
  here, let me also fix every other instance of this same pattern I noticed." If related drift is
  found during repair, report it as a new finding for the next round instead of silently including
  it.
- **Never do a repo-wide mechanical sweep**, even for a single selected finding. If a finding has
  many occurrence sites, enumerate them and edit each traceably; do not run a blind global
  find-and-replace across the codebase in one motion, and do not touch a file outside the
  finding's documented occurrence list without re-verifying it first.
- **Preserve behavior and public component APIs.** Unifying a value must not change props, exported
  types, event handling, routing, state, or accessibility semantics. If unifying a value would
  require an API change, stop and flag it instead of making the change.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not invent tool names or fields, and do not attempt the stateful
  Phase 2 Art Director sequence — that belongs to `/art-direct`.
- Never claim a viewport, screenshot, or visual check happened when it didn't.

## Workflow

### 1. Resolve scope

Interpret `$ARGUMENTS` as a route, component, directory, dimension focus, or repair selection. If
scope is ambiguous or missing, ask before reading broadly. State the resolved scope, dimension
focus (or "all dimensions"), and whether this is a detect-and-report run or a repair run before
continuing.

### 2. Build the inventory of actual values in use

This is the step that makes `/consistency` different from guessing. Before judging anything as
inconsistent, use `Glob`/`Grep`/`Read` across the resolved scope to enumerate what is _actually_
in the source, for whichever dimensions are in focus:

- **Tokens** — every design-token reference in use (CSS custom properties, theme object keys,
  Tailwind-style scale classes) and every hard-coded literal that looks like it's standing in for
  one (hex/rgb/hsl colors, `px`/`rem` spacing or radius literals, named font stacks).
- **Typography** — every distinct `font-family`, `font-size`, `font-weight`, `line-height`, and
  letter-spacing value in use, and which heading/body/label role each is attached to.
- **Spacing** — every distinct margin/padding/gap value in use, and the layout role it plays
  (section rhythm, card padding, form-field gap, inline gap).
- **Radii** — every distinct `border-radius` value in use, and what kind of element it's on
  (button, card, input, modal, avatar, image).
- **Control styling** — every button/input/select/checkbox/toggle implementation's border, height,
  padding, focus treatment, and disabled treatment, grouped by apparent semantic role (primary
  action, secondary action, destructive action, form field).
- **States** — for each interactive component found, which of hover/focus-visible/active/
  disabled/loading/empty/error states exist at all, and how each is implemented where present.
- **Responsive patterns** — every breakpoint value in use, and how each component adapts at it
  (stacking, hiding, resizing, reflowing).

Record each distinct value found, every file/selector where it appears, and how many places use it.
Also read `packages/ui` (or the project's local shared-primitive directory) and any shared
token/theme files in scope — these describe the _intended_ system but are still just one more data
point until cross-checked against what components actually use.

If the scope is large (a whole directory, app, or "the design system"), sample representative
routes/components across it and say so explicitly rather than silently claiming exhaustive coverage.

### 3. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` for the category closest to the dimension focus (`general`, `website`,
  `typography`, `composition`, `imagery`, or `motion`) — its `categoryPrinciples`,
  `spacingPrinciples`, `typographyPrinciples`, and `implementationConstraints` help decide which
  competing value, if any, the system already treats as canonical.
- `get_taste_profile` for principles tagged `typography`, `color`, `composition`, or `controls`, and
  for anti-patterns whose `detectionHints` match something found in step 2.

These calls inform which value a drift finding should converge toward when there's a real
ambiguity — they do not replace the inventory from step 2, and they never justify skipping it.

If the MCP is unavailable, say so explicitly and fall back to whatever the codebase's own token
files and `AGENTS.md` visual quality principles establish as the intended system.

### 4. Classify every divergence

For every dimension where the inventory (step 2) shows more than one value playing what looks like
the same semantic role, classify it:

| Class                    | Meaning                                                                                                           | Action                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Drift**                | Same semantic role, no signal of intent behind the divergence (no variant name, comment, or distinct context)     | Report as a finding; candidate for repair if selected          |
| **Deliberate variation** | Different semantic role, an explicit variant/theme, or a distinct context that plausibly justifies the difference | Report as preserved variation with the reasoning; do not touch |
| **Ambiguous**            | Genuinely can't tell from source alone whether the divergence is intentional                                      | Ask the user; do not assume either way                         |
| **Not drift, dead**      | The divergent value belongs to code with no live references                                                       | Note it and defer to `/cleanup`; do not repair or delete here  |

Ground every classification in what step 2 actually found — a file:line, selector, or value pair —
never a vibe.

### 5. Report (default output)

Produce the report in [Required final output](#required-final-output). This is the terminal step
for a detect-and-report run. Do not proceed to step 6 unless the user has already supplied, in this
same invocation, one or more finding IDs to repair.

### 6. Repair — only for explicitly selected findings

Skip this section entirely for a detect-and-report run.

When the user selects one or more finding IDs (from this report or a prior one):

1. Re-verify the finding is still accurate against current source before touching anything —
   source may have moved since the report was produced.
2. Confirm the convergence target: the existing established token/value from step 2/3 if one is
   clearly canonical; otherwise state the choice being made (e.g. "converging on `8px` because it
   has the most call sites and matches `get_design_rules`'s spacing guidance") and get confirmation
   before editing if the choice isn't obvious from the report.
3. Enumerate every occurrence site for that finding from the inventory and edit each one
   individually and traceably. Prefer routing through an existing shared token/primitive over
   hard-coding the converged value again at each site.
4. Do not touch any file or occurrence not already listed under the selected finding's evidence. If
   repair work surfaces a new, previously unlisted occurrence, add it to this repair's occurrence
   list explicitly (and say so in the report) rather than silently expanding scope.
5. After each finding's edits, re-run the occurrence search for the old value to confirm no stray
   reference to it remains among the sites just changed.

### 7. Run checks (repair runs only)

From the repository root, or filtered to the touched workspace(s):

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

Report exact commands and outcomes; do not claim a check passed without having run it. If
formatting is needed, format only the files this repair touched and inspect the diff before
accepting it.

### 8. Re-verify behavior and visuals (repair runs only)

- Confirm public component APIs, props, event handlers, routes, and accessibility semantics are
  unchanged at every edited site.
- If screenshot/browser tooling is already available and wired up in this environment (e.g. the
  `/browse` skill or an existing Playwright/Puppeteer setup), capture desktop and mobile evidence of
  the changed surfaces before and after. If unavailable, say so plainly instead of fabricating it.
- Call `review_implementation` with the final changed source (plus any captured evidence) for
  materially changed React/CSS files to confirm the unification didn't introduce a new taste or
  composition regression. Address only findings caused by this repair.

### 9. Report

Use [Required final output](#required-final-output) for either run type.

## Required final output

1. **Scope and dimensions inspected** — resolved scope, dimension focus or "all", sampled vs.
   exhaustive coverage, and whether this was a detect-and-report or repair run.
2. **Inventory summary** — for each inspected dimension, the distinct values actually found and
   their occurrence counts (e.g. "spacing: `8px` × 14, `10px` × 3, `12px` × 1 — no shared token
   covers `10px`/`12px`").
3. **Drift findings** — each with: `id` (kebab-case, e.g. `consistency-001`), `dimension`,
   `severity` (`high`/`medium`/`low` — see [reference/inventory-and-drift.md](reference/inventory-and-drift.md)),
   `occurrences` (every file/selector where the divergent value appears), `established value`
   (what the system otherwise uses, with citation), `rationale`, and `proposed convergence target`.
4. **Deliberate variation preserved** — every divergence classified as intentional, with the
   reasoning that kept it untouched, so the user can see what was _not_ flagged and why.
5. **Ambiguous items needing a decision** — divergences the skill could not classify from source
   alone; ask about these explicitly rather than defaulting either way.
6. **Deferred to `/cleanup`** — any candidate that turned out to be dead code rather than
   live-but-divergent.
7. **If a repair ran:** selected finding IDs, exact occurrence-by-occurrence changes made, behavior
   and API preservation confirmed, validation commands run with real results, before/after
   evidence or its explicit absence, and `review_implementation` baseline vs. re-review findings.
8. **If no repair ran:** an explicit statement that no files were modified, formatted, staged,
   committed, or pushed, and a reminder that repair requires naming specific finding IDs.
9. **Remaining limitations** — unavailable MCP tools, sampling gaps, ambiguous items left for the
   user, and anything a human should double check.

Never soften item 8 into "no significant changes" when no repair ran — state plainly that nothing
was edited.

## Known limitations

- Sampling on a large or unscoped inventory can miss a divergent instance outside the sampled set;
  say so rather than implying exhaustive coverage.
- Source-only classification cannot always tell drift from deliberate variation with certainty —
  the ambiguous-item path exists for exactly this reason and should be used rather than guessed
  past.
- `review_implementation` does not inspect screenshot pixels; visual confirmation of a repair is
  only as strong as the capture tooling actually available in the environment.
