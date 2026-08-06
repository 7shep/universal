---
name: final-pass
description: Orchestrates the final release-quality review of an existing Universal interface across visual polish, responsiveness, accessibility, interaction states, performance, build health, and alignment with the selected direction — by delegating to /audit, /responsive, /accessibility, /states, /performance, /consistency, /compare, and /polish, applying bounded fixes within a shared budget, re-verifying affected areas, and producing a documented release-readiness verdict.
---

# /final-pass

Run the last review pass before an interface is considered release-ready. `/final-pass` does not
reimplement design judgment or repair logic itself — it is the conductor: it delegates each
dimension to the command that owns it, tracks a single shared fix budget across every delegated
mutation, runs the repository's real checks, and reports one release-readiness verdict with the
blocking items enumerated. It never fabricates what a delegate command found or fixed.

`$ARGUMENTS` optionally names: the target route/component/directory to review, the selected design
direction or reference to check alignment against, which of the eight phases to include or skip
(default: all eight), a fix-budget override (see
[reference/fix-budget.md](reference/fix-budget.md)), and whether this is a dry run (report only,
apply no fixes). If the target is empty or ambiguous, ask before reading broadly — do not run a
final pass over the whole repository by guesswork.

## Non-negotiable boundaries

- **This is a bounded final pass, not a redesign.** The shared fix budget in
  [reference/fix-budget.md](reference/fix-budget.md) caps every mutation this run makes, across
  every delegated phase combined. When reaching `ready` would require exceeding that budget or
  touching structural scope (new routes/pages/components, a different design direction,
  information architecture, or business logic), stop, escalate the remainder to the user with
  enumerated specifics, and report the verdict honestly as `ready-with-caveats` or `not-ready`
  rather than quietly finishing the work.
