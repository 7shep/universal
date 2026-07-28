import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionRevisionInput, DiscoveryAnswer, PageMap } from '@universal/design-engine';
import {
  ArtDirectorError,
  ArtDirectorOrchestrator,
  createArtDirectorDependencies,
  parseArtDirectorSession,
  serializeArtDirectorSession,
  type ArtDirectorDependencies,
  type ArtDirectorSession
} from './art-director.js';
import { createArtDirectorMcpAdapter } from './art-director-mcp.js';

const pageMap: PageMap = {
  kind: 'single-page',
  pages: [
    {
      id: 'home',
      route: '/',
      name: 'Home',
      userGoal: 'Understand the release planner and start a trial.',
      primaryMessage: 'Plan releases without the scramble.',
      requiredSections: ['opening', 'workflow', 'proof', 'call to action'],
      requiredContent: ['headline', 'workflow explanation', 'customer proof'],
      primaryAction: 'Start a trial',
      secondaryActions: ['Read the docs'],
      navigationRelationship: 'Section anchors on the only route.',
      uniqueResponsibility: 'Explain the workflow and convert qualified teams.',
      sharedElements: ['navigation', 'footer'],
      pageSpecificElements: ['release workflow narrative']
    }
  ]
};

function answer(topic: DiscoveryAnswer['topic'], summary: string): DiscoveryAnswer {
  return {
    questionId: `discovery:${topic}`,
    topic,
    mode: 'exact',
    value: { summary },
    answeredAt: '2026-07-28T12:00:01.000Z'
  };
}

function dependencies(): ArtDirectorDependencies {
  let tick = 0;
  return createArtDirectorDependencies({
    now: () => `2026-07-28T12:00:${String(tick++).padStart(2, '0')}.000Z`,
    createSessionId: () => 'art-direction:test',
    conceptDirector: {
      async develop(brief) {
        return {
          briefId: brief.id,
          briefVersion: brief.version,
          approvedBriefDigest: brief.digest,
          candidates: [
            {
              id: 'signal-path',
              title: 'Signal Path',
              centralIdea: 'Treat a release as a calm, legible signal path.',
              risks: ['May feel too technical without human proof.']
            },
            {
              id: 'release-journal',
              title: 'Release Journal',
              centralIdea: 'Frame planning as an editorial record of decisions.',
              risks: ['Needs disciplined content hierarchy.']
            }
          ],
          evaluations: [
            { candidateId: 'signal-path', totalScore: 91 },
            { candidateId: 'release-journal', totalScore: 84 }
          ],
          recommendedCandidateId: 'signal-path',
          selectionRationale: 'It best joins clarity, distinctiveness, and responsive viability.'
        };
      }
    },
    planCompiler: {
      async compile({ brief, selectedDirection }) {
        return {
          contractVersion: '2.0.0',
          id: 'plan:test',
          conceptSpine: 'A calm signal path from uncertainty to release confidence.',
          source: {
            briefId: brief.id,
            briefDigest: brief.digest,
            directionId: selectedDirection.candidateId
          }
        };
      }
    }
  });
}

function completeDiscovery(
  orchestrator: ArtDirectorOrchestrator,
  session = orchestrator.start({ prompt: 'A release planning product website.' })
): ArtDirectorSession {
  return orchestrator.submit(session, {
    answers: [
      answer('purpose', 'Convert qualified product teams to trials.'),
      answer('audience', 'Release managers at small product teams.'),
      answer('page-content', 'Opening, workflow, proof, and trial call to action.')
    ],
    pageMap
  });
}

function approvedSession(orchestrator: ArtDirectorOrchestrator): ArtDirectorSession {
  const discovered = completeDiscovery(orchestrator);
  const reviewed = orchestrator.getBrief(discovered);
  return orchestrator.approve(reviewed, { approvedBy: 'alex' });
}

async function completedSession(orchestrator: ArtDirectorOrchestrator) {
  const approved = approvedSession(orchestrator);
  const developed = await orchestrator.develop(approved);
  const selected = orchestrator.selected(developed);
  return orchestrator.createPlan(selected);
}

