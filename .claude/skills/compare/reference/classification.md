# Difference classification

Every difference `/compare` reports must be classified as exactly one of these three. Full rubric
and worked examples below. Loaded from the main `SKILL.md` at step 5/6.

## `intentional-divergence`

A deliberate, defensible departure from the reference. Use this only when there is a concrete
reason to believe the difference was chosen on purpose, not merely that it could plausibly be
justified in hindsight.

Valid grounds include:

- A responsive necessity (the reference is a single-width mockup; the implementation's mobile
  layout differs from it in a way a fixed-width image cannot represent).
- A documented constraint in source (a comment, a `DESIGN.md` section, or a direction decision that
  explicitly allows or requires the difference).
- An explicit statement from the user in this conversation that the difference is intentional.
- A functional requirement the reference didn't account for (e.g. the reference mockup has no empty
  state, and the implementation's empty state necessarily differs from any populated-state view).

Do not use this category to excuse an unexplained deviation just because it seems reasonable — that
belongs in `drift` until confirmed.

## `drift`

An unintentional or unconfirmed deviation. This is the default classification when a real
difference exists and no concrete evidence supports either `intentional-divergence` or `defect`.
Say plainly what would resolve the ambiguity (a design-doc update, a user confirmation, or a
principle lookup) rather than guessing.

Examples: a spacing value that doesn't match the reference and isn't explained anywhere; a color
that's visibly off-palette from the reference with no documented reason; a component that shipped
before the reference was updated and never caught up.

## `defect`

A difference that is not just unmatched to the reference but also independently breaks something:
an accessibility rule, a `get_design_rules`/`get_taste_profile` principle or anti-pattern, a
`review_implementation` finding, or an explicit requirement stated in the reference itself (e.g. the
`DESIGN.md` mandates a minimum contrast ratio and the implementation falls short of it, not just of
the mockup's appearance).

A `defect` is always also a difference from the reference, but the reverse isn't true — most
reference differences are `drift`, not `defect`. Reserve `defect` for differences with independent
evidence of breakage, not just "this looks worse to me."

## Severity still applies independently

Classification (why it's different) and severity (how much it matters) are separate fields. A
`defect` is often high severity, but an `intentional-divergence` can still be worth flagging at low
severity if it's a minor UX cost worth revisiting later — record both fields honestly rather than
letting one imply the other.

## Worked examples

```text
category: color-contrast
reference shows: primary CTA in #1B4DFF on white per DESIGN.md's stated token `--color-accent`.
implementation shows: primary CTA in #6C8CFF (a lighter tint) in src/components/Hero.tsx.
classification: defect
rationale: get_taste_profile principle for "controls" plus DESIGN.md's own explicit token value;
  the lighter tint also drops contrast below WCAG AA against the white background (computed 2.9:1).
```

```text
category: composition
reference shows: mockup.png hero as a single fixed 1440px-wide two-column layout.
implementation shows: src/pages/Home.tsx hero collapses to one column under 768px.
classification: intentional-divergence
rationale: the reference is a single desktop-width mockup with no mobile variant; a responsive
  single-column collapse below 768px is a necessary adaptation the mockup can't represent.
```

```text
category: typography
reference shows: DESIGN.md specifies "display type: Georgia serif for headings."
implementation shows: src/styles.css sets `h1, h2 { font-family: Arial, sans-serif; }`.
classification: drift
rationale: no comment, commit message, or conversation context explains the substitution; nothing
  in DESIGN.md documents an exception. Confirm with the author before treating this as intentional.
```
