import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compositionCatalog,
  compositionDomainCatalog,
  navigationCatalog,
  selectComposition,
  signatureSimilarity,
  validateCompositionCatalog,
  validateComposition,
  validateCompositionContract,
  validateCompositionSignature,
  type CompositionCatalogData,
  type CompositionSelectionInput,
  type CompositionSignature,
  type HeroArchetype,
  type NavigationDefinition
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
