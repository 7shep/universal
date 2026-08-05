# Critique dimension rubrics

One rubric per independent critic pass. Every critic evaluates the same evidence bundle
gathered in `SKILL.md` step 2 (source, screenshots, MCP output, design context) and must not
gather its own separate evidence. A critic that has no relevant evidence for its dimension
still produces its section, stating that a finding could not be substantiated rather than
skipping silently.

For each dimension: what it checks, what evidence it may cite, and what it must explicitly
decline to claim.

## Typography

Checks: type scale and hierarchy, font pairing/consistency, line-length (`ch`/`~`), line-height,
letter-spacing at scale, heading/body contrast, use of established type tokens vs. one-off values.

Evidence: source (font-family/size/line-height declarations, `clamp()` usage), screenshots
(rendered scale and rag), `get_design_rules` (`typography` category), `review_implementation`
findings tagged to typography rules.

Must not claim: exact rendered pixel metrics without a screenshot; a specific typeface renders
correctly across platforms without evidence.

## Composition and hierarchy

Checks: primary/secondary/tertiary visual weight, grid/alignment discipline, whitespace
intentionality, focal point clarity, section sequencing against any known composition signature.

Evidence: source structure (JSX nesting, CSS grid/flex), screenshots, `compositionContext` /
`expectedSignature` if present, `get_design_rules` (`composition`), `review_implementation`.

Must not claim: a layout "feels balanced" as a deterministic fact — this dimension is judgment-
heavy; ground every claim in structure or a cited principle.

## Accessibility

Checks: semantic HTML/roles, focus-visible states, color contrast (compute when values are
literal; otherwise flag as unverified), keyboard reachability implied by markup, alt text /
labels, `prefers-reduced-motion` handling, target size.

Evidence: source (markup, ARIA, CSS `:focus-visible`, contrast values when literal), MCP
`review_implementation` a11y rules, screenshots (visible focus rings only if actually captured
in a focused state — do not infer focus appearance from a static unfocused screenshot).

Must not claim: a full WCAG audit; contrast on non-literal (e.g. token-referenced, computed, or
gradient) colors without resolving the actual value; that keyboard flow was tested when no
runtime interaction occurred.

## Brand and direction alignment

Checks: consistency with the selected design direction, creative brief, or taste profile when
one is available; palette/voice/material-cue adherence; generic-AI-pattern avoidance
(interchangeable gradient heroes, cards-in-cards, repetitive three-column grids, unearned
glassmorphism/pills) per `AGENTS.md` and `get_taste_profile`.

Evidence: design plan/brief/direction artifacts if present in the repo or conversation,
`get_taste_profile` anti-patterns, source/screenshots.

Must not claim: direction misalignment when no direction artifact exists — state that
alignment is unverifiable and fall back to generic-pattern anti-patterns only.

## Motion and interaction

Checks: transition/animation use, hover/active/focus/loading/empty/error state definitions in
source, respect for `prefers-reduced-motion`, restraint vs. gratuitous motion.

Evidence: source (`@keyframes`, `transition`, `:hover`/`:active`/`:focus-visible` rules,
`prefers-reduced-motion` media queries). Screenshots are static and cannot show motion.

Must not claim: how an animation actually looks or feels, that a hover/active state renders
correctly, or that runtime timing is acceptable — these require live interaction this skill does
not perform. State plainly that motion/interaction behavior is inferred from source only unless
the evidence bundle includes recorded interaction observations.

## Responsive behavior

Checks: breakpoint coverage, fluid vs. fixed sizing, overflow/clipping risk, reflow order,
touch-target sizing on narrow viewports.

Evidence: source (media queries, `clamp()`/`minmax()`/`fr` usage, fixed px widths),
desktop/mobile screenshots when captured, `checkedForEmptySpace` / `checkedForMissingMedia` from
`review_implementation`'s visual evidence record.

Must not claim: behavior at a viewport that was not captured or reasoned about from responsive
source patterns — name the exact viewports actually evidenced.

## Component vocabulary

Checks: reuse of existing primitives/tokens vs. one-off styles, naming/variant consistency,
duplicate components solving the same problem, drift from the project's established patterns.

Evidence: source (imports from `packages/ui` or a project component directory, repeated
class/style patterns), Grep results across the scope showing reuse or duplication.

Must not claim: vocabulary problems outside the resolved scope — do not extrapolate from one
component to the whole design system without evidence from more than one file.

## Implementation craft

Checks: dead/duplicated code in the reviewed surface, inconsistent formatting affecting
rendering, obviously unhandled empty/loading/error states, prop/type mismatches visible in
source, brittle inline styles fighting the design system.

Evidence: source only.

Must not claim: runtime correctness, performance characteristics, or test coverage — those are
outside a read-only design review; note them as out of scope if raised.
