import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createPairedComparisonReport,
  createRegressionReport,
  createSeededBlindAssignment,
  loadBenchmarkDefinition,
  scoreSubmission,
  serializeDeterministically,
  unblindScores
} from '../src/index.ts';
import type { ArmSubmission, CriterionJudgment, ScoringRubric } from '../src/index.ts';

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
    minimumEvaluableSourceWeight: rubricManifest.aggregation.minimum_evaluable_source_weight,
    criteria: rubricManifest.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.title,
      description: dimension.question,
      maxScore: 5,
      weight: dimension.weight,
      evidenceKind: dimension.evidence_kind,
      scoringGuidance: [dimension.question]
    }))
  };
  const candidates: ArmSubmission[] = [];
  for (const brief of briefs) {
    for (const arm of ['unguided', 'universal_guided'] as const) {
      candidates.push({
        briefId: brief.brief_id,
        suiteVersion: suite.suite_version,
        arm,
        sourceEvidence: [{ id: 'source', path: 'src/App.tsx', digest: 'a'.repeat(64) }],
        renderedEvidence: []
      });
    }
  }

  const assignment = createSeededBlindAssignment(
    rubric,
    [...candidates].reverse(),
    'integration-seed'
  );
  const { packet, allocations } = assignment;
  const submissions = [...packet.submissions];
  assert.ok(packet.submissions.every((submission) => !('arm' in submission)));
  const serializedPacket = serializeDeterministically(packet);
  assert.doesNotMatch(serializedPacket, /"unguided"|"universal_guided"/);
  assert.equal(
    serializedPacket,
    serializeDeterministically(
      createSeededBlindAssignment(rubric, candidates, 'integration-seed').packet
    )
  );
  const scores = submissions.map((submission) => {
    const judgments: CriterionJudgment[] = rubric.criteria
      .filter((criterion) => criterion.evidenceKind === 'source')
      .map((criterion) => ({
        criterionId: criterion.id,
        score: submission.blindId.endsWith('candidate-a') ? 4 : 3,
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
  assert.equal(
    serializeDeterministically(paired),
    serializeDeterministically(createPairedComparisonReport([...unblinded].reverse()))
  );

  const baseline = unblinded.map((score) => ({
    ...score,
    normalizedScore: score.normalizedScore === null ? null : score.normalizedScore - 5
  }));
  const regression = createRegressionReport(baseline, unblinded, { regressionThreshold: 1 });
  assert.equal(regression.summary.comparedCount, 24);
  assert.equal(regression.summary.improvedCount, 24);
  assert.equal(
    serializeDeterministically(regression),
    serializeDeterministically(
      createRegressionReport([...baseline].reverse(), [...unblinded].reverse(), {
        regressionThreshold: 1
      })
    )
  );
});

test('loader rejects canonical-path violations and symlinked corpus files', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'design-benchmark-loader-'));
  const copiedRoot = resolve(temporary, 'corpus');
  try {
    await cp(corpusRoot, copiedRoot, { recursive: true });
    const suitePath = resolve(copiedRoot, 'suite.json');
    const suite = JSON.parse(
      await (await import('node:fs/promises')).readFile(suitePath, 'utf8')
    ) as {
      briefs: string[];
    };
    suite.briefs[0] = suite.briefs[0]!.replace('/', '\\');
    await writeFile(suitePath, JSON.stringify(suite), 'utf8');
    await assert.rejects(() => loadBenchmarkDefinition(copiedRoot), /canonical forward-slash/);

    await cp(corpusRoot, copiedRoot, { recursive: true, force: true });
    const target = resolve(copiedRoot, 'briefs/01-fintech-landing.json');
    const outside = resolve(temporary, 'outside.json');
    await cp(target, outside);
    await rm(target);
    await symlink(outside, target, 'file');
    await assert.rejects(() => loadBenchmarkDefinition(copiedRoot), /cannot contain symlinks/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
