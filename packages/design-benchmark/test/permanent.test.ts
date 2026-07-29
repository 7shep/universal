import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PERMANENT_CATEGORIES,
  PERMANENT_CRITERIA,
  comparePermanentBenchmarkReports,
  createPermanentBenchmarkReport,
  loadPermanentBenchmark,
  type PermanentCaseResult,
  type PermanentCriterionResult
} from '../src/index.ts';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../benchmarks/design-quality/v2'
);

const results = (briefIds: readonly string[], score = 4): PermanentCaseResult[] =>
  briefIds.map((briefId) => ({
    briefId,
    arm: 'universal-guided',
    revisionId: `revision:${briefId}:1`,
    criteria: PERMANENT_CRITERIA.map((criterion): PermanentCriterionResult => ({
      criterion,
      evidenceKind: criterion === 'visual-originality' ? 'subjective' : 'deterministic',
      status: 'passed',
      score,
      evidence: [`evidence/${briefId}/${criterion}.json`],
      rationale: 'Approved fixture evidence.'
    }))
  }));

test('loads an immutable eight-archetype corpus with all required criteria', async () => {
  const definition = await loadPermanentBenchmark(root);
  assert.equal(definition.briefs.length, 8);
  assert.deepEqual(
    new Set(definition.briefs.map((brief) => brief.category)),
    new Set(PERMANENT_CATEGORIES)
  );
  assert.match(definition.inputDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    new Set(definition.suite.criteria.map((criterion) => criterion.id)),
    new Set(PERMANENT_CRITERIA)
  );
});

test('produces structured reports and repeatable historical regression comparisons', async () => {
  const definition = await loadPermanentBenchmark(root);
  const baseline = createPermanentBenchmarkReport({
    definition,
    results: results(definition.briefs.map((brief) => brief.id)),
    createdAt: '2026-07-28T00:00:00.000Z'
  });
  const currentResults = results(definition.briefs.map((brief) => brief.id));
  currentResults[0] = {
    ...currentResults[0]!,
    criteria: currentResults[0]!.criteria.map((item) => ({ ...item, score: 2 }))
  };
  const current = createPermanentBenchmarkReport({
    definition,
    results: currentResults,
    createdAt: '2026-07-29T00:00:00.000Z'
  });
  const regression = comparePermanentBenchmarkReports(baseline, current);
  assert.equal(
    regression.entries.find((entry) => entry.briefId === currentResults[0]!.briefId)?.status,
    'regressed'
  );
  assert.equal(regression.entries.filter((entry) => entry.status === 'unchanged').length, 7);
});

test('keeps deterministic failures separate from pending subjective assessment', async () => {
  const definition = await loadPermanentBenchmark(root);
  const result = results([definition.briefs[0]!.id])[0]!;
  const report = createPermanentBenchmarkReport({
    definition,
    results: [
      {
        ...result,
        criteria: result.criteria.map((item) =>
          item.criterion === 'visual-originality'
            ? { ...item, status: 'not-evaluated', score: null }
            : item.criterion === 'build-success'
              ? { ...item, status: 'failed', score: 1 }
              : item
        )
      }
    ],
    createdAt: '2026-07-28T00:00:00.000Z'
  });
  assert.equal(report.summary.deterministicFailures, 1);
  assert.equal(report.summary.subjectivePending, 1);
});
