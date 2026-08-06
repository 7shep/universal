# Asset audit finding schema

Full field reference, rubrics, and worked examples for the findings produced by `/assets`. Loaded
only when the main `SKILL.md` workflow needs the detail.

## Fields

| Field            | Type                          | Notes                                                                                                                                                                                |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | string                        | Stable within one report, e.g. `assets-001`. Kebab-case, no spaces.                                                                                                                  |
| `category`       | string                        | One of: quality, consistency, icon-family-cohesion, relevance, performance, accessibility, provenance.                                                                               |
| `severity`       | `high` \| `medium` \| `low`   | See rubric below.                                                                                                                                                                    |
| `confidence`     | string                        | Prose statement tied to evidence strength (e.g. "high — measured the file's on-disk size and the rendered `<img>` width/height directly").                                           |
| `location`       | string                        | Asset file path and/or the file:line referencing it, component name, or viewport.                                                                                                    |
| `evidence`       | string                        | The concrete thing observed: a measured file size, a missing `alt` attribute in source, two icon import paths from different packages, or an MCP finding/rule ID.                    |
| `rationale`      | string                        | Why it matters — cite a `get_design_rules`(imagery)/`get_taste_profile` principle or anti-pattern ID when one applies, or describe the concrete user-facing consequence.             |
| `recommendation` | string                        | A scoped, actionable fix. Name the file/asset to touch. Note if it needs explicit mutation authorization or provenance information before `/assets` (or another skill) can apply it. |
| `classification` | `deterministic` \| `judgment` | See below.                                                                                                                                                                           |

## Severity rubric

- **high** — breaks accessibility (missing `alt` on a meaningful image, an icon-only control with no
  accessible name, a decorative image exposed to assistive tech as meaningful), imitates a named
  brand's protected visual identity, ships an asset with no recorded and unverifiable license, or is
  a performance defect that materially harms load (e.g. a multi-megabyte hero image with no
  responsive sources and no lazy-loading justification).
- **medium** — a real inconsistency or craft gap that hurts polish or coherence without breaking
  access or performance outright (mixed icon families in one context, inconsistent illustration
  style across a set, a missing modern-format fallback where the legacy format is otherwise
  reasonably sized).
- **low** — a minor refinement opportunity; nice-to-have, not urgent.

## Deterministic vs. judgment

- **deterministic** — traceable to a mechanically checkable fact: a missing `alt` attribute on an
  `<img>` that isn't marked decorative, a measured file size against a stated threshold, two icon
  imports from different named packages in the same file, an `MCP review_implementation` finding, or
  a `get_design_rules` `implementationConstraints` violation.
- **judgment** — requires human taste or product context even when informed by evidence: "this
  illustration style feels inconsistent with the rest of the brand," "this stock photo doesn't feel
  specific enough to the product." Keep these, but say plainly that they need human confirmation and
  cite what evidence informed them.

Never label a judgment call as deterministic to make it sound more authoritative than it is.

## Provenance table entry

For every asset actually inspected, record one row:

| Field        | Notes                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`      | File path or identifiable reference.                                                                                                                                      |
| `provenance` | Source/origin as discoverable from the repository (credits file, package license, commit hint).                                                                           |
| `license`    | Named license/terms, or `unknown` if not discoverable — never inferred or assumed.                                                                                        |
| `status`     | `recorded` (already documented), `newly-recorded` (this run added a comment/entry), or `blocked` (a requested add/replace could not proceed because license was unknown). |

## Worked examples

```text
id: assets-002
category: accessibility
severity: high
confidence: high — read directly from src/pages/Home.tsx:58, no visual evidence needed
location: src/pages/Home.tsx:58, hero <img>
evidence: `<img src={hero} className="hero__image" />` with no `alt` attribute and no
  `aria-hidden`/`role="presentation"`; the image contains the only rendering of the product name in
  the hero, so it is not decorative.
rationale: get_taste_profile principle appliesTo:"imagery" requires meaningful imagery to carry an
  accessible-text equivalent; a screen-reader user gets no information from this element as shipped.
recommendation: Add a descriptive `alt` (e.g. "Aftertone product interface showing the release
  timeline") to the `<img>` in src/pages/Home.tsx:58. Purely code-level fix; no new asset needed.
classification: deterministic
```

```text
id: assets-005
category: icon-family-cohesion
severity: medium
confidence: high — verified both import statements directly
location: src/components/Toolbar.tsx:4, :6
evidence: `import { Search } from 'lucide-react'` alongside `import SaveIcon from
  '@/icons/SaveIcon.svg'` (a hand-drawn, heavier-stroke icon) rendered in the same toolbar.
rationale: get_design_rules(imagery) categoryPrinciples call for one coherent icon vocabulary;
  mixing a line-icon library with a heavier custom icon in the same control row reads as
  unintentional drift rather than a deliberate accent.
recommendation: Replace the custom SaveIcon with the closest lucide-react equivalent already used
  elsewhere in the toolbar, or, if the custom icon is intentional, extend it to the rest of the
  toolbar for a single deliberate family — flag either path to `/consistency` if it spans more than
  this one component.
classification: judgment
```

```text
id: assets-009
category: provenance
severity: high
confidence: high — no credits file, package license, or commit message names a source for this file
location: frontend/src/assets/team-photo.jpg
evidence: Binary asset present in the repository with no accompanying license, credit, or source
  note anywhere in the scoped directory or a repository-root credits file.
rationale: Provenance and licensing are mandatory for imagery this project ships; an asset with no
  recorded source cannot be verified as safe to distribute.
recommendation: Locate the original source and license for this asset and record it (credits file or
  inline comment). Until then, treat any request to keep shipping or replace-with-similar as blocked
  pending that information.
classification: deterministic
```
