# Composition library

`@universal/composition-library` owns Universal's validated composition catalog and the
deterministic rules for selecting and comparing page structures. It describes hero archetypes,
navigation relationships, responsive reading order, structural signatures, and compatibility
between those pieces.

The package does not interpret product briefs, choose a visual preset, or build a `DesignPlan`.
Those orchestration decisions belong in [`@universal/design-engine`](../design-engine/src/index.ts).

## Select a composition

`selectComposition` is deterministic: the same complete input and catalog produce the same
selection. No process-global history is consulted.

```ts
import { selectComposition } from '@universal/composition-library';

const selection = selectComposition({
  brief: {
    prompt: 'Create an editorial archive for an independent type foundry.',
    audience: 'Designers and researchers',
    websiteType: 'cultural archive',
    preferences: ['dense metadata', 'publication-like hierarchy'],
    constraints: ['preserve readable source order']
  },
  preset: 'editorial',
  sectionSequence: ['hero', 'archive-index', 'featured-story', 'footer'],
  seed: 42,
  recentSignatures: [],
  history: []
});

console.log(selection.hero.id);
console.log(selection.navigation.id);
console.log(selection.signature);
```

`seed` must be a non-negative safe integer. `recentSignatures` and `history` are explicit inputs so
callers can avoid repeating recent structures while keeping persistence scoped to their own
project or workspace.

## Catalog and compatibility

- `compositionCatalog` contains the hero archetypes.
- `navigationCatalog` contains navigation definitions.
- `compositionDomainCatalog` is the validated, serialization-friendly combination used by
  selection.
- Each hero lists compatible presets and navigation modes.
- Each navigation definition lists compatible heroes.
- `validateCompositionCatalog` returns structured validation errors.
- `assertValidCompositionCatalog` throws `CompositionCatalogValidationError` when catalog data is
  invalid.

Use the exported catalogs as data. Do not duplicate their entries in consumers. The complete
catalog and its validation rules live in [`src/index.ts`](src/index.ts).

## Signatures and history

A `CompositionSignature` records the selected hero archetype, navigation mode, section sequence,
and visual preset. `signatureSimilarity` returns a structural similarity score from `0` to `1`.
Selection considers the last twelve supplied history entries and prefers candidates below the
package's repetition threshold. If all compatible candidates are exhausted,
`selection.fallback` is `history-exhausted`.

For multi-page work, use `PageCompositionContractV2`,
`createMultiPageCompositionSignature`, and `multiPageSignatureSimilarity`. The v2 comparison
includes routes, navigation, section patterns, slot order, and responsive transformations.
Palette is deliberately excluded: changing only color does not make a structure original.

Responsive transformations carry both visual and semantic reading order. Validate contracts with
`validatePageCompositionContractsV2`; `preservesReadingOrder` checks an individual transformation.

## Ownership

Add behavior here when it defines or validates reusable structural composition:

- hero or navigation catalog contracts;
- responsive structural rules;
- signature construction and similarity; or
- deterministic selection from already-normalized inputs.

Keep brief discovery, preset choice, taste policy, plan compilation, and workflow state in their
own packages. See [Architecture and ownership](../../docs/ARCHITECTURE.md) for the dependency
boundaries.

## Validate changes

From the repository root:

```bash
pnpm --filter @universal/composition-library test
pnpm --filter @universal/composition-library lint
pnpm --filter @universal/composition-library typecheck
pnpm --filter @universal/composition-library build
```

Focused behavior and usage examples are in [`src/index.test.ts`](src/index.test.ts).
