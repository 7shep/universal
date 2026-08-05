# Normalized finding schema

Every critic pass must emit findings in this shape before synthesis. The synthesis step
consumes only findings shaped this way — do not summarize a critic's output in prose without
first normalizing it.

## Fields

| Field                | Type                                                 | Notes                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | string                                               | Stable within the report, e.g. `review-ui-004`. Kebab-case.                                                                                                                                               |
| `critic`             | string                                               | Which dimension produced it, one of the eight in [critic-rubrics.md](critic-rubrics.md).                                                                                                                  |
| `category`           | string                                               | Same value as `critic` unless the finding is genuinely cross-cutting (name both, primary first).                                                                                                          |
| `severity`           | `high` \| `medium` \| `low`                          | See rubric below.                                                                                                                                                                                         |
| `confidence`         | string                                               | Prose, tied to evidence strength (e.g. "high — literal contrast values in source" / "low — inferred from source, no screenshot").                                                                         |
| `location`           | string                                               | File path (with line/selector when possible), component name, and/or viewport (`desktop`/`mobile`).                                                                                                       |
| `evidence`           | string                                               | The concrete observed thing: code excerpt, described screenshot region + path, or an MCP `review_implementation` `rule` ID and message. Label its type: `source` \| `screenshot` \| `mcp` \| `inference`. |
| `rationale`          | string                                               | Why it matters — cite a `get_design_rules`/`get_taste_profile` principle/anti-pattern ID or a concrete user-facing consequence.                                                                           |
| `recommendation`     | string                                               | Scoped, actionable fix naming the file/selector. Note if it exceeds `/polish`/`/cleanup` scope.                                                                                                           |
| `classification`     | `deterministic` \| `judgment`                        | `deterministic` = traceable to a rule/computation/MCP finding. `judgment` = requires human taste even if evidence-informed.                                                                               |
| `supporting_critics` | string[]                                             | Other critic dimensions that independently raised the same underlying issue on the same target, if any (populated during synthesis).                                                                      |
| `dissenting_critics` | string[]                                             | Critic dimensions that reached a conflicting conclusion about the same target, if any (populated during synthesis).                                                                                       |
| `repair_scope`       | `trivial` \| `polish` \| `cleanup` \| `beyond-scope` | Estimated size: `trivial` (single property/line), `polish`-sized, `cleanup`-sized (removal/consolidation), or `beyond-scope` (needs `/art-direct` or new direction work).                                 |

## Severity rubric

- **high** — breaks accessibility (contrast failure, missing focus state, unreachable control),
  breaks responsive layout (clipping/overflow at an evidenced viewport), or is a glaring generic
  AI pattern that materially undercuts the intended direction.
- **medium** — a real inconsistency or craft gap that hurts polish/coherence without breaking
  function or access.
- **low** — a minor refinement opportunity.

## Ranking inputs (used in synthesis, not stored per-field)

Rank using, in this priority order when they conflict: severity, user impact (does it affect a
primary flow or an edge case), confidence (evidence strength), repair cost (cheaper fixes surface
earlier within the same severity tier), and alignment with the selected direction when one is
known. Prefer evidence strength over how many critics raised something — one high-confidence,
well-evidenced finding outranks three low-confidence duplicates.

## Worked example

```text
id: review-ui-002
critic: accessibility
category: accessibility
severity: high
confidence: high — literal value read directly from styles.css, no rendering required
location: src/components/PricingCard.tsx:42, `.pricing-card__cta`
evidence: [source] `.pricing-card__cta:focus { outline: none; }` in styles.css with no
  replacement focus treatment; review_implementation flagged rule `a11y-focus-visible-required`.
rationale: get_taste_profile principle for "controls" requires a visible focus state; removing
  outline without a replacement fails keyboard-only navigation.
recommendation: Replace `outline: none` with a visible `:focus-visible` treatment reusing the
  existing focus-ring token if one exists.
classification: deterministic
supporting_critics: [implementation-craft]
dissenting_critics: []
repair_scope: trivial
```
