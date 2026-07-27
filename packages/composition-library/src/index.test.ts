import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compositionCatalog,
  compositionDomainCatalog,
  createMultiPageCompositionSignature,
  navigationCatalog,
  multiPageSignatureSimilarity,
  preservesReadingOrder,
  selectComposition,
  signatureSimilarity,
  validateCompositionCatalog,
  validateComposition,
  validateCompositionContract,
  validateCompositionSignature,
  validateMultiPageCompositionSignature,
  validatePageCompositionContractV2,
  validatePageCompositionContractsV2,
  type CompositionCatalogData,
  type CompositionSelectionInput,
  type CompositionSignature,
  type HeroArchetype,
  type NavigationDefinition,
  type PageCompositionContractV2
} from './index.ts';

const signature: CompositionSignature = {
  heroArchetype: 'poster',
  navigationMode: 'perimeter',
  sectionSequence: ['opener', 'story'],
  preset: 'editorial'
};

const selectionInput: CompositionSelectionInput = {
  brief: { prompt: 'An editorial culture organization', audience: 'members' },
  preset: 'editorial',
  sectionSequence: ['opener', 'story', 'closing'],
  seed: 42,
  recentSignatures: [],
  history: []
};

const pageContract: PageCompositionContractV2 = {
  version: 2,
  pageId: 'page:home',
  route: '/',
  navigationMode: 'perimeter',
  sections: [
    {
      pageId: 'page:home',
      sectionId: 'section:hero',
      kind: 'hero',
      pattern: 'poster-field',
      slots: ['headline', 'media', 'actions'],
      readingOrder: ['headline', 'media', 'actions']
    },
    {
      pageId: 'page:home',
      sectionId: 'section:proof',
      kind: 'proof',
      pattern: 'staggered-proof',
      slots: ['headline', 'body'],
      readingOrder: ['headline', 'body']
    }
  ],
  readingOrder: ['section:hero', 'section:proof'],
  responsiveTransformations: [
    {
      pageId: 'page:home',
      sectionId: 'section:hero',
      viewport: 'mobile',
      strategy: 'stack',
      visualOrder: ['media', 'headline', 'actions'],
      readingOrder: ['headline', 'media', 'actions']
    }
  ]
};
const cloneCatalog = (): { heroes: HeroArchetype[]; navigation: NavigationDefinition[] } =>
  structuredClone(compositionDomainCatalog) as {
    heroes: HeroArchetype[];
    navigation: NavigationDefinition[];
  };

test('the shipped domain catalog validates with stable section and region identities', () => {
  const validation = validateCompositionCatalog({
    heroes: compositionCatalog,
    navigation: navigationCatalog
  });
  assert.equal(validation.ok, true);
  for (const hero of compositionCatalog) {
    assert.equal(hero.sectionId, `section:${hero.id}`);
    assert.ok(hero.regions.length >= 3);
    assert.deepEqual(
      hero.regions.map((region) => region.slot),
      hero.contentOrder
    );
    for (const region of hero.regions) assert.equal(region.id, `region:${hero.id}:${region.slot}`);
  }
});

test('catalog validation reports duplicate and dangling ids with actionable paths', () => {
  const duplicate = cloneCatalog();
  duplicate.heroes.push(structuredClone(duplicate.heroes[0]!));
  const duplicateResult = validateCompositionCatalog(duplicate);
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) {
    assert.ok(
      duplicateResult.errors.some((issue) => /Duplicate hero id "poster"/.test(issue.message))
    );
    assert.ok(duplicateResult.errors.some((issue) => issue.path.endsWith('.id')));
  }

  const dangling = cloneCatalog();
  dangling.navigation.find((item) => item.id === 'corner-controls')!.compatibleHeroes = [
    ...dangling.navigation.find((item) => item.id === 'corner-controls')!.compatibleHeroes,
    'missing-hero'
  ];
  const danglingResult = validateCompositionCatalog(dangling);
  assert.equal(danglingResult.ok, false);
  if (!danglingResult.ok)
    assert.ok(
      danglingResult.errors.some((issue) =>
        /references missing hero "missing-hero"/.test(issue.message)
      )
    );
});

test('catalog validation rejects missing regions, prohibited patterns, presets, and content order', () => {
  const malformed = cloneCatalog();
  const hero = malformed.heroes[0]!;
  hero.contentOrder = [...hero.contentOrder, 'body'];
  hero.compatiblePresets = ['not-a-preset' as never];
  hero.prohibitedPatterns = [];
  const navigation = malformed.navigation[0]!;
  navigation.prohibitedPatterns = [];
  const result = validateCompositionCatalog(malformed);
  assert.equal(result.ok, false);
  if (!result.ok) {
    const messages = result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    assert.match(messages, /compatiblePresets/);
    assert.match(messages, /prohibitedPatterns/);
    assert.match(messages, /Content-order slot "body" has no spatial region/);
  }
});

