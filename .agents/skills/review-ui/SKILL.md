---
name: review-ui
description: Read-only, multi-perspective design review and synthesis of an existing route, component, or recent implementation in Universal — coordinates independent critique passes across typography, composition/hierarchy, accessibility, brand/direction alignment, motion/interaction, responsive behavior, component vocabulary, and implementation craft, then normalizes, deduplicates, and ranks the findings into one prioritized report. Never edits, formats, stages, commits, or pushes anything.
---

# /review-ui

Run a focused, multi-perspective design review of an already-implemented UI surface and return
one prioritized synthesis with provenance. **This skill is strictly read-only.** Never edit,
format, stage, commit, or push any file. If findings should be acted on, hand the "Recommended
repair sequence" from this report to `/polish` or `/cleanup` — do not act on it yourself.

Use this after implementation or before approval, when you need several critique angles
reconciled into one ranked list rather than a single evidence sweep. For a broader
evidence-led inspection and repair-priority pass instead, use `/audit`.

`$ARGUMENTS` optionally names any combination of: route/component, viewport (`desktop`, `mobile`,
`both`), a reference (design plan, brief, prior screenshot, competitor URL), a review focus (one
or more of the eight dimensions below), and desired depth (`quick` = fewer critics / higher
severity threshold only, `full` = all eight dimensions). Default depth is `full`. If the target is
empty or ambiguous, ask before reading broadly — do not guess at the whole repository.

## Non-negotiables

- Read-only: no `Edit`, `Write`, `NotebookEdit`, formatter, `git add`, `git commit`, or `git push`,
  even for a one-line fix, even if a critic is confident about the exact repair.
