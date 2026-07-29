# Design linter

`@universal/design-linter` turns React and CSS source, plan context, and optional human-supplied
visual evidence into structured implementation-review findings. It is the deterministic review
engine used by the MCP `review_implementation` tool.

The package boundaries are:

- [`@universal/design-taste`](../design-taste/src/index.ts) owns the versioned taste principles,
  anti-patterns, exceptions, and severity vocabulary.
- [`@universal/composition-library`](../composition-library/README.md) owns structural signatures
  and similarity.
- [`@universal/design-engine`](../design-engine/src/index.ts) owns planning and the selected design
  direction.
- `@universal/design-linter` inspects implementation evidence against those inputs.
- [`review_implementation`](../../docs/MCP_REFERENCE.md#review_implementation) is the transport
  adapter that exposes this review through MCP.

## Review an implementation

```ts
import { reviewImplementation } from '@universal/design-linter';

const result = reviewImplementation(
  [
    {
      path: 'src/App.tsx',
      content: `
        export function App() {
          return <main><h1>Archive of independent type</h1></main>;
        }
      `
    },
    {
      path: 'src/styles.css',
      content: 'h1 { font-family: serif; font-size: 5rem; }'
    }
  ],
  {
    screenshots: [
      { viewport: 'desktop', location: 'artifacts/home-desktop.png' },
      { viewport: 'mobile', location: 'artifacts/home-mobile.png' }
    ],
    checkedForEmptySpace: true,
    checkedForMissingMedia: true,
    visualObservations: [
      {
        viewport: 'desktop',
        observation: 'Primary heading and controls remain readable without clipping.'
      },
      {
        viewport: 'mobile',
        observation: 'Content reflows to one column with no horizontal overflow.'
      }
    ]
  }
);

console.log(result.status, result.score, result.findings);
```

`SourceFile` evidence is the implementation text the deterministic checks can inspect.
`VisualEvidence` is structured evidence supplied by a human or another trusted capture workflow:
the current package does not open, render, or understand screenshot pixels.

## Results and severity

`ReviewResult` contains:

- `status`: `pass` or `revision_recommended`;
- `score`: a deterministic score from 0 to 100;
- `findings`: actionable rule results;
- `passedRules` and `passedPrinciples`;
- `unresolvedDecisions`; and
- the taste-policy ID and version used for the review.

Each `ReviewFinding` includes `severity`, a stable `rule`, `rationale`, and `actionableFix`.
`message` and `suggestion` are compatibility aliases. Current taste-review severities are `info`,
`warning`, and `error`. Callers should use the structured severity and rule ID rather than parsing
the prose.

## Add a deterministic rule

1. Add one focused detection path to `reviewImplementation` in
   [`src/index.ts`](src/index.ts).
2. Give the finding a stable, descriptive rule ID and map it to the relevant taste category when
   applicable.
3. Explain what evidence triggered the finding and provide a specific fix.
4. Add a positive and negative case to [`src/index.test.ts`](src/index.test.ts).
5. Test a credible taste exception if the rule supports one.
6. Avoid claims that require rendered inspection unless corresponding `VisualEvidence` is
   present.

The package also exports `lintDesign`, an explicitly registered low-level `DesignRule` runner kept
for design-engine consumers. New implementation-review rules normally belong in
`reviewImplementation`; do not create a second policy system through `lintDesign`.

## Current limitations

- Source detection is heuristic and cannot prove final pixels or interaction behavior.
- Screenshot records and observations are trusted metadata, not image analysis.
- A passing result is not a replacement for accessibility testing or human design review.
- Automated screenshot capture and vision-based critique are separate workflows, not capabilities
  of this package.

## Validate changes

From the repository root:

```bash
pnpm --filter @universal/design-linter test
pnpm --filter @universal/design-linter lint
pnpm --filter @universal/design-linter typecheck
pnpm --filter @universal/design-linter build
```
