# Before/after: what `review_implementation` actually returns

This is what a user sees when they run Universal's `review_implementation` tool against a
realistic, mediocre React app before adopting the design-direction workflow, compared to a
revised version of the same page. Both runs below are real: the score and findings are copied
verbatim from an actual invocation of the same `reviewImplementation` function the
`review_implementation` MCP tool calls (`packages/design-mcp/src/index.ts` imports it from
`@universal/design-linter`), not written by hand.

No marketing framing here — this is the literal JSON output.

## The two example apps

Both are small, self-contained two-file React apps (`src/App.tsx` + `src/styles.css`) kept
intentionally short as a documentation illustration, not a shipped template. Source lives under
[`docs/examples/before-after/`](examples/before-after/):

- **`before/`** — a deliberately generic marketing page: a centered hero with "Welcome to Acme"
  copy and enterprise-grade buzzwords, a standard logo-left/links-right navbar with a CTA button,
  and an equal three-column feature-card grid with icon-top cards.
- **`after/`** — a revised version of the same product: a masthead-style header instead of a
  standard navbar, an asymmetric opener instead of a centered hero, a sequenced list of numbered
  capability rows instead of a three-card grid, and a deliberate two-family type system (a serif
  display face plus a sans body face) instead of a single generic sans font.

Neither file set uses `compositionContext` or a `tasteDirection` — this is the same call shape a
user would make with source files alone and no design plan attached, which is why both runs still
flag `missing-design-thesis`: that finding is about the review not having a plan to check against,
not about the two example files' visual quality.

## How this was run

```bash
node --experimental-strip-types docs/examples/before-after/run-review.mjs
```

[`run-review.mjs`](examples/before-after/run-review.mjs) imports `reviewImplementation` directly
from `packages/design-linter/src/index.ts` (the same function
`packages/design-mcp/src/index.ts` wires up as the `review_implementation` MCP tool) and calls it
against each example's two files with no `visualEvidence` or `compositionContext`, the same as a
bare `review_implementation({ files })` call. Re-run this script and paste its output back into
this document if the example apps or the design-linter rules change — the numbers below must never
be hand-edited.

## Before: score 0, `revision_recommended`

```json
{
  "status": "revision_recommended",
  "score": 0,
  "findings": [
    {
      "severity": "warning",
      "rule": "missing-design-thesis",
      "rationale": "The review has no concrete one-sentence design thesis to evaluate for coherence.",
      "actionableFix": "Attach the generated tasteDirection with a specific thesis grounded in this brief."
    },
    {
      "severity": "warning",
      "rule": "default-dark-purple-theme",
      "rationale": "A dark surface with purple or indigo accents matches a common generated-tech default.",
      "actionableFix": "Choose colors from the product context or document why this palette is specific to the brand."
    },
    {
      "severity": "warning",
      "rule": "standard-feature-grid",
      "rationale": "An equal three-column grid was detected without content justification.",
      "actionableFix": "Use a content-led sequence or document why the items require equal scanability."
    },
    {
      "severity": "warning",
      "rule": "repeated-card-pattern",
      "rationale": "Repeated card treatment appears to replace a more specific information hierarchy.",
      "actionableFix": "Use type, dividers, varied spans, or sequencing unless the plan explains peer-level comparison."
    },
    {
      "severity": "warning",
      "rule": "nested-card-pattern",
      "rationale": "A card or panel appears nested inside another container shell.",
      "actionableFix": "Flatten the hierarchy or document the distinct interactive containment level."
    },
    {
      "severity": "warning",
      "rule": "default-centered-hero",
      "rationale": "A likely centered hero was detected.",
      "actionableFix": "Confirm the centered axis serves the thesis or use the selected composition coordinates."
    },
    {
      "severity": "warning",
      "rule": "default-horizontal-navigation",
      "rationale": "A standard logo-left, links-and-CTA-right navigation was detected.",
      "actionableFix": "Use the plan-selected navigation relationship or document why convention is clearest."
    },
    {
      "severity": "warning",
      "rule": "generic-horizontal-navbar",
      "rationale": "The navigation matches a generic horizontal default without a credible plan rationale.",
      "actionableFix": "Integrate navigation with the composition or add a specific clarity/familiarity rationale."
    },
    {
      "severity": "warning",
      "rule": "generic-marketing-cadence",
      "rationale": "The copy uses generated-marketing buzzwords, manufactured contrast, theater framing, or repeated em dashes.",
      "actionableFix": "Replace the cadence with specific verbs, nouns, mechanisms, and evidence."
    },
    {
      "severity": "warning",
      "rule": "missing-typographic-contrast",
      "rationale": "Source and plan do not establish a deliberate display/body contrast.",
      "actionableFix": "Differentiate family, weight, width, scale, or rhythm and record that choice in tasteDirection."
    },
    {
      "severity": "warning",
      "rule": "missing-motion-rationale",
      "rationale": "Motion is present without a sufficiently specific hierarchy, navigation, state, or brand purpose.",
      "actionableFix": "Add a motion rationale and reduced-motion behavior, or remove the animation."
    },
    {
      "severity": "warning",
      "rule": "visual-evidence-required",
      "rationale": "The review is missing required desktop and mobile screenshots.",
      "actionableFix": "Capture both viewports and attach concise structured observations before shipping."
    },
    {
      "severity": "warning",
      "rule": "control-spacing-review-required",
      "rationale": "Source parsing cannot prove primary-control optical spacing, and structured desktop/mobile observations are incomplete.",
      "actionableFix": "Record observations for both viewports covering label centering, padding, height, and treatment consistency."
    }
  ],
  "passedRules": [
    "No gradients detected",
    "Rounded containers are restrained",
    "Shadow use is restrained",
    "No default left-copy/right-media hero detected"
  ],
  "passedPrinciples": ["purposeful-visual-material"],
  "unresolvedDecisions": [
    "Attach tasteDirection from the canonical DesignPlan.",
    "Decide whether motion has a real purpose or should be removed.",
    "Complete desktop and mobile primary-control spacing observations."
  ],
  "policy": { "profileId": "anti-slop-craft-v1", "profileVersion": "1.0.0" }
}
```

