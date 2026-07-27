import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerDiscoveryQuestion,
  approveDiscoveryBrief,
  digestCreativeBrief,
  evaluateDiscoveryPolicy,
  getNextDiscoveryQuestions,
  requestDiscoveryApproval,
  requestDiscoveryRevision,
  reviseDiscoveryBrief,
  setDiscoveryPageMap,
  startDiscoverySession,
  toDesignPlanBrief,
  validateCreativeBrief,
  validateDiscoverySession,
  validatePageMap,
  type DiscoverySession,
  type PageMap
} from '@universal/design-engine';

const pageMap: PageMap = {
  kind: 'single-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Understand the product and start a trial.',
      primaryMessage: 'A calmer way to plan releases.',
      requiredSections: ['opening', 'workflow', 'proof', 'call to action'],
      requiredContent: ['headline', 'explanation', 'customer proof'],
      primaryAction: 'Start a trial',
      secondaryActions: ['Read the docs'],
      navigationRelationship: 'Section anchors on the only route.',
      uniqueResponsibility: 'Explain and convert.',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['workflow narrative']
    }
  ]
};

function respond(
  session: DiscoverySession,
  topic: Parameters<typeof answerDiscoveryQuestion>[1]['topic'],
  mode: Parameters<typeof answerDiscoveryQuestion>[1]['mode'],
  summary?: string
): DiscoverySession {
  return answerDiscoveryQuestion(session, {
    questionId: `discovery:${topic}`,
    topic,
    mode,
    ...(summary ? { value: { summary } } : {}),
    answeredAt: '2026-07-27T10:01:00.000Z'
  });
}

function completeCore(): DiscoverySession {
  let session = startDiscoverySession({
    id: 'planner',
    prompt: 'A release planner website.',
    now: '2026-07-27T10:00:00.000Z'
  });
  session = respond(session, 'purpose', 'exact', 'Convert qualified visitors to trials.');
  session = respond(session, 'audience', 'preference', 'Small product teams.');
  session = setDiscoveryPageMap(session, pageMap, {
    now: '2026-07-27T10:02:00.000Z',
    source: 'user',
    evidence: 'User selected one page.'
  });
  return respond(session, 'page-content', 'exact', 'Opening, workflow, proof, and trial CTA.');
}

test('missing detection and adaptive ordering are deterministic', () => {
  let session = startDiscoverySession({
    id: 'ordering',
    prompt: 'A product site.',
    now: '2026-07-27T10:00:00.000Z'
  });
  assert.deepEqual(
    getNextDiscoveryQuestions(session).map((q) => q.topic),
    ['purpose', 'audience']
  );
  session = respond(session, 'purpose', 'exact', 'Generate qualified leads.');
  assert.deepEqual(
    getNextDiscoveryQuestions(session).map((q) => q.topic),
    ['audience', 'page-map', 'positioning']
  );
});

test('answer modes produce deterministic provenance and follow-up states', () => {
  let session = startDiscoverySession({
    id: 'modes',
    prompt: 'A product site.',
    now: '2026-07-27T10:00:00.000Z'
  });
  session = respond(session, 'purpose', 'exact', 'Increase trials.');
  session = respond(session, 'audience', 'preference', 'Operations leaders.');
  session = respond(session, 'positioning', 'unknown');
  session = respond(session, 'emotional-response', 'use-judgment');
  session = respond(session, 'hero', 'draft');
  assert.deepEqual(
    session.decisions.map((d) => d.disposition),
    ['explicit', 'preferred', 'delegated']
  );
  const missing = evaluateDiscoveryPolicy(session).missing;
  assert.equal(missing.find((m) => m.topic === 'positioning')?.reason, 'awaiting-recommendation');
  assert.equal(missing.find((m) => m.topic === 'hero')?.reason, 'awaiting-draft');
});

test('single-page maps are first-class and inconsistent kinds fail validation', () => {
  assert.equal(validatePageMap(pageMap).ok, true);
  assert.equal(validatePageMap({ ...pageMap, kind: 'multi-page' }).ok, false);
});

test('model interpretation cannot bypass high-impact confirmation', () => {
  let session = startDiscoverySession({
    id: 'boundary',
    prompt: 'A product site.',
    now: '2026-07-27T10:00:00.000Z',
    interpretations: [
      {
        topic: 'purpose',
        value: { summary: 'Convert teams to trials.' },
        source: 'model',
        evidence: 'Inferred from the prompt.'
      }
    ]
  });
  assert.equal(session.decisions[0]?.requiresConfirmation, true);
  assert.equal(evaluateDiscoveryPolicy(session).missing[0]?.reason, 'confirmation-required');
  session = respond(session, 'purpose', 'exact', 'Convert qualified teams to trials.');
  assert.ok(!evaluateDiscoveryPolicy(session).missing.some((m) => m.topic === 'purpose'));
});

