---
name: copy
description: Bounded interface-language refinement for an existing UI in Universal — headings, supporting text, CTA labels, navigation labels, form labels and help text, empty states, errors, and confirmations. Preserves product meaning, factual claims, brand voice, and application behavior; edits the message catalog instead of JSX when an i18n system exists; never changes identifiers, test selectors, translation keys, or route names; flags legally significant copy instead of silently rewriting it.
---

# /copy

Improve the interface language of an existing UI: headings, supporting/body copy, CTA labels,
navigation labels, form labels and help text, empty states, error messages, and confirmations.
Improve clarity, concision, tone, and consistency of the _words_. Do not touch typographic form
(font, scale, weight, line-height, letter-spacing) — that is `/typography`'s job, not this one.
Source mutation only happens through an explicit `/copy` invocation — never invoke this skill's
mutation steps on your own initiative.

`$ARGUMENTS` optionally names a page, route, component, copy surface (for example "the pricing
page CTAs", "onboarding empty states", "form validation errors in `SignupForm`"), and/or a tone
directive (e.g. "make the empty states friendlier", "shorten the nav labels"). If empty, infer the
target only when the active conversation identifies one page, route, or component unambiguously,
and state that inference before editing. Otherwise ask the user to choose the target and do not
mutate files until they answer.

## Non-negotiable boundaries

Preserve exactly: product meaning, factual claims, brand voice, application behavior, business
logic, state, routes, APIs, and any unrelated in-progress changes already in the working tree.

Do not:

- invent or alter factual or product claims — pricing, plan limits, feature capabilities,
  guarantees, SLAs, compliance/legal text, or any other claim a rewrite could accidentally change
  the truth value of. If a claim reads as stale, unclear, or wrong, flag it in the report; do not
  "fix" it by guessing at the correct number or scope;
- change identifiers, test selectors (`data-testid`, `id`, `name`, `aria-describedby` targets,
  etc.), translation/message keys, or route names while changing the display string they resolve
  to. The key stays; only the string it maps to (or the JSX text node) changes;
- edit JSX/template string literals directly for an app that already has an i18n/message-catalog
  system in place (see step 2) — edit the catalog entry instead, never bypass it;
- silently rewrite copy that appears legally, contractually, or compliance-significant (terms of
  service, privacy language, consent/opt-in text, refund/cancellation policy, security or
  compliance claims, anything under a `/legal`, `/terms`, `/privacy` route or similarly named
  file). Flag it with a specific reason instead and leave it unchanged unless the user explicitly
  authorizes that edit;
- change an accessible name (visible label text, `aria-label`, `alt`, `title`) so it drifts out of
  sync with its paired visible label, or vice versa — when one changes, update the other so they
  still match or still correctly describe the control;
- restyle, resize, reflow, recolor, or otherwise change typographic/visual form — hand that to
  `/typography`, `/polish`, or `/layout` instead;
- add feature functionality, new copy surfaces, or content sections that don't already exist;
- add dependencies;
- run destructive Git commands, or stage/commit/push/open a PR unless the user explicitly asks.

If a requested change would cross into factual/legal territory or visual-form territory, say so
and scope it back, or ask the user to confirm before proceeding.

## Boundary against neighboring commands

- **`/typography`** owns typographic _form_ — font choice, type scale, weight, line-height,
  measure, letter-spacing. `/copy` owns the _words_ inside that form. A request like "make the
  headline bigger" is `/typography`; "make the headline clearer" is `/copy`. If both are wanted,
  run them separately and say so.
- **`/polish`** and **`/layout`** own spacing, hierarchy, and composition; they may reflow content
  around copy but do not rewrite it.
- **`/audit`** and **`/review-ui`** may flag copy problems as findings, but they are read-only and
  do not fix them — `/copy` is where an authorized copy fix is applied.
- **`/accessibility`** owns the accessibility audit/repair pass broadly; `/copy` specifically keeps
  accessible names in sync with visible labels as a side effect of any label it touches, but does
  not run a full accessibility pass.
- **`/consistency`** flags cross-surface drift generally; `/copy` is the place a batch of
  inconsistent labels/tone actually gets rewritten once selected.

## Workflow

1. **Parse scope.** Resolve `$ARGUMENTS` into a concrete target (files/routes/components), the
   copy surfaces in scope (headings, body, CTAs, nav, form labels/help text, empty states, errors,
   confirmations), and any tone directive. State the resolved scope back before touching anything.

2. **Detect the i18n setup before editing anything.** Grep the target and its imports for an
   existing message-catalog/i18n system (e.g. `react-intl`, `i18next`, `next-intl`, a local
   `messages/*.json` or `locales/*` directory, or a project-local translation helper). If one
   exists, all copy edits in this pass go into the catalog entry the component references, never
   into the JSX/template literal directly, and the message key itself is left untouched. If no such
   system exists, copy lives inline in JSX/template strings and is edited there directly. State
   which mode applies before continuing.

3. **Inspect source and current copy inventory.** Read the target files (and, per step 2, their
   catalog entries) and list every user-facing string in scope with its role (heading, CTA, nav
   label, form label, help text, empty state, error, confirmation) and its file:line or catalog
   key. Note every identifier, test selector, `aria-*` attribute, and route name touching that
   string so it is never touched by the rewrite.

4. **Retrieve Universal's taste guidance for copy.** Call `get_taste_profile` when the MCP is
   connected, and read its `principles` filtered to `appliesTo: "copy"` plus any relevant
   `antiPatterns`, per
   [`docs/MCP_REFERENCE.md#get_taste_profile`](../../../docs/MCP_REFERENCE.md#get_taste_profile).
   Call `get_design_rules` with category `general` for supporting implementation constraints if
   useful. `review_implementation` is a source/composition reviewer, not a copy linter — call it
   only if the copy change also touches JSX structure worth re-checking, and do not treat its
   silence as a copy sign-off. If the MCP is unavailable, say so explicitly and fall back to the
   checklist in [reference/copy-checklist.md](reference/copy-checklist.md).

5. **Classify every string in scope before rewriting.** Use
   [reference/copy-checklist.md](reference/copy-checklist.md)'s three buckets:
   - **Rewritable** — interface language with no factual/legal weight (nav labels, generic CTAs,
     help text phrasing, empty-state tone, error phrasing that doesn't state a policy or number).
   - **Fact-bearing** — contains a number, capability, guarantee, price, limit, or claim. May only
     be rewritten for clarity/tone while preserving the exact claim; if the claim itself looks
     wrong or stale, flag it instead of silently changing it.
   - **Flag-only** — legally/contractually/compliance-significant copy, or anything the agent isn't
     confident is safe to touch. Never rewritten in this skill; always reported with a reason.

6. **Produce a proposed rewrite set before editing.** For each _rewritable_ or _fact-bearing_
   string: file/key, current text, proposed text, and the reason (clarity, concision, tone
   consistency, redundancy). For every _flag-only_ string: file/key, current text, and the specific
   reason it's flagged rather than rewritten. Keep this list bounded to the resolved scope.

7. **Implement only the approved rewritable/fact-bearing set.** Edit the catalog entry or the JSX
   text node per step 2's mode. When a visible label's text changes, update any `aria-label`,
   `alt`, or `title` that duplicates or paraphrases it so the accessible name stays in sync. Leave
   every identifier, test selector, translation key, and route name exactly as found.

8. **Run checks.** From the repository root, run what's applicable to the changed workspace:
   `pnpm format:check`, `pnpm typecheck`, and `pnpm --filter <workspace> test` (or `pnpm test` if
   scope is broad) for changed packages/apps. If formatting is needed, format only the files
   changed by this `/copy` run, then inspect the diff and reject unrelated formatter edits. Report
   exact commands and outcomes; do not claim a check passed without having run it.

9. **Verify nothing structural moved.** Diff the changed files and confirm only string literals
   (or catalog entries) changed — no identifiers, selectors, keys, routes, imports, or JSX
   structure were touched as a side effect. If a test asserts on exact copy text, note that it will
   need updating and either update it (if in scope) or flag it as a follow-up.

10. **Report** using the format below.

## Required final report

Always output these eight sections, in order:

1. **Scope** — resolved target(s), copy surfaces in scope, tone directive if any, and which i18n
   mode applied (catalog-based or inline JSX).
2. **Copy inventory and classification** — every string considered, its role, and its bucket
   (rewritable / fact-bearing / flag-only).
3. **Changes made** — one line per string: file/key, before, after, reason.
4. **Flagged and left unchanged** — every flag-only string with the specific reason it wasn't
   touched, and every fact-bearing string whose underlying claim looked questionable but was left
   as-is.
5. **Accessible names kept in sync** — every `aria-label`/`alt`/`title` updated alongside a visible
   label, or an explicit statement that none needed updating.
6. **Behavior and identifiers preserved** — confirmation that no identifier, test selector,
   translation key, or route name was altered.
7. **Validation performed** — exact commands run and their results (or "not run: <reason>").
8. **Remaining limitations** — anything out of scope, MCP unavailability, or deferred flags.

Never claim an MCP call, check, or diff inspection happened when it didn't. State tool
unavailability as a limitation rather than omitting the step silently.