test('complete workflow preserves approval provenance and digest bindings', async () => {
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const started = orchestrator.start({ prompt: 'A release planning product website.' });
  assert.equal(started.phase, 'discovery');
  assert.deepEqual(
    orchestrator.questions(started).map((question) => question.topic),
    ['purpose', 'audience']
  );

  const discovered = completeDiscovery(orchestrator, started);
  const reviewed = orchestrator.getBrief(discovered);
  assert.equal(reviewed.phase, 'brief-review');
  assert.equal(reviewed.discovery.brief?.approval.status, 'brief-ready');

  const approved = orchestrator.approve(reviewed, { approvedBy: 'alex' });
  assert.equal(approved.phase, 'brief-approved');
  assert.equal(approved.discovery.brief?.approval.approvedDigest, approved.discovery.brief?.digest);
  assert.equal(approved.discovery.brief?.approval.approvedBy, 'alex');

  const developed = await orchestrator.develop(approved);
  assert.equal(developed.phase, 'concepts-developed');
  assert.equal(developed.concepts?.approvedBriefDigest, approved.discovery.brief?.digest);

  const selected = orchestrator.selected(developed);
  assert.equal(selected.phase, 'direction-selected');
  assert.equal(selected.selectedDirection?.candidateId, 'signal-path');
  assert.equal(selected.selectedDirection?.conceptDigest, selected.concepts?.digest);

  const planned = await orchestrator.createPlan(selected);
  assert.equal(planned.phase, 'plan-created');
  assert.equal(planned.designPlan?.directionDigest, selected.selectedDirection?.digest);
  assert.equal(
    planned.designPlan?.approvedBriefDigest,
    planned.discovery.brief?.approval.approvedDigest
  );
  assert.equal((planned.designPlan?.plan as { contractVersion: string }).contractVersion, '2.0.0');
  const forged = JSON.parse(serializeArtDirectorSession(planned)) as {
    designPlan: { plan: { id: string } };
  };
  forged.designPlan.plan.id = 'tampered-plan';
  assert.throws(
    () => parseArtDirectorSession(JSON.stringify(forged)),
    (error: unknown) =>
      error instanceof ArtDirectorError &&
      error.code === 'INVALID_SESSION' &&
      /plan/i.test(error.message)
  );
});

test('premature transitions return actionable errors and never infer approval', async () => {
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const started = orchestrator.start({ prompt: 'A release planning product website.' });

  await assert.rejects(
    orchestrator.develop(started),
    (error: unknown) =>
      error instanceof ArtDirectorError &&
      error.code === 'ILLEGAL_TRANSITION' &&
      /approve/i.test(error.action)
  );
  assert.throws(
    () => orchestrator.approve(started),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'ILLEGAL_TRANSITION'
  );
  assert.throws(
    () => orchestrator.getBrief(started),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'BRIEF_NOT_READY'
  );
  assert.equal(started.discovery.approval.status, 'discovering');
});

test('revision after approval revokes approval and marks downstream artifacts stale', async () => {
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const completed = await completedSession(orchestrator);
  const oldBriefDigest = completed.discovery.brief!.digest;
  const decision: DecisionRevisionInput = {
    topic: 'audience',
    value: { summary: 'Release leaders at regulated product organizations.' },
    source: 'user',
    disposition: 'explicit',
    answerMode: 'exact',
    evidence: 'User expanded the target audience.'
  };

  const revised = orchestrator.revise(completed, {
    reason: 'Expand the audience to regulated organizations.',
    decisions: [decision]
  });
  assert.equal(revised.phase, 'brief-review');
  assert.equal(revised.discovery.brief?.approval.status, 'brief-ready');
  assert.notEqual(revised.discovery.brief?.digest, oldBriefDigest);
  assert.match(revised.concepts?.stale?.staleReason ?? '', /high-impact/i);
  assert.ok(revised.selectedDirection?.stale);
  assert.ok(revised.designPlan?.stale);

  const reapproved = orchestrator.approve(revised);
  assert.equal(reapproved.phase, 'brief-approved');
  assert.equal(
    reapproved.discovery.brief?.approval.approvedDigest,
    reapproved.discovery.brief?.digest
  );
});

