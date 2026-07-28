import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDifferingConceptDimensions,
  validateDesignPlanV2,
  type ConceptCandidate,
  type DiscoveryAnswer,
  type PageMap
} from '@universal/design-engine';
import { ArtDirectorOrchestrator, ArtDirectorError } from './art-director.js';
import { createArtDirectorMcpAdapter } from './art-director-mcp.js';
import { createIntegratedArtDirectorDependencies } from './art-director-services.js';

const keyboardPages: PageMap = {
  kind: 'multi-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Understand why the keyboard is worth considering and explore the flagship model.',
      primaryMessage: 'A mechanical keyboard engineered as a lasting desktop instrument.',
      requiredSections: [
        'hero',
        'material story',
        'flagship proof',
        'editorial detail',
        'purchase path'
      ],
      requiredContent: ['flagship keyboard', 'machined aluminum', 'switch options', 'warranty'],
      primaryAction: 'Explore the flagship keyboard',
      secondaryActions: ['Compare switches', 'Read the design story'],
      navigationRelationship: 'Primary entry in a restrained global product index.',
      uniqueResponsibility:
        'Establish desire, engineering credibility, and a clear route to product detail.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['material macro photography', 'flagship overview']
    },
    {
      id: 'product',
      route: '/keyboards/monolith-75',
      name: 'Monolith 75',
      userGoal: 'Evaluate configuration, acoustics, materials, and delivery before purchase.',
      primaryMessage:
        'Configure a precisely tuned 75% keyboard without sacrificing serviceability.',
      requiredSections: [
        'configuration',
        'sound and feel',
        'materials',
        'specifications',
        'purchase'
      ],
      requiredContent: ['layout', 'switches', 'keycaps', 'dimensions', 'lead time', 'price'],
      primaryAction: 'Configure Monolith 75',
      secondaryActions: ['Listen to sound tests'],
      navigationRelationship:
        'Product detail beneath the keyboard index with persistent configuration access.',
      uniqueResponsibility:
        'Turn tactile and engineering qualities into a confident purchase decision.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['configuration matrix', 'sound recordings', 'specification table']
    },
    {
      id: 'craft',
      route: '/craft',
      name: 'Craft',
      userGoal: 'Verify the company’s manufacturing philosophy and long-term support.',
      primaryMessage: 'Designed to be maintained, repaired, and kept in use.',
      requiredSections: ['design principles', 'manufacturing', 'assembly', 'repair', 'makers'],
      requiredContent: ['design process', 'material sourcing', 'repair program', 'team'],
      primaryAction: 'Read the repair promise',
      secondaryActions: ['Meet the makers'],
      navigationRelationship:
        'Editorial route adjacent to products, never hidden as corporate filler.',
      uniqueResponsibility: 'Provide human and operational proof behind the luxury positioning.',
      sharedElements: ['global navigation', 'service footer'],
      pageSpecificElements: ['workshop documentary', 'exploded assembly drawing']
    }
  ]
};

function answer(
  topic: DiscoveryAnswer['topic'],
  summary: string,
  mode: DiscoveryAnswer['mode'] = 'exact',
  details?: readonly string[]
): DiscoveryAnswer {
  return {
    questionId: `discovery:${topic}`,
    topic,
    mode,
    value: { summary, ...(details ? { details } : {}) },
    answeredAt: '2026-07-28T14:01:00.000Z'
  };
}

