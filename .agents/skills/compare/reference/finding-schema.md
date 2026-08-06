# Compare finding schema

Full field reference and a worked example for the differences produced by `/compare`. Loaded only
when the main `SKILL.md` workflow needs the detail. Classification values and rubric live in
[classification.md](classification.md); reference-type validation lives in
[reference-resolution.md](reference-resolution.md).

## Fields

| Field                     | Type                                                                           | Notes                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | string                                                                         | Stable within one report, e.g. `compare-001`. Kebab-case, no spaces.                                                                                                                  |
| `category`                | string                                                                         | One of: typography, color-contrast, composition, spacing-rhythm, imagery, motion-interaction, copy, component-vocabulary, accessibility, generic-ai-pattern.                          |
| `severity`                | `high` \| `medium` \| `low`                                                    | Same rubric as `/audit`: high breaks accessibility/responsive layout or is a glaring mismatch that undercuts the reference's intent; medium is a real inconsistency; low is minor.    |
| `confidence`              | string                                                                         | Prose, tied to evidence strength (e.g. "high — literal hex values read from both source and DESIGN.md" / "medium — inferred from a described screenshot region, not pixel-measured"). |
| `implementation_location` | string                                                                         | File path (with line/selector when possible), component name, and/or viewport.                                                                                                        |
| `reference_location`      | string                                                                         | Where in the reference this was observed: an image region description + path, a URL + page section, a `DESIGN.md` heading/line, or a direction/plan field name.                       |
| `evidence`                | string, typed                                                                  | The concrete observed thing on both sides. Label its type: `source` \| `screenshot` \| `rendered-url` \| `design-doc` \| `direction` \| `mcp`.                                        |
| `rationale`               | string                                                                         | Why it matters — cite the reference's own statement, a `get_design_rules`/`get_taste_profile` principle/anti-pattern, or a concrete user-facing consequence.                          |
| `classification`          | `intentional-divergence` \| `drift` \| `defect`                                | See [classification.md](classification.md).                                                                                                                                           |
| `recommendation`          | string                                                                         | A scoped, actionable fix description (not "redesign this"). Name the file/selector/token to change.                                                                                   |
| `route_to`                | `/polish` \| `/layout` \| `/color` \| `/typography` \| `/art-direct` \| `none` | Which mutating skill should apply the fix, or `none` if the finding is informational (e.g. a confirmed `intentional-divergence` worth documenting, not fixing).                       |

## Severity rubric

- **high** — breaks accessibility (contrast failure, missing focus state), breaks responsive layout
  (clipping/overflow at an evidenced viewport), or is a glaring mismatch against the reference that
  materially undercuts its intent (e.g. wrong hero archetype entirely, a core brand color replaced).
- **medium** — a real, confirmed-or-likely mismatch that hurts coherence with the reference without
  breaking function or access (off-scale spacing, an inconsistent component variant, a hierarchy
  that doesn't match the reference's emphasis).
- **low** — a minor refinement opportunity; nice-to-have alignment, not urgent.

## Worked example

```text
id: compare-004
category: color-contrast
severity: high
confidence: high — hex value read directly from src/styles.css and from DESIGN.md's stated
  `--color-accent` token; contrast computed from the two literal hex values
implementation_location: src/components/Hero.tsx:18, `.hero__cta` (desktop)
reference_location: DESIGN.md, "Color tokens" section, `--color-accent: #1B4DFF`
evidence: [source] `.hero__cta { background: #6C8CFF; }` in styles.css. [design-doc] DESIGN.md
  states `--color-accent: #1B4DFF` as the primary CTA token. Computed contrast of the implemented
  color against the white background is 2.9:1, below WCAG AA.
rationale: DESIGN.md's own token is the binding source of truth for this project's accent color;
  the substituted lighter tint also fails the accessible-contrast principle from get_taste_profile.
recommendation: Replace the literal `#6C8CFF` in `.hero__cta` with the `--color-accent` token
  (`#1B4DFF`) already defined in the project's token file, rather than a hard-coded value.
classification: defect
route_to: /color
```
