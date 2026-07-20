import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESIGN_RULE_CATEGORIES,
  createDesignEngine,
  createInMemoryCompositionHistory,
  developDeterministicDesignPlan,
  getDesignRules,
  selectPreset,
  validateDesignPlan,
  type DesignPlanProvider
} from '@universal/design-engine';

test('default engine develops a complete validated plan without network access', async () => {
  const plan = await createDesignEngine().develop({
    prompt: 'An editorial portfolio for an architect'
  });

  assert.equal(plan.preset, 'editorial');
  assert.equal(plan.pageStructure.length, 4);
  assert.ok(plan.avoid.includes('nested cards'));
  assert.ok(plan.heroComposition.regions.length >= 3);
  assert.match(plan.implementationPrompt, /Follow the coordinates and relationships/i);
  assert.equal(plan.tasteDirection.profileId, 'anti-slop-craft-v1');
  assert.equal(validateDesignPlan(plan).ok, true);
});

test('preset selection preserves deterministic keyword behavior', () => {
  assert.equal(selectPreset({ prompt: 'A premium mechanical keyboard brand' }).name, 'industrial');
  assert.equal(selectPreset({ prompt: 'A luxury jewelry house' }).name, 'luxury');
  assert.equal(
    selectPreset({ prompt: 'Developer infrastructure for cloud teams' }).name,
    'technical'
  );
});

test('composition history is isolated per engine and deterministic for a fixed seed', async () => {
  const firstEngine = createDesignEngine();
  const first = await firstEngine.develop({
    prompt: 'An editorial culture organization',
    compositionSeed: 7
  });
  const second = await firstEngine.develop({
    prompt: 'An editorial culture organization',
    compositionSeed: 7
  });
  const isolated = await createDesignEngine().develop({
    prompt: 'An editorial culture organization',
    compositionSeed: 7
  });

  assert.notDeepEqual(first.compositionSignature, second.compositionSignature);
  assert.deepEqual(first.compositionSignature, isolated.compositionSignature);
});

test('concurrent developments use ordered explicit history', async () => {
  const engine = createDesignEngine();
  const [first, second] = await Promise.all([
    engine.develop({ prompt: 'A student AI organization', compositionSeed: 42 }),
    engine.develop({ prompt: 'A student AI organization', compositionSeed: 42 })
  ]);

  assert.notDeepEqual(first.compositionSignature, second.compositionSignature);
});

test('injects provider and history ports and validates provider output', async () => {
  const expected = developDeterministicDesignPlan({ prompt: 'An editorial archive' });
  const history = createInMemoryCompositionHistory([expected.compositionSignature]);
  let observedHistory = 0;
  const provider: DesignPlanProvider = {
    develop(_input, context) {
      observedHistory = context.recentSignatures.length;
      return expected;
    }
  };
  const engine = createDesignEngine({ provider, compositionHistory: history });

  assert.equal(await engine.develop({ prompt: 'Delegated brief' }), expected);
  assert.equal(observedHistory, 1);
  assert.equal(history.read().length, 2);

  const invalidEngine = createDesignEngine({
    provider: { develop: () => ({ preset: 'editorial', concept: 'Incomplete' }) }
  });
  await assert.rejects(
    invalidEngine.develop({ prompt: 'Untrusted provider output' }),
    /invalid design plan at heroComposition/i
  );
});

test('preserves motion, preferences, avoidance, and taste behavior', async () => {
  const motionPlan = await createDesignEngine().develop({
    prompt: 'A premium mechanical keyboard with a layered parallax exploded view on scroll',
    preferences: ['macro product photography']
  });
  assert.equal(motionPlan.motionDirection?.trigger, 'scroll-driven');
  assert.match(motionPlan.motionDirection?.signature ?? '', /exploded view/i);
  assert.match(motionPlan.motionDirection?.reducedMotion ?? '', /static/i);
  assert.ok(motionPlan.preferredVisualTreatments.includes('macro product photography'));

  const cursorPlan = await createDesignEngine().develop({
    prompt: 'A media archive with a revealing cursor and scroll motion',
    avoid: ['nested carousels']
  });
  assert.match(cursorPlan.tasteDirection.signatureInteraction?.concept ?? '', /cursor/i);
  assert.equal(cursorPlan.motionDirection, undefined);
  assert.ok(cursorPlan.prohibitedPatterns.includes('nested carousels'));
});

test('design rules remain deterministic engine policy', () => {
  const categoryGuidance = new Set<string>();
  for (const category of DESIGN_RULE_CATEGORIES) {
    const rules = getDesignRules(category);
    assert.equal(rules.category, category);
    assert.ok(rules.categoryPrinciples.length >= 2);
    assert.ok(rules.antiPatterns.includes('nested cards'));
    categoryGuidance.add(rules.categoryPrinciples.join('\n'));
  }
  assert.equal(categoryGuidance.size, DESIGN_RULE_CATEGORIES.length);
  assert.throws(() => getDesignRules('landing-page' as never), /Unsupported design rule category/);
});

test('validateDesignPlan remains the trust boundary for serialized output', () => {
  const plan = developDeterministicDesignPlan({ prompt: 'An editorial archive' });
  const malformed = validateDesignPlan({
    ...plan,
    tasteDirection: { ...plan.tasteDirection, decisions: [] }
  });

  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.path, 'tasteDirection.decisions');
});