- Ground every critic in the same evidence bundle (step 2). No critic gathers its own private
  evidence or invents observations the bundle doesn't support.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`, shaped per
  [`docs/MCP_REFERENCE.md`](../../../docs/MCP_REFERENCE.md#review_implementation). Do not invent
  tool names or fields, and do not attempt the stateful Phase 2 Art Director sequence — that
  belongs to `/art-direct`.
- Never claim pixel-level visual inspection, or that responsive/motion/hover/focus/runtime
  behavior was observed, without evidence that actually supports it. See
  [reference/synthesis-rules.md](reference/synthesis-rules.md#evidence-labeling).
- A missing or failed critic must not invalidate the critics that did succeed — degrade gracefully
  and say so in the report.

## Orchestration

### 1. Resolve scope

Parse `$ARGUMENTS` into target, viewport(s), reference, focus dimensions, and depth. State the
resolved scope back before reading anything. If nothing resolves to a concrete target, ask.

### 2. Gather the shared evidence bundle

Everything every critic will see — gather once, reuse for all passes:

- **Source**: entry component(s), direct children, co-located/imported CSS and tokens, shared
  primitives the scope reuses, routing config, existing tests (via `Glob`/`Grep`/`Read`, scoped to
  the target — don't pull in unrelated parts of the monorepo).
- **Design context**: a selected design direction, creative brief, design plan, written design
  rules, or taste profile export, if already present in the repo or conversation. Their absence is
  normal, not a gap to apologize for.
- **Screenshots**: existing images relevant to the scope, or freshly captured desktop/mobile
  screenshots if capture tooling is already available (e.g. the `/browse` skill or an existing
  Playwright/Puppeteer setup) against an already-running or trivially startable dev server. Invoke
  it read-only (navigate + screenshot). If no such tooling exists, record "no screenshot tooling
  available" and continue on source-only inspection — do not fake it.
- **Reference material**, if `$ARGUMENTS` named one (prior screenshot, competitor URL, design
  file) — note it as reference evidence, distinct from the implementation's own evidence.

### 3. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` for the category closest to the scope/focus (`general`, `website`,
  `typography`, `composition`, `imagery`, or `motion`).
- `get_taste_profile` for the active taste policy's principles and anti-patterns.
- `review_implementation` with the scope's current (unmodified) file contents and the visual
  evidence from step 2, per the MCP reference's request shape. Treat its `findings` as
  deterministic input that every relevant critic may cite — not a critic pass by itself.

If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles. Preserve `deterministic` classification for facts verified locally from source,
computation, or inspected viewport evidence (for example, an explicitly suppressed focus indicator
with no replacement, a contrast ratio computed from resolved colors, an invalid semantic-control
pattern, or confirmed overflow). Classify findings that depend on Universal's design-policy
judgment — taste, anti-pattern, or direction-alignment conclusions — as `judgment` without MCP
support.

### 4. Run independent critic passes

Critics: typography, composition-and-hierarchy, accessibility, brand-and-direction-alignment,
motion-and-interaction, responsive-behavior, component-vocabulary, implementation-craft — rubrics
in [reference/critic-rubrics.md](reference/critic-rubrics.md). Run only the dimensions selected by
`$ARGUMENTS`' focus, or all eight at `full` depth; at `quick` depth run all eight but report only
`high`/`medium` severity.

**Parallelism model:**

- If the `Task` tool is available, dispatch each critic as an isolated subagent, passing it only
  the shared evidence bundle from steps 2-3 and its rubric section — not the other critics'
  output, so critiques stay independent. Bound concurrency to at most 4 concurrent critics per
  batch (run 8 as two batches of 4) to control context and cost. Give each critic a single
  attempt; do not retry a hung or failed critic — record it as missing and continue.
- If `Task` is unavailable in this environment, fall back deterministically: run each critic as a
  sequential pass in the current context, one dimension at a time, still keeping each pass's
  reasoning independent of the others' conclusions (write and normalize one critic's findings
  before reading its output back into the next critic's framing).
- Either way, a critic that errors, times out, or produces nothing usable is recorded as failed —
  proceed with the remaining critics and disclose the gap in the final report's section 7. Do not
  block the whole review on one failed critic, and do not fabricate its output.
- No critic — subagent or in-context pass — may call `Edit`, `Write`, `NotebookEdit`, or any git
  mutation tool. If using `Task`, do not grant those tools to the dispatched critic.

### 5. Normalize

Convert every critic's raw output into the schema in
[reference/finding-schema.md](reference/finding-schema.md). A finding that doesn't fit the schema
isn't ready for synthesis — normalize it or drop it, don't pass through free-form prose.

### 6. Deduplicate, identify conflicts, and rank

Apply [reference/synthesis-rules.md](reference/synthesis-rules.md) in full: merge only findings
that share both the same underlying issue and the same target, while preserving
`supporting_critics` provenance; keep material disagreements as `dissenting_critics` entries
rather than resolving them by vote; and rank by severity → user impact → confidence → repair cost
→ direction alignment, preferring evidence strength over critic count.

### 7. Report

Use exactly the structure in [Required final output](#required-final-output). Do not add a "fixes
applied" section — there are none.

## Required final output

1. **Review scope and evidence** — resolved target(s)/viewport(s)/focus/depth; files read;
   screenshots found/captured (with paths) or explicitly absent; design-context artifacts found or
   explicitly absent; which MCP tools were called and which were unavailable; which critics ran,
   in parallel or sequential fallback.
2. **Overall assessment** — 3-6 sentences: overall state, the one or two things that matter most,
   and how confident this review is given the evidence gathered.
3. **Prioritized synthesized findings** — the ranked, deduplicated list from step 6, using the
   schema fields from [reference/finding-schema.md](reference/finding-schema.md).
4. **Critic agreement and disagreement** — where multiple critics independently converged (cite
   which), and every retained `dissenting_critics` conflict stated plainly with both positions.
5. **Strengths worth preserving** — concrete, specific credit; not filler.
6. **Recommended repair sequence** — a short, dependency-ordered list a later `/polish` or
   `/cleanup` invocation could execute, using each finding's `repair_scope`.
7. **Missing evidence and failed/omitted critics** — every unavailable tool, missing screenshot
   viewport, unknown design direction, and every critic that failed, timed out, or was skipped by
   scope/depth — stated plainly, not silently absorbed into the findings above.
8. **Explicit statement that no source was modified** — plainly, not softened into "no significant
   changes."

Never claim a screenshot, browser check, subagent critic, or MCP call happened when it didn't.
