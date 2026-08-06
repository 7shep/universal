# Fix budget and readiness rubric

This reference is shared by both installed copies of `/final-pass`
(`.agents/skills/final-pass/SKILL.md` and `.claude/skills/final-pass/SKILL.md`). Keep it identical
in both trees.

## Fix budget

`/final-pass` may apply real fixes across its delegated phases, but the whole run — not each
phase individually — is bounded by one shared budget:

- **Files:** at most **10** source files edited across every delegated phase combined.
- **Change size:** at most roughly **250** changed lines across every delegated phase combined,
  counting delegate-reported diffs and any change `/final-pass` makes directly. Formatter-only
  whitespace/quote changes from `pnpm format` do not count against this line budget, but the file
  count for files touched only by the formatter still does.
- **Dependencies:** zero new runtime or dev dependencies. A finding that requires adding a
  dependency is out of budget by definition — escalate it, do not add the dependency.
- **Structural scope:** no new routes/pages, no new top-level components, no change to the
  selected design direction, information architecture, or business logic, regardless of remaining
  budget. These are always escalated, never treated as "in budget."

### Tracking consumption

Keep a running tally as each delegated phase reports files touched and approximate changed lines.
State the running total after each mutation-capable phase in the phase-by-phase section of the
report. When a phase's proposed fixes would push the run over budget:

1. Apply the remaining budget to the **highest-severity** items first (ties broken by user-facing
   impact, then by how cheaply they fix within the remaining budget).
2. Stop applying fixes in that phase and every later phase once the budget is exhausted.
3. List every deferred item explicitly in the "Escalations and deferred items" report section,
   with its severity, source phase, and an estimate of the additional files/lines it would need.

Never silently raise the budget to "finish the job." If the user's request explicitly authorizes a
larger budget for this run, say so in the resolved-scope statement and use the user's stated number
instead of the defaults above — but the default always applies unless the user overrides it in
`$ARGUMENTS` or in conversation.

## Delegate availability

Before phase 1, confirm each delegate command exists by checking for
`.agents/skills/<command>/SKILL.md` (or the equivalent `.claude/skills/<command>/SKILL.md`) in this
repository, and note the `Skill` tool result of actually invoking it. A command name appearing in
`AGENTS.md`'s Phase 5 list is not sufficient evidence it is implemented — only a present `SKILL.md`
and a successful invocation count.

If a delegate is unavailable (file missing, or the `Skill` tool call errors/rejects):

- **Read-only delegates** (`/audit`, `/compare`): perform a narrow, clearly-labeled fallback
  directly — read the same scoped source `/final-pass` already gathered, and call
  `get_design_rules` / `get_taste_profile` / `review_implementation` directly if the Universal MCP
  is connected, per [`docs/MCP_REFERENCE.md`](../../../../docs/MCP_REFERENCE.md). Label every
  resulting observation `final-pass fallback (not <command>)` — never present it as that command's
  actual output.
- **Mutation-capable delegates** (`/responsive`, `/accessibility`, `/states`, `/performance`,
  `/consistency`, `/polish`): do **not** improvise a substitute mutation pass. Record the dimension
  as "not exercised this run," carry it into the readiness verdict as a coverage gap, and let it
  push the verdict toward `ready-with-caveats` or `not-ready` depending on how load-bearing that
  dimension is for the reviewed surface (for example, an unavailable `/accessibility` on a
  form-heavy surface is more likely to force `not-ready` than on a static content page).

Either way, never fabricate a delegate's findings, fixes, scores, or file list. A degraded phase is
reported as degraded.

## Readiness verdict rubric

- **`ready`** — every phase either ran to completion or was a read-only phase whose absence does
  not affect this surface; every real repository check (`pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`) passed; no unresolved high-severity/blocking finding
  remains; the fix budget was not exceeded; no unavailable mutation-capable delegate covers a
  dimension load-bearing for this surface.
- **`ready-with-caveats`** — every real repository check passed and no unresolved high-severity
  finding blocks release, but at least one of: a delegate was unavailable and its dimension is
  judged non-blocking for this surface; medium/low-severity findings were deferred within budget;
  the fix budget was exhausted before every high-severity item was reachable, but the remaining
  items are judged non-blocking; a re-verification step could not be performed exactly as designed.
  Enumerate every caveat.
- **`not-ready`** — any real repository check failed; or an unresolved high-severity/blocking
  finding remains (including one deferred solely because the budget ran out); or an unavailable
  mutation-capable delegate covers a dimension judged load-bearing for this surface; or the changes
  needed to reach `ready` would require exceeding the fix budget or crossing into redesign scope
  without the user's authorization.

State the verdict once, at the top of the readiness section, followed by the enumerated blocking
items (empty list if `ready`).
