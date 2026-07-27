import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerDiscoveryQuestion,
  approveDiscoveryBrief,
  evaluateDiscoveryPolicy,
  getNextDiscoveryQuestions,
  requestDiscoveryApproval,
  requestDiscoveryRevision,
  reviseDiscoveryBrief,
  setDiscoveryPageMap,
  startDiscoverySession,
  toDesignPlanBrief,
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
        id: 'decision:audience:2',
        topic: 'audience',
        value: { summary: 'Release managers at small product teams.' },
        source: 'user',
        disposition: 'explicit',
        answerMode: 'exact',
        evidence: 'User revision.',
        revision: 2,
        requiresConfirmation: false
      }
    ]
  });
  assert.equal(session.approval.status, 'brief-ready');
  assert.notEqual(session.brief!.digest, oldDigest);
  assert.equal(session.brief!.version, 2);
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