- **Never fabricate a delegate command's output.** Every finding, fix, file list, or score
  attributed to `/audit`, `/responsive`, `/accessibility`, `/states`, `/performance`,
  `/consistency`, `/compare`, or `/polish` must come from an actual invocation of that command in
  this run. If a delegate is unavailable, follow
  [reference/fix-budget.md#delegate-availability](reference/fix-budget.md#delegate-availability) —
  do not guess at what it would have said.
- **Preserve exactly**: business logic, state, routes, APIs, data flow, user-visible functionality
  outside the fixed defects, accessibility semantics beyond what a delegate explicitly repairs, and
  any unrelated in-progress changes already in the working tree.
- **Never run destructive Git commands**, and never stage, commit, push, or open a PR unless
  `$ARGUMENTS` explicitly asks for it — this skill's job ends at the readiness report.
- **Real checks only.** Section 9's `pnpm format:check` / `pnpm lint` / `pnpm typecheck` /
  `pnpm test` / `pnpm build` results must be the actual output of running those commands in this
  worktree. Never mark a check `passed` without having run it in this session.
- A missing or failed delegate must not silently pass the run — it becomes a reported gap that
  factors into the verdict per [reference/fix-budget.md#readiness-verdict-rubric](reference/fix-budget.md#readiness-verdict-rubric).

## Workflow

### 0. Resolve scope and budget

Parse `$ARGUMENTS` into: target, direction/reference (if any), phases to run (default: all eight),
fix-budget override (default: the standard budget in
[reference/fix-budget.md](reference/fix-budget.md)), and dry-run flag. State the resolved scope
back before invoking anything. If a phase is explicitly excluded by the user, mark it "excluded by
request" in the report rather than "unavailable" — the two are different and must not be conflated
in the verdict.

### 1. Confirm delegate availability

For every phase in scope, check whether its delegate command exists in this repository (a present
`SKILL.md` under `.agents/skills/<command>/` or `.claude/skills/<command>/`) before relying on it.
Record availability for all eight up front so later phases don't discover a gap mid-run. Follow
[reference/fix-budget.md#delegate-availability](reference/fix-budget.md#delegate-availability) for
what to do with an unavailable one.

### 2. Phase — `/audit` (baseline evidence, read-only)

Invoke `/audit` scoped to the resolved target to get a prioritized, evidence-led baseline before
anything is touched. This baseline is the reference point every later phase's "did it get better"
comparison uses. Read-only — expect no file changes from this phase.

### 3. Phase — `/responsive`

Invoke `/responsive` scoped to the target and the viewports implied by `$ARGUMENTS` (default both
desktop and mobile). This phase mutates within its own scope; count its reported files/lines
against the shared budget.

### 4. Phase — `/accessibility`

Invoke `/accessibility` scoped to the target. `/accessibility` only repairs when explicitly
requested — `/final-pass` explicitly requests repair of high-severity/blocking accessibility
findings only (not every low-severity suggestion), so the accessibility surface is actually
release-gated rather than merely audited. Count its reported changes against the shared budget.

### 5. Phase — `/states`

Invoke `/states` scoped to the target to complete missing interaction/application states (hover,
focus-visible, active, loading, empty, error, disabled) surfaced by the baseline audit or by
`/states`' own inspection. Count against budget.

### 6. Phase — `/performance`

Invoke `/performance` scoped to the target, requesting only evidence-backed, user-visible
performance repairs (not speculative micro-optimizations). Count against budget.

### 7. Phase — `/consistency`

Invoke `/consistency` scoped to the target to detect design-system drift. `/consistency` repairs
only selected items — `/final-pass` selects items that are blocking-severity for release
consistency (a component visibly diverging from the established token/pattern vocabulary), and
defers cosmetic-only drift to the "Escalations and deferred items" report section. Count against
budget.

### 8. Phase — `/compare` (read-only)

If `$ARGUMENTS` or the audit baseline identifies a selected design direction, creative brief, design
plan, or other reference, invoke `/compare` to check the current implementation against it.
Read-only — expect no file changes. If no reference exists, say so plainly and skip this phase
without treating its absence as a delegate failure (there is nothing to compare against, which is a
scope fact, not a gap).

### 9. Phase — `/polish`

Invoke `/polish` last, scoped to the target, to reconcile whatever bounded visual-craft findings
remain after the more specialized phases (hierarchy, typography, spacing, alignment, coherent
component vocabulary) — using only whatever budget remains after phases 3-7. If the budget is
already exhausted, run `/polish` in report-only intent (state the remaining findings it would
address) rather than letting it push the run over budget.

### 10. Run the repository's real checks

From the worktree root, run and report the exact commands and their real output:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If `pnpm format:check` fails only on files this run touched, run `pnpm format` and re-check; if it
also fails on files this run did not touch, say so and leave those files alone. Any other real
failure (`lint`, `typecheck`, `test`, `build`) is addressed within the fix budget if it's a direct
consequence of this run's changes, or reported as a pre-existing failure and factored into the
verdict if it predates this run — do not silently absorb either kind into "passed."

### 11. Re-verify affected areas

Re-run the read-only delegates most relevant to what actually changed — typically a scoped
`/audit` re-pass and, when a direction/reference exists, a scoped `/compare` re-pass — limited to
the files this run touched. This is a targeted re-check, not a full re-run of every phase. State
plainly what was re-verified and what was not (for example, a `/responsive` fix was applied but no
fresh viewport screenshot was recaptured to confirm it, if screenshot tooling is unavailable).

### 12. Determine the verdict and report

Apply [reference/fix-budget.md#readiness-verdict-rubric](reference/fix-budget.md#readiness-verdict-rubric)
to reach exactly one of `ready`, `ready-with-caveats`, or `not-ready`, then produce the final report
below.

## Required final report

Always output these ten sections, in order:

1. **Request and scope** — resolved target, direction/reference (if any), phases included/excluded
   by request, fix budget in effect (default or overridden), dry-run or live.
2. **Delegate availability** — all eight commands, each marked available/unavailable, with the
   fallback taken for any unavailable one.
3. **Phase-by-phase results** — for each phase actually run: delegate invoked, summary of its
   findings/fixes, files and approximate lines it changed, and the running fix-budget total after
   that phase. For phases skipped or degraded, say so here rather than folding it into a later
   section.
4. **Files changed and why** — the complete list across every phase, deduplicated, one line per
   file.
5. **Behavior preserved** — logic/state/routes/APIs/accessibility semantics confirmed unchanged
   outside the fixed defects.
6. **Real checks run** — exact `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test` /
   `pnpm build` commands and their actual results.
7. **Re-verification of affected areas** — what was re-checked in step 11, and what could not be
   (e.g., missing screenshot tooling).
8. **Release-readiness verdict** — `ready`, `ready-with-caveats`, or `not-ready`, with every
   blocking item enumerated (empty list only for `ready`).
9. **Escalations and deferred items** — anything that exceeded the fix budget, crossed into
   redesign/structural scope, or was otherwise deliberately left for the user, each with severity
   and source phase.
10. **Remaining limitations** — unavailable delegates, unresolved findings, tooling gaps, and any
    assumption made about scope or budget, stated plainly.

Never claim a delegate invocation, screenshot, browser check, or repository command happened when
it didn't.

## Known limitations

- `/final-pass` depends on eight other in-progress Phase 5 commands existing and behaving as
  documented. Until all of them ship, expect frequent "unavailable" entries in section 2 — this is
  expected during the Phase 5 rollout, not a bug in `/final-pass` itself.
- The shared fix budget is a heuristic guardrail, not an exact diff-size guarantee; delegates report
  approximate files/lines, and `/final-pass` sums those approximations rather than computing an
  exact combined diff.
- `/final-pass` does not itself capture screenshots or call Universal MCP tools outside the
  documented fallback in [reference/fix-budget.md](reference/fix-budget.md) — all visual evidence
  and MCP-backed findings come from the delegated commands it invokes.