test('approval, digest, revision, and DesignPlanBrief conversion round-trip', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T10:03:00.000Z');
  session = approveDiscoveryBrief(session, '2026-07-27T10:04:00.000Z', 'alex');
  assert.equal(session.brief?.approval.approvedDigest, session.brief?.digest);
  const compatible = toDesignPlanBrief(session.brief!, { compositionSeed: 23 });
  assert.equal(compatible.audience, 'Small product teams.');
  assert.equal(compatible.websiteType, 'single-page website');
  assert.equal(compatible.compositionSeed, 23);
  session = requestDiscoveryRevision(session, '2026-07-27T10:05:00.000Z', 'Change audience.');
  assert.equal(session.approval.status, 'revision-requested');
  assert.throws(() => toDesignPlanBrief(session.brief!), /requires an approved/i);
  const oldDigest = session.brief!.digest;
  session = reviseDiscoveryBrief(session, {
    now: '2026-07-27T10:06:00.000Z',
    reason: 'Focus the audience on release managers.',
    decisions: [
      {
        topic: 'audience',
        value: { summary: 'Release managers at small product teams.' },
        source: 'user',
        disposition: 'explicit',
        answerMode: 'exact',
        evidence: 'User revision.'
      }
    ]
  });
  assert.equal(session.approval.status, 'brief-ready');
  assert.notEqual(session.brief!.digest, oldDigest);
  assert.equal(session.brief!.version, 2);
});

test('revisions reproject references and current preferred decisions into content', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T10:06:30.000Z');
  session = requestDiscoveryRevision(session, '2026-07-27T10:06:40.000Z', 'Add direction inputs.');
  const previousDigest = session.brief!.digest;
  session = reviseDiscoveryBrief(session, {
    now: '2026-07-27T10:06:50.000Z',
    reason: 'Record a new reference and preferred color direction.',
    decisions: [
      {
        topic: 'references',
        value: {
          summary: 'Braun industrial design archive',
          details: ['Swiss railway wayfinding system']
        },
        source: 'user',
        disposition: 'explicit',
        answerMode: 'exact',
        evidence: 'User supplied two visual references.'
      },
      {
        topic: 'color',
        value: { summary: 'Warm off-white with signal orange.' },
        source: 'user',
        disposition: 'preferred',
        answerMode: 'preference',
        evidence: 'User selected the preferred palette direction.'
      }
    ]
  });
  const brief = session.brief!;
  assert.deepEqual(brief.content.references, [
    { description: 'Braun industrial design archive', role: 'inspiration' },
    { description: 'Swiss railway wayfinding system', role: 'inspiration' }
  ]);
  assert.equal(brief.content.color?.summary, 'Warm off-white with signal orange.');
  assert.ok(brief.content.preferences.includes('Warm off-white with signal orange.'));
  assert.ok(brief.content.preferences.includes('Small product teams.'));
  assert.notEqual(brief.digest, previousDigest);
  assert.equal(brief.digest, digestCreativeBrief(brief));
  assert.equal(validateCreativeBrief(brief).ok, true);

  const compatible = toDesignPlanBrief(brief, { requireApproval: false });
  assert.deepEqual(compatible.references, brief.content.references);
  assert.deepEqual(compatible.preferences, brief.content.preferences);
});
test('mutations invalidate a pending brief and prevent stale approval', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T10:03:00.000Z');
  session = respond(session, 'hero', 'exact', 'Plan releases without the scramble.');
  assert.equal(session.approval.status, 'discovering');
  assert.equal(session.brief, undefined);
  assert.throws(
    () => approveDiscoveryBrief(session, '2026-07-27T10:04:00.000Z'),
    /prepare and request approval/i
  );
});

