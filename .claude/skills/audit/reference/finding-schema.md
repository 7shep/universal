# Audit finding schema

Full field reference, rubrics, and worked examples for the findings produced by `/audit`. Loaded
only when the main `SKILL.md` workflow needs the detail.

## Fields

| Field            | Type                          | Notes                                                                                                                                                                                                           |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | string                        | Stable within one report, e.g. `audit-001`. Kebab-case, no spaces.                                                                                                                                              |
| `category`       | string                        | One of: hierarchy, composition, typography, spacing-rhythm, color-contrast, responsive, accessibility, interaction-states, component-vocabulary, generic-ai-pattern, direction-alignment, implementation-craft. |
| `severity`       | `high` \| `medium` \| `low`   | See rubric below.                                                                                                                                                                                               |
| `confidence`     | string                        | State the confidence level in prose (e.g. "high — verified against two files and a captured mobile screenshot") tied to how strong the evidence is, not a bare number.                                          |
| `location`       | string                        | File path with line/selector when possible, component name, or viewport (`desktop`/`mobile`).                                                                                                                   |
| `evidence`       | string                        | The concrete thing observed: a short code excerpt, a described screenshot region with its path, or an MCP `review_implementation` finding's `rule` ID and message.                                              |
| `rationale`      | string                        | Why it matters — cite a `get_design_rules`/`get_taste_profile` principle or anti-pattern ID when one applies, or describe the concrete user-facing consequence.                                                 |
| `recommendation` | string                        | A scoped, actionable fix. Name the file/selector to touch. Flag if it exceeds `/polish`/`/cleanup` scope (e.g. needs a new direction via `/art-direct`).                                                        |
| `classification` | `deterministic` \| `judgment` | See below.                                                                                                                                                                                                      |

## Severity rubric

- **high** — breaks accessibility (e.g. contrast failure, missing focus state, unreachable
  control), breaks responsive layout (clipping/overflow at a real viewport), or is a glaring generic
  AI pattern that materially undercuts the intended direction.
- **medium** — a real inconsistency or craft gap that hurts polish or coherence but doesn't break
  functionality or access (uneven spacing scale, inconsistent component variants, a hierarchy that's
  merely muddy rather than broken).
- **low** — a minor refinement opportunity; nice-to-have, not urgent.

## Deterministic vs. judgment

- **deterministic** — traceable to a rule: an MCP `review_implementation` finding, a `get_design_rules`
  `implementationConstraints` violation, a confirmed-suppressed or confirmed-inadequate focus
  indicator (e.g. `outline: none` with no replacement, or a rendered check showing no visible focus
  state), a missing `prefers-reduced-motion` rule, a literal contrast-ratio computation, or another
  mechanically checkable fact. The mere absence of a custom `:focus-visible` rule is not by itself
  deterministic evidence of a missing focus state — browsers supply a default focus indicator unless
  CSS suppresses it, so only flag this when you have evidence the native indicator is suppressed or
  inadequate (a suppressing rule in source, or an inspected/rendered state showing no visible focus).
- **judgment** — requires human taste or product context even when informed by evidence: "this hero
  composition reads as generic," "this hierarchy doesn't foreground the primary action enough." Keep
  these, but say plainly that they need human confirmation and cite what evidence informed them.

Never label a judgment call as deterministic to make it sound more authoritative than it is.

## Worked example

```text
id: audit-003
category: accessibility
severity: high
confidence: high — verified in src/components/PricingCard.tsx:42 and the anti-pattern is a direct
  read of the source, no visual evidence needed
location: src/components/PricingCard.tsx:42, `.pricing-card__cta`
evidence: `.pricing-card__cta:focus { outline: none; }` in styles.css with no replacement focus
  treatment; review_implementation flagged rule `a11y-focus-visible-required`.
rationale: Anti-slop-craft-v1 principle "controls" requires a visible focus state; removing outline
  without a replacement fails keyboard-only navigation.
recommendation: Replace `outline: none` with a visible `:focus-visible` treatment (e.g. an outset
  outline or box-shadow) reusing the existing focus-ring token if one exists in the CSS.
classification: deterministic
```

```text
id: audit-007
category: generic-ai-pattern
severity: medium
confidence: medium — based on source structure only, no screenshot captured for this route
location: src/pages/Home.tsx (hero section)
evidence: Hero section is a centered heading + subhead + single CTA over a linear-gradient
  background, matching the "generic gradient hero" anti-pattern description.
rationale: get_taste_profile anti-pattern `generic-gradient-hero` (or the closest matching ID
  returned by the call) flags this exact shape as a default to avoid absent an explicit reason.
recommendation: Confirm with the selected design direction (none found for this project) whether a
  gradient hero was intentional; if not, consider a more differentiated composition per
  get_design_rules "composition" guidance.
classification: judgment
```
