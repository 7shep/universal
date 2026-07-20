import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESIGN_ORCHESTRATION_API_VERSION,
  DESIGN_RULE_CATEGORIES,
  createDesignOrchestrator,
  emptyDesignPlanSession,
  getDesignRules,
  parseContract,
  selectPreset,
  serializeContract,
  validateDesignPlan,
  type DesignPlanProvider,
  type SerializedContractKind
} from '@universal/design-engine';
import { fixturePlan, serializedContractFixtures } from '@universal/design-engine/fixtures';

test('canonical orchestrator develops and validates a plan without network access', async () => {
  const orchestrator = createDesignOrchestrator();
  const result = await orchestrator.developPlan({
    brief: { prompt: 'An editorial portfolio for an architect' },
    session: emptyDesignPlanSession()
  });

  assert.equal(orchestrator.version, DESIGN_ORCHESTRATION_API_VERSION);
  assert.equal(result.plan.preset, 'editorial');
  assert.equal(result.plan.pageStructure.length, 4);
  assert.ok(result.plan.avoid.includes('nested cards'));
  assert.ok(result.plan.heroComposition.regions.length >= 3);
  assert.match(result.plan.implementationPrompt, /Follow the coordinates and relationships/i);
  assert.equal(result.plan.tasteDirection.profileId, 'anti-slop-craft-v1');
  assert.equal(orchestrator.validatePlan(result.plan).ok, true);
  assert.deepEqual(result.session.compositionHistory, [result.plan.compositionSignature]);
});

test('preset selection preserves deterministic keyword behavior', () => {
  assert.equal(selectPreset({ prompt: 'A premium mechanical keyboard brand' }).name, 'industrial');
  assert.equal(selectPreset({ prompt: 'A luxury jewelry house' }).name, 'luxury');
  assert.equal(
    selectPreset({ prompt: 'Developer infrastructure for cloud teams' }).name,
    'technical'
  );
});

test('history is explicit and round-trips between plan developments', async () => {
  const orchestrator = createDesignOrchestrator();
  const request = {
    brief: { prompt: 'An editorial culture organization', compositionSeed: 7 },
    session: emptyDesignPlanSession()
  };
  const first = await orchestrator.developPlan(request);
  const second = await orchestrator.developPlan({ ...request, session: first.session });
  const isolated = await orchestrator.developPlan(request);

  assert.notDeepEqual(first.plan.compositionSignature, second.plan.compositionSignature);
  assert.deepEqual(first.plan.compositionSignature, isolated.plan.compositionSignature);
  assert.equal(second.session.compositionHistory.length, 2);
});

test('concurrent calls do not share hidden history', async () => {
  const orchestrator = createDesignOrchestrator();
  const request = {
    brief: { prompt: 'A student AI organization', compositionSeed: 42 },
    session: emptyDesignPlanSession()
  };
  const [first, second] = await Promise.all([
    orchestrator.developPlan(request),
    orchestrator.developPlan(request)
  ]);

  assert.deepEqual(first, second);
});

test('injects a provider, supplies session history, and validates provider output', async () => {
  const expected = fixturePlan;
  let observedHistory = 0;
  const provider: DesignPlanProvider = {
    develop(_input, context) {
      observedHistory = context.recentSignatures.length;
      return expected;
    }
  };
  const orchestrator = createDesignOrchestrator({ provider });
  const result = await orchestrator.developPlan({
    brief: { prompt: 'Delegated brief' },
    session: { compositionHistory: [expected.compositionSignature] }
  });

  assert.equal(result.plan, expected);
  assert.equal(observedHistory, 1);
  assert.equal(result.session.compositionHistory.length, 2);

  const invalidOrchestrator = createDesignOrchestrator({
    provider: { develop: () => ({ preset: 'editorial', concept: 'Incomplete' }) }
  });
  await assert.rejects(
    invalidOrchestrator.developPlan({
      brief: { prompt: 'Untrusted provider output' },
      session: emptyDesignPlanSession()
    }),
    /invalid design plan at artDirection/i
  );
});

test('preserves motion, preferences, avoidance, and taste behavior', async () => {
  const orchestrator = createDesignOrchestrator();
  const motionPlan = (
    await orchestrator.developPlan({
      brief: {
        prompt: 'A premium mechanical keyboard with a layered parallax exploded view on scroll',
        preferences: ['macro product photography']
      },
      session: emptyDesignPlanSession()
    })
  ).plan;
  assert.equal(motionPlan.motionDirection?.trigger, 'scroll-driven');
  assert.match(motionPlan.motionDirection?.signature ?? '', /exploded view/i);
  assert.match(motionPlan.motionDirection?.reducedMotion ?? '', /static/i);
  assert.ok(motionPlan.preferredVisualTreatments.includes('macro product photography'));

  const cursorPlan = (
    await orchestrator.developPlan({
      brief: {
        prompt: 'A media archive with a revealing cursor and scroll motion',
        avoid: ['nested carousels']
      },
      session: emptyDesignPlanSession()
    })
  ).plan;
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
  const malformed = validateDesignPlan({
    ...fixturePlan,
    tasteDirection: { ...fixturePlan.tasteDirection, decisions: [] }
  });

  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.path, 'tasteDirection.decisions');
});

test('checked-in public contract fixtures validate and round-trip byte-for-byte', () => {
  const kinds: readonly SerializedContractKind[] = [
    'brief',
    'plan',
    'direction',
    'project-request',
    'review-context'
  ];
  for (const kind of kinds) {
    const serialized = serializedContractFixtures[kind];
    const parsed = parseContract(kind, serialized);
    assert.equal(parsed.ok, true, `${kind} fixture should validate`);
    if (parsed.ok) assert.equal(serializeContract(parsed.value), serialized);
  }
});

test('serialized contract parsing reports invalid JSON and typed paths', () => {
  const invalidJson = parseContract('brief', '{');
  assert.equal(invalidJson.ok, false);
  if (!invalidJson.ok) assert.equal(invalidJson.error.path, '$');

  const invalidBrief = parseContract('brief', '{"prompt":""}');
  assert.equal(invalidBrief.ok, false);
  if (!invalidBrief.ok) assert.equal(invalidBrief.error.path, 'prompt');
});
