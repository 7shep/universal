---
name: critique
description: Read-only, evidence-led answer to one focused design question about an existing route or component in Universal — grounded in the actual source, whatever rendered/visual evidence is available, and the established design direction when one exists. Produces a direct answer with concise observations and recommendations. Never edits, formats, stages, commits, or pushes anything, and never answers from memory alone.
---

# /critique

Answer **one specific design question** with evidence, concisely. **This skill is strictly
read-only.** Never edit, format, stage, commit, or push any file — not even a "trivial" fix. If the
question reveals something worth fixing, name the fix and point to `/polish` or `/cleanup`; do not
apply it yourself.

`$ARGUMENTS` is the question, optionally combined with a route/component/scope it applies to (for
example `Is the hero CTA prominent enough on the landing page?`, or `apps/studio/src/routes/Preview
— does the empty state match the rest of the app's tone?`). If `$ARGUMENTS` is empty, or contains
no answerable design question, ask for one rather than guessing. If it names several unrelated
questions, or asks for a general sweep ("review everything," "audit this page"), say plainly that
`/critique` answers one focused question at a time and point to `/audit` (comprehensive prioritized
sweep) or `/review-ui` (multi-perspective coordinated review) instead — do not silently expand
scope to cover everything asked.

## Non-negotiables

- Read-only: no `Edit`, `Write`, `NotebookEdit`, formatter, `git add`, `git commit`, or `git push`
  during this skill, under any circumstance, even for a one-line fix.
- Never answer from memory or general web knowledge about "good design." Every answer must be
  grounded in something actually inspected in this invocation — the current source, evidence
  gathered in step 2, or an MCP response from step 3. If none of that evidence bears on the
  question, say so and decline to speculate rather than filling the gap with an assumption.
- Explicitly state, in the final report, whenever a relevant evidence type was unavailable —
  screenshots (no capture tooling, or capture failed), an established design direction/brief/plan
  (none found in the repo or conversation), or the MCP (not connected). Absence of evidence is not
  itself a defect in the target UI; report it as an evidence gap, not a finding.
- Never claim a viewport, screenshot, or visual check happened when it didn't. Distinguish source
  inspection from real visual evidence at every point in the answer.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not invent tool names or request fields, and do not attempt the
  stateful Phase 2 Art Director sequence (`start_art_direction` and friends) — that belongs to
  `/art-direct`, and critique has no session to resume.
- Stay scoped to what the question needs. Do not read unrelated parts of the monorepo, and do not
  expand into a full audit of the surface just because you're already looking at it.

## Scope boundaries against neighboring commands

- **`/audit`** — a comprehensive, prioritized sweep across every design dimension for a scope.
  Use it when the request is "what's wrong with this," not "does this one thing work." `/critique`
  answers a single named question; it does not attempt full coverage.
- **`/review-ui`** — a coordinated multi-perspective review (typography, composition, accessibility,
  brand, motion, responsive, component vocabulary, implementation craft critics) synthesized into
  one ranked report. Use it when several angles need reconciling. `/critique` runs no critic
  panel — it is one focused pass answering one question.
- **`/compare`** — diffing an implementation against a reference (a prior screenshot, a competitor,
  a design file). Use it when the question is fundamentally "how does this differ from X." A
  `/critique` question may reference a design direction or brief for context, but it is not
  performing a structured diff against a reference artifact.
- **`/polish` / `/cleanup`** — both mutate. `/critique` never does; it names the fix and stops.

## Workflow

### 1. Resolve the question and scope

Parse `$ARGUMENTS` into the specific design question and, if named, the route/component/directory
it applies to. If no scope is named but the question implies one that can be found unambiguously
(a single obvious route/component in a small repository area), resolve it and state the assumption;
otherwise ask. State the resolved question and scope back before reading anything.

### 2. Gather only the evidence the question needs

Collect whatever of the following already exists and actually bears on the question — do not
manufacture any of it, and do not over-collect beyond what answering requires:

- **Source.** The specific component(s)/file(s) implicated by the question, their direct imports,
  and any co-located or imported CSS/design tokens the question turns on. Use `Glob`/`Grep` to
  locate them if the exact file isn't already known.
- **Existing screenshots.** Search the repository and any conventional output locations (e.g.
  `artifacts/`, a screenshots directory referenced by the project, or paths the user names) for
  images relevant to the question.
