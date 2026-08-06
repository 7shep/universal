# Critique answer format

Confidence rubric and a worked example for the direct answer produced by `/critique`. Loaded only
when the main `SKILL.md` workflow needs the detail.

## Confidence rubric

State confidence in prose, tied to the strength of the evidence actually gathered — never a bare
number, and never inflated to sound more authoritative than the evidence supports.

- **high** — the question is answerable from directly inspected source plus, where the question is
  visual, a real screenshot at the relevant viewport; or the question is a source-level fact
  (contrast ratio computed from resolved colors, a suppressed focus indicator with no replacement,
  a confirmed missing state) that doesn't require visual evidence to settle.
- **medium** — the question is answerable from source alone where visual evidence would have
  strengthened it (e.g. a purely visual question answered from JSX/CSS structure without a
  screenshot), or a relevant design-policy input (MCP, design direction) was unavailable and the
  answer had to fall back to `AGENTS.md` general principles.
- **low** — the evidence only partially covers the question, multiple relevant inputs were
  unavailable at once, or the answer rests mostly on judgment/taste rather than a verifiable fact.
  Say plainly what would raise confidence (a screenshot, a design direction, MCP connectivity).

## Deterministic vs. judgment claims

Within the answer, distinguish claims the same way `/audit` and `/review-ui` do:

- **deterministic** — mechanically checkable from source, computation, or inspected evidence
  (a literal `outline: none` with no replacement, a computed contrast ratio, confirmed overflow at
  an inspected viewport, an MCP `review_implementation` finding).
- **judgment** — requires human taste or product context even when informed by evidence ("this CTA
  doesn't read as the primary action," "this spacing feels tighter than the rest of the page").
  Keep these when the question calls for them, but say plainly that they need human confirmation
  and cite what evidence informed them.

Never label a judgment call as deterministic to make it sound more authoritative than it is.

## Worked example

```text
Question: "Is the hero CTA prominent enough on the landing page?"
Resolved scope: examples/demo-site/src/pages/Home.tsx (hero section), styles.css hero rules

Evidence inspected:
- Home.tsx:18-40 (hero markup)
- styles.css:.hero, .hero__cta (computed styles)
- No screenshot tooling available in this environment — source-only inspection
- No design plan/brief found in repo or conversation
- get_design_rules("composition") called; get_taste_profile called; review_implementation not
  called (question doesn't need a full implementation critique)

Direct answer: Partial — the CTA is visually distinct (filled button, high-contrast color) but is
one of three same-weight elements in the hero, so it doesn't clearly read as the primary action.

Evidence-backed reasoning:
- .hero__cta uses --color-accent at full saturation against --color-bg-inverse (deterministic:
  computed contrast ratio 6.2:1, passes AA for the button's text size).
- Home.tsx renders a secondary text link and a live-updating stat directly beside the CTA with
  comparable visual weight (font-size: 1rem for all three), so hierarchy between primary and
  secondary actions is not established by scale alone (judgment: requires confirming intended
  hierarchy — no design plan was available to check against).
- get_design_rules("composition") principle "single dominant focal point per section" (cited ID
  from the MCP response) supports treating this as a real gap rather than a preference.

Recommendation: Increase the CTA's visual weight relative to its siblings (larger scale, added
whitespace, or de-emphasized secondary link) — sized for /polish, not a redesign.

Confidence and evidence gaps: Medium — the contrast and markup facts are solid, but no screenshot
was available to confirm rendered spacing/scale, and no design direction exists to confirm intended
hierarchy. A screenshot or a design plan would raise confidence to high.

No source files were modified during this critique.
```