test('stale concepts and stale selected directions cannot cross phase boundaries', async () => {
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const completed = await completedSession(orchestrator);
  const revised = orchestrator.revise(completed, {
    reason: 'Change the primary message.',
    decisions: [
      {
        topic: 'hero',
        value: { summary: 'Ship with a clear, reviewable release record.' },
        source: 'user',
        disposition: 'explicit',
        answerMode: 'exact',
        evidence: 'User supplied a revised hero message.'
      }
    ]
  });
  const reapproved = orchestrator.approve(revised);

  assert.throws(
    () => orchestrator.selected({ ...reapproved, phase: 'concepts-developed' }),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'STALE_CONCEPTS'
  );
  await assert.rejects(
    orchestrator.createPlan({ ...reapproved, phase: 'direction-selected' }),
    (error: unknown) =>
      error instanceof ArtDirectorError && error.code === 'STALE_SELECTED_DIRECTION'
  );
});

test('stable request ids make repeated mutations idempotent and reject conflicts', async () => {
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const started = orchestrator.start({ prompt: 'A release planning product website.' });
  const input = {
    requestId: 'answers-1',
    answers: [
      answer('purpose', 'Convert qualified product teams to trials.'),
      answer('audience', 'Release managers at small product teams.'),
      answer('page-content', 'Opening, workflow, proof, and trial call to action.')
    ],
    pageMap
  };
  const once = orchestrator.submit(started, input);
  const twice = orchestrator.submit(once, input);
  assert.equal(twice, once);
  assert.equal(twice.discovery.answers.length, 3);
  assert.throws(
    () =>
      orchestrator.submit(once, {
        ...input,
        answers: [answer('purpose', 'A conflicting purpose.')]
      }),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'REQUEST_ID_CONFLICT'
  );

  const approved = orchestrator.approve(orchestrator.getBrief(once), {
    requestId: 'approve-1'
  });
  const replayedApproval = orchestrator.approve(approved, { requestId: 'approve-1' });
  assert.equal(replayedApproval, approved);
  const developed = await orchestrator.develop(approved, { requestId: 'concepts-1' });
  assert.equal(await orchestrator.develop(developed, { requestId: 'concepts-1' }), developed);
});

test('serialized sessions reject malformed JSON and inconsistent phase artifacts', () => {
  assert.throws(
    () => parseArtDirectorSession('{not-json'),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'INVALID_SESSION'
  );
  const orchestrator = new ArtDirectorOrchestrator(dependencies());
  const started = orchestrator.start({ prompt: 'A release planning product website.' });
  const malformed = JSON.stringify({ ...started, phase: 'plan-created' });
  assert.throws(
    () => parseArtDirectorSession(malformed),
    (error: unknown) =>
      error instanceof ArtDirectorError &&
      error.code === 'INVALID_SESSION' &&
      /brief/i.test(error.message)
  );
  assert.throws(
    () =>
      parseArtDirectorSession(
        JSON.stringify({
          ...started,
          requestHistory: [{ id: 'retry-1', operation: 'unknown' }]
        })
      ),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'INVALID_SESSION'
  );
  const reviewed = orchestrator.getBrief(completeDiscovery(orchestrator, started));
  assert.throws(
    () =>
      parseArtDirectorSession(
        JSON.stringify({ ...reviewed, phase: 'concepts-developed', concepts: { digest: 'bad' } })
      ),
    (error: unknown) =>
      error instanceof ArtDirectorError &&
      error.code === 'INVALID_SESSION' &&
      /concept/i.test(error.message)
  );
  assert.deepEqual(parseArtDirectorSession(serializeArtDirectorSession(started)), started);
});

test('MCP adapter round-trips serialized state with deterministic injected services', async () => {
  const adapter = createArtDirectorMcpAdapter(new ArtDirectorOrchestrator(dependencies()));
  const started = await adapter.startArtDirection({
    prompt: 'A release planning product website.'
  });
  const questions = await adapter.getDiscoveryQuestions(started.session);
  assert.equal((questions.data as readonly unknown[]).length, 2);
  const submitted = await adapter.submitDiscoveryAnswers(started.session, {
    answers: [
      answer('purpose', 'Convert qualified product teams to trials.'),
      answer('audience', 'Release managers at small product teams.'),
      answer('page-content', 'Opening, workflow, proof, and trial call to action.')
    ],
    pageMap
  });
  const brief = await adapter.getCreativeBrief(submitted.session);
  const approved = await adapter.approveCreativeBrief(brief.session, { approvedBy: 'alex' });
  const concepts = await adapter.developArtDirection(approved.session);
  const direction = await adapter.getSelectedDirection(concepts.session);
  const plan = await adapter.createDesignPlanV2(direction.session);
  assert.equal(plan.state.phase, 'plan-created');
});