`findings` above is trimmed to `severity`/`rule`/`rationale`/`actionableFix` for readability; the
real payload also repeats `rationale`/`actionableFix` as `message`/`suggestion` for backward
compatibility with existing MCP clients. See
[`run-review.mjs`](examples/before-after/run-review.mjs) output for the untrimmed JSON.

Two findings are worth calling out as honest limitations of static analysis rather than
marketing-friendly wins: `default-dark-purple-theme` fired because the CTA button's
`background: #2563eb` happens to match both the tool's "dark surface" hex-prefix heuristic and its
purple/blue accent list — the page has no dark theme at all. `missing-motion-rationale` fired
because the CSS regex for "any motion" matches `:hover` interactions generically, even though this
page has no animation. These are real outputs from the current rule set, not cherry-picked passes.

## After: score 84, `revision_recommended`

```json
{
  "status": "revision_recommended",
  "score": 84,
  "findings": [
    {
      "severity": "warning",
      "rule": "missing-design-thesis",
      "rationale": "The review has no concrete one-sentence design thesis to evaluate for coherence.",
      "actionableFix": "Attach the generated tasteDirection with a specific thesis grounded in this brief."
    },
    {
      "severity": "warning",
      "rule": "visual-evidence-required",
      "rationale": "The review is missing required desktop and mobile screenshots.",
      "actionableFix": "Capture both viewports and attach concise structured observations before shipping."
    }
  ],
  "passedRules": [
    "No gradients detected",
    "No default purple or blue treatment detected",
    "No equal three-column feature grid detected",
    "Rounded containers are restrained",
    "Shadow use is restrained",
    "No default left-copy/right-media hero detected",
    "No default horizontal navigation detected"
  ],
  "passedPrinciples": [
    "deliberate-type-relationship",
    "brand-specific-color",
    "navigation-is-composition",
    "purposeful-visual-material",
    "specific-copy",
    "purposeful-motion",
    "accessible-reading-order",
    "optically-consistent-controls"
  ],
  "unresolvedDecisions": ["Attach tasteDirection from the canonical DesignPlan."],
  "policy": { "profileId": "anti-slop-craft-v1", "profileVersion": "1.0.0" }
}
```

The two remaining findings are both about the review call itself, not the page: neither example
attaches a `tasteDirection` (no design plan was run for this doc) or screenshot evidence. In the
real Phase 2 workflow, `create_design_plan_v2`'s output feeds `compositionContext.tasteDirection`
and a human or agent attaches screenshots before shipping, which is what clears both findings in
practice.

## Reading this honestly

- Both runs return `revision_recommended`, not `pass` — `review_implementation` never rubber-stamps
  a submission that skipped the design-plan and screenshot-evidence steps, which is by design.
- The score moved from 0 to 84 and the finding count from 12 to 2 purely from composition,
  navigation, typography, and copy changes to the same two-file app shape — no new tooling, no
  larger file, no additional dependencies.
- This is a deterministic static-analysis tool, not a visual model: it reads source text for
  regex-detectable anti-patterns (equal grids, centered `.hero` selectors, single-font-family
  stacks, buzzword copy, and so on). It will occasionally flag benign code (see the two heuristic
  false positives called out above) and it cannot see a fully custom implementation that avoids
  every named pattern but is still visually generic. Treat it as a fast, repeatable first pass, not
  a substitute for the visual review step the tool itself asks for (`visual-evidence-required`).
