# `/copy` classification checklist

Used by `/copy` step 5 to sort every in-scope string into exactly one bucket before any rewrite is
proposed. When in doubt between two buckets, choose the more conservative one (flag-only over
fact-bearing, fact-bearing over rewritable).

## Rewritable

Interface language with no factual or legal weight. Safe to rewrite for clarity, concision, and
tone consistency as long as meaning and behavior are unchanged.

- Navigation labels ("Docs" vs. "Documentation")
- Generic CTA labels ("Get started", "Continue", "Learn more")
- Section headings and supporting/body copy that describe the product without a specific number,
  guarantee, or capability claim
- Form field labels and placeholder text that don't state a policy (e.g. "Email address")
- Help/hint text phrasing ("We'll only use this to send order updates" is fact-bearing — see
  below; "Enter the address on file" is rewritable)
- Empty-state headline/body copy ("No results yet" / "Nothing here yet — create your first X")
- Generic error phrasing that doesn't cite a specific limit or policy ("Something went wrong,
  try again")
- Confirmation/success messages ("Saved", "Your changes have been applied")

## Fact-bearing

Contains a number, capability, guarantee, price, limit, deadline, or claim about what the product
does or promises. May be rewritten for clarity/tone **only if the exact claim is preserved
character-for-character in meaning** (paraphrase is fine, the fact itself must not move). If the
claim looks wrong, stale, ambiguous, or inconsistent with another surface, do not silently correct
it — flag it in the report and leave the string unchanged.

Examples:

- "Free for up to 3 projects" (a specific limit)
- "99.9% uptime SLA" (a guarantee)
- "Cancel anytime, no fees" (a policy claim)
- "Supports React, Vue, and Svelte" (a capability list — dropping or adding an item here is a
  factual change, not a copy improvement)
- Password/validation rules that state an actual constraint ("Must be at least 8 characters")
- Any error message that cites a specific limit, code, or policy ("You've reached your plan's
  5-seat limit")

## Flag-only — never rewritten by this skill

Legally, contractually, or compliance-significant copy. Report with a specific reason; leave the
string untouched even if it reads awkwardly, unless the invoking user explicitly authorizes that
specific edit in the same turn.

- Terms of service, privacy policy, or cookie-consent copy
- Refund, cancellation, or billing-policy language
- Security, compliance, or certification claims (SOC 2, GDPR, HIPAA, etc.)
- Consent/opt-in checkboxes and their accompanying text
- Anything under a route, file, or component named/pathed like `legal`, `terms`, `privacy`,
  `compliance`, `consent`, or `dpa`
- Copy the agent is not confident is safe to rewrite for any other reason — conservative default
  wins

## Accessible-name sync check

For every rewritten visible label, check whether any of the following duplicate or paraphrase it,
and update them together so they stay consistent:

- `aria-label` on the same control or a wrapping element
- `alt` text on an image acting as or accompanying the label
- `title` attribute used as a tooltip echo of the label
- `aria-describedby`/`aria-labelledby` targets whose _content_ (not their `id`) is the string
  being changed

The `id` values feeding `aria-labelledby`/`aria-describedby` are identifiers — never change those;
only the text they resolve to may change.

## i18n / message-catalog check

Before editing any string, confirm whether the target already uses a message-catalog or i18n
system (`react-intl`, `i18next`, `next-intl`, a local `messages/*.json` / `locales/*` structure, or
an equivalent project-local translation helper):

- **Catalog present** — edit the catalog entry's value for the resolved locale. Leave the message
  key, the component's reference to that key, and every other locale's entry untouched (a
  translation gap in another locale is out of scope for `/copy`; note it as a limitation instead of
  translating it yourself).
- **No catalog** — the JSX/template literal _is_ the source of truth; edit it directly.

Never introduce a new i18n system as part of a `/copy` pass — that is an architectural change
outside this skill's scope.