- **Fresh screenshot(s)**, only if capture tooling is already available and wired up in this
  environment (for example the `/browse` skill, or a Playwright/Puppeteer setup already present in
  the repo) — invoke it read-only (navigate + screenshot) against an already-running or trivially
  startable dev server, and only for the viewport(s) the question needs. If no such tooling exists,
  or capturing it would require setting up new infrastructure, do not fake it: record "no screenshot
  tooling available" and continue with source-only inspection.
- **Design context**, if it is already committed or already present in the conversation: a design
  plan, creative brief, selected direction, taste profile export, or written design rules. Universal
  does not persist Art Director session state to disk by default, so absence of these is normal, not
  a gap to apologize for.

Every piece of evidence cited in the final answer must trace back to something actually inspected
in this step — a file path, a screenshot location, or an MCP response.

### 3. Consult Universal's design intelligence, if relevant to the question

Call, when the MCP is connected and the question turns on a design-policy judgment:

- `get_design_rules` with the category closest to the question (`general`, `website`, `typography`,
  `composition`, `imagery`, or `motion`) — cite its `categoryPrinciples`, `antiPatterns`, or
  `implementationConstraints` when they bear directly on the answer.
- `get_taste_profile` for the active taste policy's `principles` and `antiPatterns` when the
  question is about generic-pattern avoidance or direction alignment — cite the specific principle
  or anti-pattern ID.
- `review_implementation` with the implicated files' current (unmodified) content and any visual
  evidence from step 2, shaped per
  [`docs/MCP_REFERENCE.md#review_implementation`](../../../docs/MCP_REFERENCE.md#review_implementation),
  only if the question is well served by a full implementation critique rather than a narrower read.

Skip a tool call that has nothing to do with the specific question being asked — this is not an
`/audit`, and every call should earn its place in the answer.

If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles for anything the question needs that would otherwise have come from MCP policy. A fact
you locally verified regardless of MCP (an explicit `outline: none` with no replacement focus
treatment, a contrast ratio computed from the actual foreground/background colors, confirmed
overflow/clipping at an inspected viewport) still counts as solid evidence without MCP. Only the
parts of the answer that depend on Universal's design-policy judgment (taste principles,
anti-patterns, direction alignment) must be marked as unsupported by MCP when it isn't connected.

### 4. Formulate the answer

Write one direct answer to the question — not a general commentary on the surface. See
[reference/answer-format.md](reference/answer-format.md) for the confidence rubric and a worked
example. The answer should:

- state a clear position (yes/no/partial, or the specific observation asked for) before the
  supporting detail;
- ground every claim in evidence gathered in steps 2-3, cited concretely (file/line, screenshot
  location, or MCP finding/principle ID);
- include a scoped, actionable recommendation only if the answer implies one — do not pad a
  question that has a clean "yes, and here's why" answer with unrequested extra suggestions;
- name the smallest tool that would apply a suggested fix (`/polish`, `/cleanup`, `/art-direct`,
  etc.) rather than attempting or describing the fix itself.

If the available evidence is insufficient to answer responsibly (no relevant source found, no
screenshot tooling for a purely visual question, no design direction for a direction-alignment
question), say so plainly instead of guessing — a stated "cannot answer confidently because X is
unavailable" is a valid and expected outcome of this skill, not a failure to avoid.

### 5. Report

Use exactly the structure in [Required final output](#required-final-output) below. Do not add a
"fixes applied" section — there are none.

## Required final output

1. **Question and resolved scope** — the question as restated/clarified, and the route/component/
   file(s) it was evaluated against.
2. **Evidence inspected** — files read; screenshots found/captured (with paths) or explicitly
   absent; design-context artifacts found or explicitly absent; which MCP tools were called and
   which were unavailable or skipped as not relevant to this question.
3. **Direct answer** — the clear position, stated before the supporting detail.
4. **Evidence-backed reasoning** — the specific evidence supporting the answer, each item traceable
   to step 2 or 3.
5. **Recommendation, if any** — scoped and actionable, naming the follow-up command
   (`/polish`, `/cleanup`, `/art-direct`, `/audit`, `/review-ui`, `/compare`) when the fix or further
   work exceeds a one-line note. Omit this section entirely if the question didn't call for one.
6. **Confidence and evidence gaps** — how confident this answer is given what was actually
   available, and every relevant evidence type that was unavailable (screenshots, design direction,
   MCP), stated plainly rather than silently absorbed into the answer above.
7. **Explicit confirmation that no source files were modified during this critique.**

Never soften item 7 into "no significant changes" — it must state plainly that nothing was edited,
formatted, staged, committed, or pushed. Never claim a screenshot, browser check, or MCP call
happened when it didn't.