test('composition contracts and signatures validate their cross-field references', () => {
  const selected = selectComposition(selectionInput);
  assert.equal(
    validateCompositionContract({
      hero: selected.hero,
      navigation: selected.navigation,
      signature: selected.signature
    }).ok,
    true
  );
  const malformed = validateCompositionSignature({ ...selected.signature, sectionSequence: [] });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.errors[0]?.path, 'signature.sectionSequence');
});

test('page compositions require stable, unique section identities', () => {
  const composition = {
    id: 'landing-page',
    name: 'Landing page',
    intent: 'Tell one product story.',
    rhythm: 'balanced',
    sections: [
      {
        id: 'section:hero',
        kind: 'hero',
        purpose: 'Establish the thesis.',
        emphasis: 'primary',
        slots: ['headline', 'actions']
      }
    ]
  };
  assert.equal(validateComposition(composition).ok, true);
  const invalid = structuredClone(composition);
  invalid.sections.push(structuredClone(invalid.sections[0]!));
  const result = validateComposition(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.at(-1)?.message ?? '', /Duplicate section id/);
});

test('signature similarity has stable weighted boundaries', () => {
  assert.equal(signatureSimilarity(signature, signature), 1);
  assert.equal(
    signatureSimilarity(signature, {
      ...signature,
      navigationMode: 'corner-controls',
      sectionSequence: ['different'],
      preset: 'minimal'
    }),
    0.45
  );
  assert.equal(
    signatureSimilarity(signature, {
      heroArchetype: 'different',
      navigationMode: 'corner-controls',
      sectionSequence: ['different'],
      preset: 'minimal'
    }),
    0
  );
});

test('selection is deterministic and does not mutate explicit history', () => {
  const history = [signature];
  const input = { ...selectionInput, history };
  const first = selectComposition(input);
  const second = selectComposition(structuredClone(input));
  assert.deepEqual(first, second);
  assert.deepEqual(history, [signature]);
});

test('selection falls back deterministically when history exhausts every candidate', () => {
  const poster = structuredClone(compositionCatalog.find((hero) => hero.id === 'poster')!);
  poster.compatibleNavigation = ['corner-controls'];
  const corner = structuredClone(
    navigationCatalog.find((navigation) => navigation.id === 'corner-controls')!
  );
  corner.compatibleHeroes = ['poster'];
  const catalog: CompositionCatalogData = { heroes: [poster], navigation: [corner] };
  const previous: CompositionSignature = {
    heroArchetype: 'poster',
    navigationMode: 'corner-controls',
    sectionSequence: selectionInput.sectionSequence,
    preset: 'editorial'
  };
  const selected = selectComposition({ ...selectionInput, history: [previous] }, catalog);
  assert.equal(selected.fallback, 'history-exhausted');
  assert.equal(selected.noveltyScore, 0);
  assert.deepEqual(selected.signature, previous);
});

test('selection refuses malformed catalogs before scoring', () => {
  const malformed = cloneCatalog();
  malformed.heroes[0]!.id = malformed.heroes[1]!.id;
  assert.throws(
    () => selectComposition(selectionInput, malformed),
    /Invalid composition catalog:[\s\S]*Duplicate hero id/
  );
});

test('v2 page contracts preserve semantic order across responsive visual reflow', () => {
  const result = validatePageCompositionContractV2(pageContract);
  assert.equal(result.ok, true);
  assert.equal(
    preservesReadingOrder(pageContract.sections[0]!, pageContract.responsiveTransformations[0]!),
    true
  );

  const signature = createMultiPageCompositionSignature([pageContract], 'oxide');
  assert.equal(validateMultiPageCompositionSignature(signature).ok, true);
  assert.deepEqual(
    signature.pages[0]?.sectionSequence.map((section) => section.pattern),
    ['poster-field', 'staggered-proof']
  );
});

