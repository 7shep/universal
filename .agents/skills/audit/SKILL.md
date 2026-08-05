---
name: audit
description: Read-only, evidence-led design and implementation audit of an existing website or React interface in Universal — hierarchy, composition, typography, spacing, color/contrast, responsive behavior, accessibility, interaction states, component vocabulary, generic AI patterns, alignment with the selected direction, and implementation craft. Never edits, formats, stages, commits, or pushes anything.
---

# /audit

Produce a prioritized, evidence-led audit of an existing route, component, or directory. **This
skill is strictly read-only.** Never edit, format, stage, commit, or push any file — not even a
"trivial" fix. If the user wants something fixed, tell them to run `/polish` or `/cleanup` instead.

`$ARGUMENTS` optionally names a route, component, directory, or audit focus (for example
`apps/studio/src/routes/Preview`, `packages/ui Button states`, or `mobile spacing on the pricing
page`). If empty, ask which scope to audit rather than guessing at the whole repository — the
monorepo is too large to audit unscoped.

## Non-negotiables

- Read-only: no `Edit`, `Write`, `NotebookEdit`, formatter, `git add`, `git commit`, or `git push`
  during this skill, under any circumstance, even for a one-line fix.
- Inspect the actual current implementation before judging it — never assess from memory or from
  the user's description alone.
- Never claim a viewport, screenshot, or visual check happened when it didn't. Distinguish source
  inspection from real visual evidence at every point in the report.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not invent tool names or request fields, and do not attempt the
  stateful Phase 2 Art Director sequence (`start_art_direction` and friends) — that belongs to
  `/art-direct`, and audit has no session to resume.
- Load only the source relevant to the resolved scope (target files, their direct imports, shared
  tokens/primitives they use, co-located tests). Do not pull in unrelated parts of the monorepo.

## Workflow

### 1. Resolve scope

Interpret `$ARGUMENTS` as a route, component, directory, or named focus. If ambiguous or missing,
ask before reading broadly. State the resolved scope back before continuing.

### 2. Discover relevant files

Use `Glob`/`Grep` to find, within the resolved scope:

- the entry component(s)/page(s) and their direct children;
- co-located or imported CSS/stylesheets and design tokens;
- shared primitives from `packages/ui` or a project-local components directory that the scope
  reuses;
- routing configuration that determines how the scope is reached;
- existing tests for the scope (they document intended behavior).

Read only what the scope actually touches. If the scope is large (a whole directory or app), sample
representative files and say so rather than silently reading everything.

### 3. Gather available evidence

Collect whatever of the following already exists — do not manufacture any of it:

- **Existing screenshots.** Search the repository and any conventional output locations (e.g.
  `artifacts/`, a screenshots directory referenced by the project, or paths the user names) for
  images relevant to the scope.
- **Fresh desktop/mobile screenshots**, only if capture tooling is already available and wired up in
  this environment (for example the `/browse` skill, or a Playwright/Puppeteer setup already
  present in the repo) — invoke it read-only (navigate + screenshot) against an already-running or
  trivially startable dev server. If no such tooling exists, or capturing it would require setting
  up new infrastructure, do not fake it: record "no screenshot tooling available" and continue with
  source-only inspection.
- **Design context**, if it is already committed or already present in the conversation: a design
  plan, creative brief, selected direction, taste profile export, or written design rules. Universal
  does not persist Art Director session state to disk by default, so absence of these is normal, not
  a gap to apologize for.

Every piece of evidence in the final report must trace back to something actually inspected in this
step — a file path, a screenshot location, or an MCP response.

### 4. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` with the category closest to the audit focus (`general`, `website`,
  `typography`, `composition`, `imagery`, or `motion`) — use its `categoryPrinciples`,
  `antiPatterns`, and `implementationConstraints` as the deterministic backbone for findings in that
  category.