test('page-map changes invalidate pending approval and cannot mutate an approved brief', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T10:03:00.000Z');
  session = setDiscoveryPageMap(session, pageMap, {
    now: '2026-07-27T10:04:00.000Z',
    source: 'user',
    evidence: 'User reconfirmed the page map.'
  });
  assert.equal(session.approval.status, 'discovering');
  assert.equal(session.brief, undefined);

  session = requestDiscoveryApproval(session, '2026-07-27T10:05:00.000Z');
  session = approveDiscoveryBrief(session, '2026-07-27T10:06:00.000Z');
  assert.throws(
    () =>
      setDiscoveryPageMap(session, pageMap, {
        now: '2026-07-27T10:07:00.000Z',
        source: 'user',
        evidence: 'Attempted post-approval mutation.'
      }),
    /reopen the approved brief/i
  );
});
test('model page maps cannot claim explicit provenance through caller options', () => {
  const session = startDiscoverySession({
    id: 'page-map-boundary',
    prompt: 'A product site.',
    now: '2026-07-27T11:00:00.000Z'
  });
  const updated = setDiscoveryPageMap(session, pageMap, {
    now: '2026-07-27T11:01:00.000Z',
    source: 'model',
    evidence: 'Model proposed a one-page structure.',
    disposition: 'explicit'
  } as never);
  const decision = updated.decisions.at(-1)!;
  assert.equal(decision.source, 'model');
  assert.equal(decision.disposition, 'drafted');
  assert.equal(decision.requiresConfirmation, true);
  assert.equal(
    evaluateDiscoveryPolicy(updated).missing.find((item) => item.topic === 'page-map')?.reason,
    'confirmation-required'
  );
});

test('brief revisions normalize malicious provenance and confirmation fields', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T11:02:00.000Z');
  session = requestDiscoveryRevision(session, '2026-07-27T11:03:00.000Z', 'Test trust boundary.');
  session = reviseDiscoveryBrief(session, {
    now: '2026-07-27T11:04:00.000Z',
    reason: 'Model proposed a new audience.',
    decisions: [
      {
        id: 'decision:audience:999',
        topic: 'audience',
        value: { summary: 'Enterprise release organizations.' },
        source: 'model',
        disposition: 'explicit',
        evidence: 'Inferred from surrounding copy.',
        revision: 999,
        requiresConfirmation: false
      }
    ]
  } as never);
  const decision = session.decisions.at(-1)!;
  assert.equal(decision.id, 'decision:audience:2');
  assert.equal(decision.revision, 2);
  assert.equal(decision.disposition, 'assumed');
  assert.equal(decision.requiresConfirmation, true);
  assert.equal(
    session.brief?.unresolved.find((item) => item.topic === 'audience')?.reason,
    'confirmation-required'
  );
});

test('bare page maps in brief revisions remain untrusted drafts', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T11:04:30.000Z');
  session = requestDiscoveryRevision(session, '2026-07-27T11:04:40.000Z', 'Change structure.');
  session = reviseDiscoveryBrief(session, {
    now: '2026-07-27T11:04:50.000Z',
    reason: 'Propose a revised page structure.',
    pageMap: {
      ...pageMap,
      pages: [{ ...pageMap.pages[0]!, name: 'Revised home' }]
    }
  });
  const mapDecision = session.decisions.at(-1)!;
  assert.equal(mapDecision.topic, 'page-map');
  assert.equal(mapDecision.source, 'model');
  assert.equal(mapDecision.disposition, 'drafted');
  assert.equal(mapDecision.requiresConfirmation, true);
  assert.equal(
    session.brief?.unresolved.find((item) => item.topic === 'page-map')?.reason,
    'confirmation-required'
  );
});
test('validators reject forged digests, duplicate revisions, and divergent nested state', () => {
  let session = completeCore();
  session = requestDiscoveryApproval(session, '2026-07-27T11:05:00.000Z');
  session = approveDiscoveryBrief(session, '2026-07-27T11:06:00.000Z', 'alex');
  const brief = session.brief!;

  const forgedBrief = {
    ...brief,
    content: { ...brief.content, purpose: { summary: 'Tampered purpose.' } }
  };
  const forgedResult = validateCreativeBrief(forgedBrief);
  assert.equal(forgedResult.ok, false);
  if (!forgedResult.ok) assert.equal(forgedResult.error.path, 'digest');

  const duplicateDecision = brief.decisions[0]!;
  const duplicateResult = validateCreativeBrief({
    ...brief,
    decisions: [...brief.decisions, duplicateDecision]
  });
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) assert.match(duplicateResult.error.message, /unique/i);

  const divergentApproval = validateDiscoverySession({
    ...session,
    approval: { status: 'brief-ready' }
  });
  assert.equal(divergentApproval.ok, false);
  if (!divergentApproval.ok)
    assert.match(divergentApproval.error.message, /approval states must match/i);

  const forgedNestedDigest = validateDiscoverySession({
    ...session,
    brief: { ...brief, digest: 'discovery-v1-deadbeef' }
  });
  assert.equal(forgedNestedDigest.ok, false);
  if (!forgedNestedDigest.ok) assert.equal(forgedNestedDigest.error.path, 'brief.digest');
});