test('v2 validation rejects dangling page and section references and reading-order changes', () => {
  const invalid = structuredClone(pageContract);
  invalid.sections[0]!.pageId = 'page:other';
  invalid.responsiveTransformations[0]!.sectionId = 'section:missing';
  invalid.responsiveTransformations[0]!.readingOrder = ['media', 'headline', 'actions'];
  const result = validatePageCompositionContractV2(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    const messages = result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    assert.match(messages, /references a different page/);
    assert.match(messages, /references missing section/);
  }

  const reordered = structuredClone(pageContract);
  reordered.responsiveTransformations[0]!.readingOrder = ['media', 'headline', 'actions'];
  const reorderedResult = validatePageCompositionContractV2(reordered);
  assert.equal(reorderedResult.ok, false);
  if (!reorderedResult.ok)
    assert.ok(
      reorderedResult.errors.some((issue) => /preserve semantic reading order/.test(issue.message))
    );
});

test('multi-page validation enforces unique page references and routes', () => {
  const duplicate = structuredClone(pageContract);
  assert.equal(validatePageCompositionContractsV2([pageContract]).ok, true);
  const result = validatePageCompositionContractsV2([pageContract, duplicate]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((issue) => /Duplicate page id/.test(issue.message)));
    assert.ok(result.errors.some((issue) => /Duplicate page route/.test(issue.message)));
  }
});

test('v2 structural similarity detects palette-only variants', () => {
  const oxide = createMultiPageCompositionSignature([pageContract], 'oxide');
  const cobalt = createMultiPageCompositionSignature([pageContract], 'cobalt');
  assert.equal(multiPageSignatureSimilarity(oxide, cobalt), 1);

  const changed = structuredClone(cobalt);
  changed.pages[0]!.sectionSequence[0]!.pattern = 'cinematic-field';
  assert.ok(multiPageSignatureSimilarity(oxide, changed) < 1);
});

test('v2 signatures follow declared reading order instead of section storage order', () => {
  const reorderedStorage = structuredClone(pageContract);
  reorderedStorage.sections = [...reorderedStorage.sections].reverse();

  const original = createMultiPageCompositionSignature([pageContract]);
  const reordered = createMultiPageCompositionSignature([reorderedStorage]);
  assert.deepEqual(reordered, original);
  assert.deepEqual(
    reordered.pages[0]?.sectionSequence.map((section) => section.sectionId),
    pageContract.readingOrder
  );
});

test('v2 signatures distinguish changed semantic section and slot order', () => {
  const changedPageOrder = structuredClone(pageContract);
  changedPageOrder.readingOrder = [...changedPageOrder.readingOrder].reverse();
  const changedSlotOrder = structuredClone(pageContract);
  changedSlotOrder.sections[0]!.readingOrder = ['media', 'headline', 'actions'];
  changedSlotOrder.responsiveTransformations[0]!.readingOrder = ['media', 'headline', 'actions'];

  const original = createMultiPageCompositionSignature([pageContract]);
  const pageOrderSignature = createMultiPageCompositionSignature([changedPageOrder]);
  const slotOrderSignature = createMultiPageCompositionSignature([changedSlotOrder]);
  assert.notDeepEqual(pageOrderSignature, original);
  assert.notDeepEqual(slotOrderSignature, original);
  assert.ok(multiPageSignatureSimilarity(original, pageOrderSignature) < 1);
  assert.ok(multiPageSignatureSimilarity(original, slotOrderSignature) < 1);
});

test('v2 signatures distinguish responsive-only structural changes', () => {
  const responsiveChange = structuredClone(pageContract);
  responsiveChange.responsiveTransformations[0]!.strategy = 'reflow';
  responsiveChange.responsiveTransformations[0]!.visualOrder = ['headline', 'media', 'actions'];

  const original = createMultiPageCompositionSignature([pageContract]);
  const changed = createMultiPageCompositionSignature([responsiveChange]);
  assert.notDeepEqual(changed, original);
  assert.ok(multiPageSignatureSimilarity(original, changed) < 1);
});

test('v2 similarity aligns pages by stable identity and penalizes missing pages', () => {
  const aboutPage = structuredClone(pageContract);
  aboutPage.pageId = 'page:about';
  aboutPage.route = '/about';
  aboutPage.sections = aboutPage.sections.map((section) => ({
    ...section,
    pageId: aboutPage.pageId
  }));
  aboutPage.responsiveTransformations = aboutPage.responsiveTransformations.map(
    (transformation) => ({ ...transformation, pageId: aboutPage.pageId })
  );

  const forward = createMultiPageCompositionSignature([pageContract, aboutPage]);
  const reversed = createMultiPageCompositionSignature([aboutPage, pageContract]);
  const missing = createMultiPageCompositionSignature([pageContract]);
  assert.equal(multiPageSignatureSimilarity(forward, reversed), 1);
  assert.equal(multiPageSignatureSimilarity(forward, missing), 0.5);
  assert.equal(multiPageSignatureSimilarity(missing, forward), 0.5);
});
