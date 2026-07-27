import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createBlindScoringPacket,
  createPairedComparisonReport,
  createRegressionReport,
  loadBenchmarkDefinition,
  scoreSubmission,
  serializeDeterministically,
  unblindScores
} from '../src/index.ts';
import type {
  BlindAllocation,
  BlindSubmission,
  CriterionJudgment,
  ScoringRubric
} from '../src/index.ts';

const corpusRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../benchmarks/design-quality/v1'
);

test('loads and validates all twelve versioned briefs offline', async () => {
  const definition = await loadBenchmarkDefinition(corpusRoot);
  assert.equal(definition.suite.suite_version, '1.0.0');
  assert.equal(definition.rubric.rubric_version, definition.suite.rubric_version);
  assert.equal(definition.briefs.length, 12);
  assert.equal(new Set(definition.briefs.map((brief) => brief.brief_id)).size, 12);
  assert.ok(definition.briefs.every((brief) => brief.brief_version === '1.0.0'));
});

test('defines both arms, blind scoring, and an offline source-only evidence policy', async () => {
  const { suite, rubric } = await loadBenchmarkDefinition(corpusRoot);
  assert.deepEqual(suite.arms.map((arm) => arm.id).sort(), ['unguided', 'universal_guided']);
  assert.deepEqual(suite.pairing.required_arm_ids, ['unguided', 'universal_guided']);
  assert.equal(suite.execution_mode, 'offline_source_only');
  assert.equal(suite.source_evidence.network, 'disabled');
  assert.equal(suite.source_evidence.live_preview, 'disabled');
  assert.equal(suite.rendered_evidence.available, false);
  assert.equal(suite.rendered_evidence.missing_status, 'not_evaluable');
  assert.equal(suite.rendered_evidence.missing_score, null);
  const rendered = rubric.dimensions.filter((dimension) => dimension.evidence_kind === 'rendered');
  assert.ok(rendered.length > 0);
  assert.ok(rendered.every((dimension) => dimension.weight === 0));
  assert.ok(
    rendered.every((dimension) => dimension.when_rendered_evidence_missing === 'not_evaluable')
  );
});

test('blind scoring and paired/regression reports are deterministic without rendered evidence', async () => {
  const { suite, rubric: rubricManifest, briefs } = await loadBenchmarkDefinition(corpusRoot);
  const rubric: ScoringRubric = {
    id: rubricManifest.rubric_id,
    version: rubricManifest.rubric_version,
    criteria: rubricManifest.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.title,
      description: dimension.question,
      maxScore: 5,
      evidenceKind: dimension.evidence_kind,
      scoringGuidance: [dimension.question]
    }))
  };
  const submissions: BlindSubmission[] = [];
  const allocations: BlindAllocation[] = [];
  for (const [index, brief] of briefs.entries()) {
    for (const [candidateIndex, arm] of (['unguided', 'universal_guided'] as const).entries()) {
      const blindId = `pair-${String(index + 1).padStart(2, '0')}-candidate-${candidateIndex === 0 ? 'a' : 'b'}`;
      submissions.push({
        blindId,
        briefId: brief.brief_id,
        suiteVersion: suite.suite_version,
        sourceEvidence: [{ id: 'source', path: 'src/App.tsx', digest: 'a'.repeat(64) }],
        renderedEvidence: []
      });
      allocations.push({ blindId, arm });
    }
  }

  const packet = createBlindScoringPacket(rubric, [...submissions].reverse());
  assert.ok(packet.submissions.every((submission) => !('arm' in submission)));
  const serializedPacket = serializeDeterministically(packet);
  assert.doesNotMatch(serializedPacket, /"unguided"|"universal_guided"/);
  assert.equal(
    serializedPacket,
    serializeDeterministically(createBlindScoringPacket(rubric, submissions))
  );

  const armByBlindId = new Map(
    allocations.map((allocation) => [allocation.blindId, allocation.arm])
  );
  const scores = submissions.map((submission) => {
    const arm = armByBlindId.get(submission.blindId);
    const judgments: CriterionJudgment[] = rubric.criteria
      .filter((criterion) => criterion.evidenceKind === 'source')
      .map((criterion) => ({
        criterionId: criterion.id,
        score: arm === 'universal_guided' ? 4 : 3,
        rationale: 'Deterministic source-only fixture judgment.',
        evidenceIds: ['source']
      }));
    const score = scoreSubmission(submission, rubric, judgments);
    assert.ok(
      score.criteria
        .filter(
          (criterion) =>
            rubric.criteria.find((item) => item.id === criterion.criterionId)?.evidenceKind ===
            'rendered'
        )
        .every((criterion) => criterion.status === 'not_evaluable')
    );
    return score;
  });

  const unblinded = unblindScores(scores, allocations);
  const paired = createPairedComparisonReport(unblinded);
  assert.equal(paired.summary.pairCount, 12);
  assert.equal(paired.summary.comparablePairCount, 12);
  assert.equal(paired.summary.guidedWins, 12);
  assert.equal(
    serializeDeterministically(paired),
    serializeDeterministically(createPairedComparisonReport([...unblinded].reverse()))
  );

  const baseline = unblinded.map((score) => ({
    ...score,
    normalizedScore:
      score.arm === 'universal_guided' && score.normalizedScore !== null
        ? score.normalizedScore - 5
        : score.normalizedScore
  }));
  const regression = createRegressionReport(baseline, unblinded, { regressionThreshold: 1 });
  assert.equal(regression.summary.comparedCount, 24);
  assert.equal(regression.summary.improvedCount, 12);
  assert.equal(
    serializeDeterministically(regression),
    serializeDeterministically(
      createRegressionReport([...baseline].reverse(), [...unblinded].reverse(), {
        regressionThreshold: 1
      })
    )
  );
});
