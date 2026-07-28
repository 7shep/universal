import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import { createMcpArtDirectorClient, type ArtDirectorMcpTransport } from './studio-client.ts';

const validPlan = compileDesignPlanV2({
  brief: fixtureCreativeBrief,
  evaluation: fixtureSelectedDirectionEvaluation,
  providerOutput: serializedFixtureDesignPlanV2Draft,
  now: '2026-07-28T15:10:00.000Z'
});

function response(session: string, data?: unknown) {
  return {
    session,
    state: { id: 'studio:keyboard', createdAt: '2026-07-28T15:00:00.000Z' },
    ...(data === undefined ? {} : { data })
  };
}

test('MCP Studio client carries session state and keeps retries deterministic', async () => {
  const submissions: { requestId?: string; answers: readonly { answeredAt: string }[] }[] = [];
  const transport: ArtDirectorMcpTransport = {
    async startArtDirection() {
      return response('session:start');
    },
    async getDiscoveryQuestions(session) {
      assert.equal(session, 'session:start');
      return response(session, []);
    },
    async submitDiscoveryAnswers(_session, input) {
      submissions.push(input);
      return response('session:submitted');
    },
    async getCreativeBrief() {
      return response('session:brief', {
        decisions: [
          {
            id: 'decision:audience',
            topic: 'audience',
            value: { summary: 'Design-conscious keyboard buyers.' },
            source: 'user',
            disposition: 'explicit',
            evidence: 'User answered discovery:audience.',
            requiresConfirmation: false
          }
        ]
      });
    },
    async approveCreativeBrief() {
      return response('session:approved');
    },
    async developArtDirection() {
      return response('session:concepts', {
        candidates: [
          {
            id: 'editorial',
            title: 'Editorial Instrument',
            centralIdea: 'Treat the keyboard as a lasting editorial instrument.'
          },
          { id: 'workshop', title: 'Workshop Record', centralIdea: 'Document the makers.' },
          { id: 'calibration', title: 'Calibration Lab', centralIdea: 'Tune sound and feel.' }
        ]
      });
    },
    async getSelectedDirection() {
      return response('session:selected', {
        candidateId: 'editorial',
        rationale: 'Editorial Instrument is recommended for fit and distinctiveness.',
        candidate: {
          id: 'editorial',
          title: 'Editorial Instrument',
          centralIdea: 'Treat the keyboard as a lasting editorial instrument.',
          composition: 'Asymmetric folio columns.',
          typographyIntent: 'Condensed display and measured grotesk.',
          imageryIntent: 'Material macros and workshop documentary.',
          navigationPhilosophy: 'Quiet indexed masthead.',
          risks: ['Requires disciplined photography.']
        }
      });
    },
    async createDesignPlanV2() {
      return response('session:plan', { plan: validPlan });
    }
  };

  const client = createMcpArtDirectorClient(transport);
  const project = await client.startProject('Luxury mechanical keyboard company');
  assert.equal(project.session, 'session:start');
  assert.equal(project.workflowTimestamp, '2026-07-28T15:00:00.000Z');

  const first = await client.compileBrief(project);
  await client.compileBrief(project);
  assert.equal(submissions[0]!.requestId, submissions[1]!.requestId);
  assert.deepEqual(
    submissions[0]!.answers.map((answer) => answer.answeredAt),
    submissions[1]!.answers.map((answer) => answer.answeredAt)
  );

  const revised = structuredClone(project);
  revised.groups[0]!.questions[0]!.answer = 'Collectors who prioritize serviceable hardware.';
  await client.compileBrief(revised);
  assert.notEqual(submissions[0]!.requestId, submissions[2]!.requestId);

  const directed = await client.approveBrief(first);
  assert.equal(directed.session, 'session:selected');
  assert.equal(directed.direction?.alternatives.length, 2);
  const planned = await client.approveDirection(directed);
  assert.equal(planned.session, 'session:plan');
  assert.equal(planned.plan?.version, '2.0.0');
});
