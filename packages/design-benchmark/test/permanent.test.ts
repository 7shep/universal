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
  summarizePermanentBenchmarkReport,
  summarizePermanentRegressionReport,
  type PermanentCaseResult,
  type PermanentCriterionResult,
  type PermanentBenchmarkReport
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
const report = async (
  cases: readonly PermanentCaseResult[],
  createdAt = '2026-07-29T00:00:00.000Z'
) =>
  createPermanentBenchmarkReport({
    definition: await loadPermanentBenchmark(root),
    results: cases,
    createdAt
  });

test('loads the immutable eight-archetype corpus with all required criteria', async () => {
  const definition = await loadPermanentBenchmark(root);
  assert.equal(definition.briefs.length, 8);
  assert.deepEqual(
    new Set(definition.briefs.map((brief) => brief.category)),
    new Set(PERMANENT_CATEGORIES)
  );
  assert.match(definition.inputDigest, /^[a-f0-9]{64}$/);
});

test('summarizes successful reports deterministically by criterion, outcome, and brief', async () => {
  const definition = await loadPermanentBenchmark(root);
  const value = await report(results(definition.briefs.map((brief) => brief.id)));
  assert.deepEqual(value.summary.byOutcome, { passed: 8, failed: 0, notEvaluated: 0 });
  assert.equal(value.summary.byCriterion['build-success'].passed, 8);
  const summary = summarizePermanentBenchmarkReport(value);
  assert.match(summary, /Outcomes: pass 8, fail 0, not-evaluated 0/);
  assert.match(summary, /dq-v2-luxury-product: pass 1, fail 0, not-evaluated 0/);
  assert.equal(summary, summarizePermanentBenchmarkReport(value));
});

test('reports failed and not-evaluated outcomes per brief', async () => {
  const definition = await loadPermanentBenchmark(root);
  const item = results([definition.briefs[0]!.id])[0]!;
  const value = await report([
    {
      ...item,
      criteria: item.criteria.map((criterion) =>
        criterion.criterion === 'build-success'
          ? { ...criterion, status: 'failed', score: 1 }
          : criterion.criterion === 'visual-originality'
            ? { ...criterion, status: 'not-evaluated', score: null }
            : criterion
      )
    }
  ]);
  assert.deepEqual(value.summary.byOutcome, { passed: 0, failed: 1, notEvaluated: 0 });
  assert.equal(value.summary.byCriterion['build-success'].failed, 1);
  assert.equal(value.summary.byCriterion['visual-originality'].notEvaluated, 1);
  assert.equal(value.summary.deterministicFailures, 1);
  assert.equal(value.summary.subjectivePending, 1);
});

test('rejects malformed or stale summary totals while accepting legacy structured summaries', async () => {
  const definition = await loadPermanentBenchmark(root);
  const value = await report(results([definition.briefs[0]!.id]));
  const legacy = {
    ...value,
    summary: {
      caseCount: value.summary.caseCount,
      deterministicFailures: value.summary.deterministicFailures,
      subjectivePending: value.summary.subjectivePending,
      meanScore: value.summary.meanScore
    }
  } as PermanentBenchmarkReport;
  assert.match(summarizePermanentBenchmarkReport(legacy), /Outcomes: pass 1/);
  assert.throws(
    () =>
      summarizePermanentBenchmarkReport({
        ...value,
        summary: { ...value.summary, byOutcome: { passed: -1, failed: 0, notEvaluated: 0 } }
      }),
    /outcome totals/
  );
  assert.throws(
    () =>
      summarizePermanentBenchmarkReport({ ...value, summary: { ...value.summary, caseCount: 2 } }),
    /inconsistent/
  );
});
test('keeps a delta exactly at the regression threshold unchanged', async () => {
  const definition = await loadPermanentBenchmark(root);
  const baseline = await report(results([definition.briefs[0]!.id], 4));
  // A two-point change on a 0.12-weight criterion yields a 0.24 aggregate delta.
  const original = results([definition.briefs[0]!.id])[0]!;
  const borderline = await report([
    {
      ...original,
      criteria: original.criteria.map((criterion) =>
        criterion.criterion === 'accessibility' ? { ...criterion, score: 2 } : criterion
      )
    }
  ]);
  const boundary = comparePermanentBenchmarkReports(baseline, borderline, 0.25);
  assert.equal(boundary.entries[0]?.status, 'unchanged');
  assert.match(summarizePermanentRegressionReport(boundary), /Regressions: 0/);
});

test('lists regression evidence and rejects incompatible or incomplete comparisons', async () => {
  const definition = await loadPermanentBenchmark(root);
  const baseline = await report(results([definition.briefs[0]!.id], 4));
  const changed = results([definition.briefs[0]!.id], 4);
  changed[0] = {
    ...changed[0]!,
    criteria: changed[0]!.criteria.map((criterion) =>
      criterion.criterion === 'build-success'
        ? { ...criterion, score: 1, evidence: ['evidence/current/build.json'] }
        : criterion
    )
  };
  const current = await report(changed);
  const comparison = comparePermanentBenchmarkReports(baseline, current, 0.25);
  assert.equal(comparison.entries[0]?.status, 'regressed');
  assert.deepEqual(comparison.entries[0]?.evidence.current, ['evidence/current/build.json']);
  assert.match(summarizePermanentRegressionReport(comparison), /evidence\/current\/build.json/);
  assert.throws(
    () => comparePermanentBenchmarkReports(baseline, { ...current, inputDigest: '0'.repeat(64) }),
    /not comparable/
  );
  assert.throws(
    () =>
      comparePermanentBenchmarkReports(baseline, {
        ...current,
        results: [{ ...current.results[0]!, criteria: current.results[0]!.criteria.slice(1) }]
      }),
    /incomplete/
  );
});
