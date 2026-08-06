# Inventory fields, severity rubric, and worked examples

Full field reference and worked examples for `/consistency`. Loaded only when the main `SKILL.md`
workflow needs the detail.

## Inventory record fields (step 2)

| Field         | Type   | Notes                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `dimension`   | string | One of: tokens, typography, spacing, radii, controls, states, responsive.                        |
| `value`       | string | The literal or token value observed (e.g. `10px`, `--radius-sm`, `#2563EB`, `font-weight: 600`). |
| `role`        | string | The apparent semantic role (e.g. "card padding", "primary button radius", "H2 size").            |
| `occurrences` | array  | Every `file:line` or `component/selector` where this exact value plays that role.                |
| `count`       | number | `occurrences.length` — how many places use this exact value for this role.                       |

Build one inventory record per distinct `(dimension, role, value)` triple actually observed. A role
with only one value across the whole scope is not a finding — it's evidence the system is already
consistent there, and belongs in the inventory summary, not the findings list.

## Finding fields (step 5)

| Field                         | Type                                                                             | Notes                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                          | string                                                                           | Stable within one report, e.g. `consistency-001`. Kebab-case.                                                                     |
| `dimension`                   | string                                                                           | Same enum as inventory records.                                                                                                   |
| `severity`                    | `high` \| `medium` \| `low`                                                      | See rubric below.                                                                                                                 |
| `role`                        | string                                                                           | The semantic role affected.                                                                                                       |
| `occurrences`                 | array                                                                            | Every divergent-value site, copied from the relevant inventory records.                                                           |
| `established_value`           | string                                                                           | The value the system otherwise converges on, with a citation (token file, `get_design_rules`, or highest-count inventory record). |
| `rationale`                   | string                                                                           | Why the divergence reads as unintentional rather than a variant.                                                                  |
| `proposed_convergence_target` | string                                                                           | The value a repair would converge onto, and why.                                                                                  |
| `classification`              | `drift` \| `deliberate-variation` \| `ambiguous` \| `dead-code-defer-to-cleanup` | See Step 4 table in `SKILL.md`.                                                                                                   |

## Severity rubric

- **high** — the divergence is user-visible and breaks the system's own accessibility or contrast
  guarantees at some occurrence (e.g. one button variant's focus treatment is missing where every
  sibling variant has one), or the same interactive role behaves differently across routes in a way
  a user would notice mid-session (e.g. the primary CTA is a different height on two adjacent pages).
- **medium** — a real value drift that hurts visual coherence but doesn't break function or access
  (a spacing scale with one stray value, a radius that's close-but-not-quite the establish scale,
  a state that exists on most but not all instances of a control).
- **low** — a minor, low-visibility divergence (a letter-spacing difference of a fraction of a
  pixel, a breakpoint off by a few pixels with no observable layout consequence).

## Worked examples

```text
id: consistency-001
dimension: radii
severity: medium
role: card corner radius
occurrences:
  - src/components/PricingCard.tsx:18 (`border-radius: 10px`)
  - src/components/FeatureCard.tsx:24 (`border-radius: 10px`)
  - src/components/TestimonialCard.tsx:12 (`border-radius: 12px`)
established_value: `--radius-md` = 10px (packages/ui/tokens.css), used by 6 of 7 card instances
rationale: TestimonialCard's 12px is a hard-coded literal with no comment, variant prop, or distinct
  context (it's a card like the other six); reads as drift, not an intentional larger radius.
proposed_convergence_target: replace the literal with `var(--radius-md)` in TestimonialCard.tsx:12
classification: drift
```

```text
id: consistency-002
dimension: controls
severity: low
role: secondary button border color
occurrences:
  - src/routes/Pricing.tsx:41 (`border-color: var(--border-muted)`)
  - src/routes/Settings.tsx:88 (`border-color: var(--border-strong)`)
established_value: no single canonical value — packages/ui/Button.tsx exposes both as intentional
  `tone` variants (`muted`, `strong`)
rationale: Settings.tsx's button is inside a form section explicitly using the `strong` tone variant
  for emphasis on a destructive-adjacent action; this is a documented variant selection, not drift.
proposed_convergence_target: n/a — preserved
classification: deliberate-variation
```

```text
id: consistency-003
dimension: spacing
severity: medium
role: form-field vertical gap
occurrences:
  - src/components/LoginForm.tsx:30 (`gap: 14px`)
  - src/components/SignupForm.tsx:22 (`gap: 16px`)
established_value: unclear — no shared spacing token covers either value directly; `--space-4` is
  16px, closest existing token
rationale: Both forms serve the same semantic role (stacked form fields) with no visible variant
  reason for the 2px difference; could be an intentional tighter login form or simple drift —
  source alone doesn't resolve it.
proposed_convergence_target: pending user decision
classification: ambiguous
```