- `get_taste_profile` for the active taste policy's `principles` and `antiPatterns` (each with
  `severityDefault` and `allowWhen` exceptions) — cite the specific principle or anti-pattern ID a
  finding is based on.
- `review_implementation` with the scoped files' current content (unmodified) and any visual
  evidence gathered in step 3, shaped per
  [`docs/MCP_REFERENCE.md#review_implementation`](../../../docs/MCP_REFERENCE.md#review_implementation).
  Treat its `findings` (with `rule`, `severity`, `rationale`, `actionableFix`) as deterministic
  input to the report, not the whole of it — this tool does not inspect screenshot pixels, so pair
  its findings with your own reading of any real evidence from step 3.

If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles. Do not label every resulting finding as judgment-based by default — a fact you
locally verified in this audit (an explicit `outline: none` with no replacement focus treatment, a
contrast ratio you computed from the actual foreground/background colors, or confirmed overflow/
clipping at a viewport you inspected) stays `deterministic`, because the evidence is mechanically
checkable independent of MCP. Only findings that rely on Universal's design-policy judgment (taste
principles, anti-patterns, direction alignment) lose that backing without MCP and must be
downgraded to `judgment`, with a note that MCP policy support was unavailable to confirm them.

### 5. Build findings

Cover, wherever the scope and evidence make it relevant: hierarchy, composition, typography,
spacing/rhythm, color/contrast, responsive behavior, accessibility, interaction states (focus,
hover, active, loading, empty, error), component vocabulary/consistency, generic AI design patterns,
alignment with the selected design direction (when one is known), and implementation craft.

For each finding, populate every field below — see [reference/finding-schema.md](reference/finding-schema.md)
for the full schema, worked examples, and severity/confidence rubrics:

- **id** — stable, kebab-case, unique within this report (e.g. `audit-001`);
- **category** — one of the audit dimensions above;
- **severity** — `high`, `medium`, or `low`;
- **confidence** — how sure you are, and why (evidence strength, not vibes);
- **location** — affected file, selector/class, component, or viewport;
- **evidence** — the concrete thing observed (a code excerpt or description, a screenshot location,
  or an MCP finding/rule ID) — never a bare assertion;
- **rationale** — why this matters, tied to a principle, anti-pattern, or concrete user-facing
  consequence;
- **recommendation** — a scoped, actionable fix (not "redesign this"); note if it's more than a
  `/polish`-sized change;
- **classification** — `deterministic` (rule-based, e.g. a focus indicator explicitly suppressed
  with no replacement, or a lint-style MCP finding) or `judgment` (requires human taste/context,
  e.g. "this hero feels generic").

Do not flag something as a defect solely because it differs from your personal taste — ground every
judgment-based finding in a cited principle, anti-pattern, or a concretely described user-facing
consequence.

### 6. Report

Use exactly the structure in [Required final output](#required-final-output) below. Do not add a
"fixes applied" section — there are none.

## Required final output

1. **Scope and evidence inspected** — resolved scope; files read; screenshots found/captured (with
   paths) or explicitly absent; design-context artifacts found or explicitly absent; which MCP tools
   were called and which were unavailable.
2. **Executive assessment** — 3-6 sentences: overall state, the one or two things that matter most,
   and how confident this audit is given the evidence gathered.
3. **Findings ordered by severity and impact** — using the schema from step 5, high severity first.
4. **What is already working well** — concrete, specific credit; not filler.
5. **Recommended repair order** — a short sequenced list (e.g. "1. fix contrast on X, 2. run
   `/cleanup` on Y, 3. `/polish` the hero") reflecting dependency and impact, not just severity.
6. **Evidence gaps and limitations** — every unavailable tool, missing screenshot viewport, or
   unknown design direction, stated plainly.
7. **Explicit confirmation that no source files were modified during this audit.**

Never soften item 7 into "no significant changes" — it must state plainly that nothing was edited,
formatted, staged, committed, or pushed.
