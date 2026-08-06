# `/copy`

Bounded interface-language refinement for an existing route, page, or component. `/copy` improves
the _words_ users read — headings, supporting/body text, CTA labels, navigation labels, form
labels and help text, empty states, error messages, and confirmations — without changing what the
product does, what it claims, or how it looks.

Skill sources: [`.agents/skills/copy/SKILL.md`](../../.agents/skills/copy/SKILL.md) and
[`.claude/skills/copy/SKILL.md`](../../.claude/skills/copy/SKILL.md) (identical body; the
`.claude` variant adds `argument-hint` and `disable-model-invocation: true`). Classification
rubric: [`.agents/skills/copy/reference/copy-checklist.md`](../../.agents/skills/copy/reference/copy-checklist.md).

## What it does

1. Resolves scope (page/route/component, copy surfaces, tone directive) from `$ARGUMENTS`.
2. Detects whether the target already uses an i18n/message-catalog system, and edits the catalog
   entry instead of the JSX when one exists.
3. Inventories every in-scope user-facing string with its role and location.
4. Pulls Universal's copy-relevant taste guidance via `get_taste_profile` (principles filtered to
   `appliesTo: "copy"`) and, when useful, `get_design_rules` category `general`, per
   [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md#get_taste_profile).
5. Classifies every string as **rewritable**, **fact-bearing**, or **flag-only** before touching
   anything (see the checklist reference above).
6. Proposes a rewrite set, applies only the rewritable/fact-bearing changes, keeps accessible names
   (`aria-label`, `alt`, `title`) in sync with the visible labels they duplicate, and leaves
   identifiers, test selectors, translation keys, and route names untouched.
7. Runs `pnpm format:check` / `pnpm typecheck` / scoped `pnpm test`, diffs the result to confirm
   only string content moved, and reports.

## When to use it vs. neighboring commands

- **vs. `/typography`** — `/typography` owns typographic _form_: font choice, type scale, weight,
  line-height, measure, letter-spacing. `/copy` owns the _words_ rendered inside that form. "Make
  the headline bigger" is `/typography`; "make the headline clearer" is `/copy`. Run them
  separately if a change needs both.
- **vs. `/polish` / `/layout`** — those own spacing, hierarchy, and composition. They may reflow
  content around copy but do not rewrite it.
- **vs. `/audit` / `/review-ui`** — both are read-only and may flag copy problems as findings, but
  neither fixes them. `/copy` is where an authorized copy fix is actually applied.
- **vs. `/accessibility`** — `/accessibility` owns the accessibility audit/repair pass broadly.
  `/copy` only keeps accessible names in sync with visible labels as a side effect of a label it
  already touched; it does not run a full accessibility pass.
- **vs. `/consistency`** — `/consistency` detects cross-surface drift generally (including tone or
  label inconsistency) and repairs only selected items. `/copy` is the place a batch of
  already-identified inconsistent labels or tone actually gets rewritten.
- **vs. `/cleanup`** — `/cleanup` removes redundant/obsolete code and styling; it does not rewrite
  copy for clarity or tone.

## Invocation examples

```text
/copy Tighten the CTA labels on the pricing page.
/copy apps/studio/src/routes/Onboarding — make the empty states friendlier.
/copy Review and shorten the nav labels in packages/ui/src/Nav.tsx.
/copy Rewrite the form validation error text in SignupForm for clarity.
/copy Consolidate confirmation-message tone across the settings routes.
```

If `$ARGUMENTS` is empty and no single target is unambiguous from the conversation, the skill asks
which scope to edit instead of guessing.

## Mutation behavior

`/copy` mutates source, but **only** on an explicit `/copy` invocation — it never rewrites copy as
a side effect of another command, and it never runs unattended.

What it may change:

- The text of headings, body/supporting copy, CTA labels, navigation labels, form labels and help
  text, empty-state copy, error messages, and confirmations, when classified **rewritable** or
  **fact-bearing** (fact-bearing edits must preserve the exact claim; only phrasing may change).
- A message-catalog entry's value for the resolved locale, when an i18n system already exists —
  never the catalog key, never other locales' entries.
- An `aria-label`, `alt`, or `title` that duplicates/paraphrases a visible label it just changed,
  so the accessible name stays in sync.

What it never changes:

- Factual or product claims themselves (pricing, limits, capabilities, guarantees, legal text) —
  it may reword around a claim but never alters the claim's substance, and flags anything that
  looks wrong or stale instead of guessing at a correction.
- Identifiers, test selectors (`data-testid`, `id`, `name`, etc.), translation/message keys, or
  route names.
- Legally, contractually, or compliance-significant copy (terms, privacy, consent, refund/billing
  policy, security/compliance claims) — always flagged, never silently rewritten, unless the
  invoking user explicitly authorizes that specific edit in the same turn.
- Typographic form, layout, spacing, or any other visual property.
- Business logic, state, routes, public APIs, or unrelated in-progress changes already in the
  working tree.

## Scope and limitations

- Requires a resolvable target; does not operate unscoped across the whole repository.
- `get_taste_profile`/`get_design_rules` calls require the Universal MCP connection; if
  unavailable, the skill states that explicitly and falls back to
  [`reference/copy-checklist.md`](../../.agents/skills/copy/reference/copy-checklist.md).
  `review_implementation` is a source/composition reviewer, not a copy linter, so it is not treated
  as a copy sign-off.
- Does not translate content into other locales and does not introduce a new i18n system — both
  are out of scope even when a translation gap is noticed; the skill reports the gap instead.
- Does not resolve genuinely ambiguous factual claims (e.g. conflicting numbers across two
  surfaces) — it flags the conflict for a human decision rather than picking one side.
- A test asserting on exact copy text may need a follow-up update; the skill notes this rather than
  silently editing unrelated test files outside its resolved scope.

## Verification

Run from the repository root or scoped to the touched workspace:

```bash
pnpm format:check
pnpm typecheck
pnpm --filter <workspace> test   # or `pnpm test` if scope is broad
```

`/copy` also diffs its own changes to confirm only string literals or catalog entries moved — no
identifiers, selectors, keys, routes, imports, or JSX structure changed as a side effect of the
rewrite.

To validate changes to the skill itself (not a `/copy` run against product code), walk the three
buckets in
[`reference/copy-checklist.md`](../../.agents/skills/copy/reference/copy-checklist.md) against a
small fixture containing one rewritable string, one fact-bearing string, and one flag-only string,
and confirm the skill's classification and report match the expected bucket for each — the same
approach `cleanup`'s
[`test-fixtures/VALIDATION.md`](../../.agents/skills/cleanup/test-fixtures/VALIDATION.md) uses for
its classification workflow.