test('golden: luxury mechanical keyboard discovery compiles an approved Design Plan v2', async () => {
  let tick = 0;
  const orchestrator = new ArtDirectorOrchestrator(
    createIntegratedArtDirectorDependencies({
      now: () => `2026-07-28T14:${String(tick++).padStart(2, '0')}:00.000Z`,
      createSessionId: () => 'art-direction:luxury-keyboard'
    })
  );
  const adapter = createArtDirectorMcpAdapter(orchestrator);
  const started = await adapter.startArtDirection({
    prompt: 'Luxury mechanical keyboard company',
    requestId: 'keyboard:start'
  });
  const questions = await adapter.getDiscoveryQuestions(started.session);
  const initialTopics = (questions.data as { topic: string }[]).map((question) => question.topic);
  assert.ok(initialTopics.includes('audience'));

  const submitted = await adapter.submitDiscoveryAnswers(started.session, {
    requestId: 'keyboard:discovery',
    pageMap: keyboardPages,
    answers: [
      answer(
        'purpose',
        'Sell the flagship keyboard while establishing a durable luxury hardware brand.'
      ),
      answer(
        'audience',
        'Design-conscious developers, writers, and collectors who value tactility, repairability, and restrained objects.'
      ),
      answer('hero', 'Monolith 75. Built to outlast the desk around it.'),
      answer(
        'color',
        'Near-black anodized aluminum, warm nickel, bone keycaps, and one oxblood signal.',
        'preference'
      ),
      answer(
        'navigation',
        'A quiet product index: Keyboards, Switches, Craft, Journal, Support, Configure.'
      ),
      answer(
        'page-content',
        'Lead with the flagship, prove sound and materials, expose configuration and service details, then document the workshop.'
      ),
      answer(
        'imagery',
        'Macro material studies, honest desk context, exploded assemblies, and workshop portraits; never neon gaming scenes.'
      ),
      answer(
        'anti-patterns',
        'Reject gamer neon, floating feature cards, generic SaaS bento grids, fake scarcity, and black-and-gold luxury clichés.',
        'preference'
      )
    ]
  });
  const reviewed = await adapter.getCreativeBrief(submitted.session, {
    requestId: 'keyboard:brief'
  });
  assert.equal(reviewed.state.discovery.brief?.approval.status, 'brief-ready');
  assert.throws(
    () => orchestrator.selected(reviewed.state),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'ILLEGAL_TRANSITION'
  );
  await assert.rejects(
    () => adapter.developArtDirection(reviewed.session, { requestId: 'keyboard:too-early' }),
    (error: unknown) =>
      error instanceof ArtDirectorError &&
      ['BRIEF_NOT_APPROVED', 'ILLEGAL_TRANSITION'].includes(error.code)
  );

  const approved = await adapter.approveCreativeBrief(reviewed.session, {
    approvedBy: 'golden-test-user',
    requestId: 'keyboard:approve'
  });
  const brief = approved.state.discovery.brief!;
  assert.equal(brief.approval.status, 'approved');
  assert.equal(brief.approval.approvedBy, 'golden-test-user');
  assert.equal(brief.approval.approvedDigest, brief.digest);
  for (const topic of ['purpose', 'audience', 'page-map', 'page-content'] as const) {
    const decision = [...brief.decisions].reverse().find((item) => item.topic === topic);
    assert.ok(decision, `missing ${topic} decision`);
    assert.equal(decision.requiresConfirmation, false);
    assert.equal(decision.source, 'user');
  }

  const developed = await adapter.developArtDirection(approved.session, {
    requestId: 'keyboard:concepts'
  });
  const candidates = developed.state.concepts!.candidates as ConceptCandidate[];
  assert.equal(candidates.length, 3);
  for (let left = 0; left < candidates.length; left += 1)
    for (let right = left + 1; right < candidates.length; right += 1)
      assert.ok(getDifferingConceptDimensions(candidates[left]!, candidates[right]!).length >= 4);

  const selected = await adapter.getSelectedDirection(developed.session, {
    requestId: 'keyboard:direction'
  });
  assert.ok(selected.state.selectedDirection?.rationale.includes('recommended'));
  assert.ok(selected.state.selectedDirection?.evaluation);
  assert.equal(
    selected.state.selectedDirection?.candidateId,
    selected.state.concepts?.recommendedCandidateId
  );

  const planned = await adapter.createDesignPlanV2(selected.session, {
    requestId: 'keyboard:plan'
  });
  const plan = planned.state.designPlan!.plan;
  const validation = validateDesignPlanV2(plan);
  assert.equal(validation.ok, true, validation.ok ? undefined : validation.error.message);
  if (!validation.ok) return;
  assert.equal(validation.value.source.briefDigest, brief.digest);
  assert.equal(validation.value.pageMap.pages.length, 3);
  assert.equal(validation.value.pageNarrative.value.length, 3);
  assert.ok(validation.value.prohibitedPatterns.value.some((pattern) => /bento/i.test(pattern)));
  assert.ok(
    validation.value.decisionProvenance.some((item) => item.sourceKind === 'user-decision')
  );
  assert.ok(
    validation.value.decisionProvenance.some(
      (item) => item.sourceKind === 'universal-recommendation'
    )
  );
});
