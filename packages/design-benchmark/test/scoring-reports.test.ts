import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBlindScoringPacket,
  createPairedComparisonReport,
  createRegressionReport,
  createSeededBlindAssignment,
  scoreSubmission,
  serializeDeterministically,
  unblindScores,
  type BlindSubmission,
  type ScoringRubric
} from '../src/index.ts';

const rubric: ScoringRubric = {
  id: 'quality',
  version: '1.0.0',
  minimumEvaluableSourceWeight: 0.5,
  criteria: [
    {
      id: 'source-quality',
      label: 'Source quality',
      description: 'A source-evaluable criterion.',
      maxScore: 5,
      weight: 0.5,
      evidenceKind: 'source',
      scoringGuidance: []
    },
    {
      id: 'visual-hierarchy',
      label: 'Visual hierarchy',
      description: 'A rendered-only criterion.',
      maxScore: 5,
      weight: 0.5,
      evidenceKind: 'rendered',
      scoringGuidance: []
    }
  ]
};

const submission = (blindId: string, rendered = false): BlindSubmission => ({
  blindId,
  briefId: 'brief-01',
  suiteVersion: '1.0.0',
  sourceEvidence: [{ id: 'source-app', path: 'src/App.tsx', digest: 'abc' }],
  renderedEvidence: rendered
    ? [
        {
          id: 'render-desktop',
          artifactPath: 'renders/desktop.png',
          digest: 'def',
          viewport: '1440x900'
        }
      ]
    : []
});

test('blind packets are deterministic and omit arm allocation', () => {
  const packet = createBlindScoringPacket(
    rubric,
    [submission('B'), submission('A')],
    'a'.repeat(64)
  );
  assert.deepEqual(
    packet.submissions.map((item) => item.blindId),
    ['A', 'B']
  );
  assert.ok(packet.submissions.every((item) => !('arm' in item)));
  assert.equal(
    serializeDeterministically({ z: 1, a: 2 }),
    serializeDeterministically({ a: 2, z: 1 })
  );
});

test('rendered-only criteria remain not evaluable without rendered evidence', () => {
  const result = scoreSubmission(submission('A'), rubric, [
    {
      criterionId: 'source-quality',
      score: 4,
      rationale: 'The source evidence supports the judgment.',
      evidenceIds: ['source-app']
    },
    {
      criterionId: 'visual-hierarchy',
      score: 5,
      rationale: 'This unsupported judgment must be ignored.',
      evidenceIds: []
    }
  ]);
  assert.equal(
    result.criteria.find((item) => item.criterionId === 'visual-hierarchy')?.status,
    'not_evaluable'
  );
  assert.equal(result.normalizedScore, 80);
  assert.equal(result.evaluableFraction, 0.5);
});

test('paired and regression reports use normalized scores deterministically', () => {
  const score = (blindId: string, raw: number) =>
    scoreSubmission(submission(blindId), rubric, [
      {
        criterionId: 'source-quality',
        score: raw,
        rationale: 'The source evidence supports the judgment.',
        evidenceIds: ['source-app']
      }
    ]);
  const baseline = unblindScores(
    [score('A', 4), score('B', 5)],
    [
      { blindId: 'A', arm: 'unguided' },
      { blindId: 'B', arm: 'universal_guided' }
    ]
  );
  const paired = createPairedComparisonReport(baseline);
  assert.equal(paired.pairs[0]?.delta, 20);
  assert.equal(paired.pairs[0]?.winner, 'universal_guided');

  const current = baseline.map((item) => ({
    ...item,
    normalizedScore: item.arm === 'unguided' ? 70 : 100
  }));
  const regression = createRegressionReport(baseline, current, { regressionThreshold: 5 });
  assert.equal(regression.entries.find((item) => item.arm === 'unguided')?.status, 'regressed');
  assert.equal(
    regression.entries.find((item) => item.arm === 'universal_guided')?.status,
    'unchanged'
  );
});

test('uses declared weights and withholds totals below minimum source coverage', () => {
  const weightedRubric: ScoringRubric = {
    id: 'weighted',
    version: '1.0.0',
    minimumEvaluableSourceWeight: 0.7,
    criteria: [
      { ...rubric.criteria[0]!, id: 'major', weight: 0.7 },
      { ...rubric.criteria[0]!, id: 'minor', weight: 0.3 }
    ]
  };
  const complete = scoreSubmission(submission('weighted'), weightedRubric, [
    { criterionId: 'major', score: 5, rationale: 'Major evidence.', evidenceIds: ['source-app'] },
    { criterionId: 'minor', score: 0, rationale: 'Minor evidence.', evidenceIds: ['source-app'] }
  ]);
  assert.equal(complete.normalizedScore, 70);
  const insufficient = scoreSubmission(submission('partial'), weightedRubric, [
    {
      criterionId: 'minor',
      score: 5,
      rationale: 'Only minor evidence.',
      evidenceIds: ['source-app']
    }
  ]);
  assert.equal(insufficient.evaluableSourceWeight, 0.3);
  assert.equal(insufficient.normalizedScore, null);
});

test('seeded assignments are deterministic and scorer packets strip undeclared fields', () => {
  const candidates = (['unguided', 'universal_guided'] as const).map((arm) => ({
    briefId: 'brief-01',
    suiteVersion: '1.0.0',
    arm,
    sourceEvidence: [{ id: 'source-app', path: 'src/App.tsx', digest: 'abc', arm_id: arm }],
    renderedEvidence: [],
    workflow: arm
  }));
  const first = createSeededBlindAssignment(rubric, candidates, 'seed-1');
  const second = createSeededBlindAssignment(rubric, [...candidates].reverse(), 'seed-1');
  assert.deepEqual(second, first);
  assert.match(first.assignmentDigest, /^[a-f0-9]{64}$/);
  const serialized = serializeDeterministically(first.packet);
  assert.doesNotMatch(serialized, /arm_id|workflow|universal_guided|unguided/);
});

test('regressions reject mismatched suite versions', () => {
  const score = scoreSubmission(submission('A'), rubric, [
    {
      criterionId: 'source-quality',
      score: 4,
      rationale: 'Evidence.',
      evidenceIds: ['source-app']
    }
  ]);
  const baseline = unblindScores([score], [{ blindId: 'A', arm: 'unguided' }]);
  const current = baseline.map((item) => ({ ...item, suiteVersion: '2.0.0' }));
  assert.throws(
    () => createRegressionReport(baseline, current, { regressionThreshold: 1 }),
    /matching suite versions/
  );
});
