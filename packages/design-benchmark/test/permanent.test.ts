import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
const withCorpus = async (run: (corpus: string) => Promise<void>): Promise<void> => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'universal-benchmark-v2-'));
  const corpus = path.join(temporary, 'corpus');
  await cp(root, corpus, { recursive: true });
  try {
    await run(corpus);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
const rewriteJson = async (
  file: string,
  transform: (value: Record<string, unknown>) => unknown
): Promise<void> => {
  const value = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, `${JSON.stringify(transform(value), null, 2)}\n`);
};

test('loads the immutable eight-archetype corpus with all required criteria', async () => {
  const definition = await loadPermanentBenchmark(root);
  assert.equal(definition.briefs.length, 8);
  assert.deepEqual(
    new Set(definition.briefs.map((brief) => brief.category)),
    new Set(PERMANENT_CATEGORIES)
  );
  assert.match(definition.inputDigest, /^[a-f0-9]{64}$/);
});

test('rejects malformed manifests, duplicate brief identities, and malformed briefs', async () => {
  await withCorpus(async (corpus) => {
    const suite = path.join(corpus, 'suite.json');
    const manifest = JSON.parse(await readFile(suite, 'utf8')) as { criteria: unknown[] };
    await rewriteJson(suite, (value) => ({
      ...value,
      criteria: [...manifest.criteria, manifest.criteria[0]]
    }));
    await assert.rejects(() => loadPermanentBenchmark(corpus), /manifest is invalid/);
  });
  await withCorpus(async (corpus) => {
    const suite = JSON.parse(await readFile(path.join(corpus, 'suite.json'), 'utf8'));
    const first = path.join(corpus, suite.briefPaths[0]);
    const second = path.join(corpus, suite.briefPaths[1]);
    const firstId = JSON.parse(await readFile(first, 'utf8')).id;
    await rewriteJson(second, (value) => ({ ...value, id: firstId, prompt: '   ' }));
    await assert.rejects(() => loadPermanentBenchmark(corpus), /brief is invalid/);
  });
  await withCorpus(async (corpus) => {
    const suite = path.join(corpus, 'suite.json');
    await rewriteJson(suite, (value) => ({ ...value, baselinePath: '../approved.json' }));
    await assert.rejects(() => loadPermanentBenchmark(corpus), /manifest is invalid/);
  });
});

test('rejects path traversal and symlink escapes when the platform permits symlinks', async (t) => {
  await withCorpus(async (corpus) => {
    const suite = JSON.parse(await readFile(path.join(corpus, 'suite.json'), 'utf8'));
    const first = path.join(corpus, suite.briefPaths[0]);
    const outside = path.join(path.dirname(corpus), 'outside-brief.json');
    await writeFile(outside, await readFile(first));
    try {
      await rm(first);
      await symlink(outside, first, 'file');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') return t.skip('symlinks unavailable');
      throw error;
    }
    await assert.rejects(() => loadPermanentBenchmark(corpus), /symlinks|escaped/);
  });
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
  // Deterministic weights total 0.85; this two-point change yields a 0.71 rounded delta.
  const original = results([definition.briefs[0]!.id])[0]!;
  const borderline = await report([
    {
      ...original,
      criteria: original.criteria.map((criterion) =>
        criterion.criterion === 'accessibility' ? { ...criterion, score: 2 } : criterion
      )
    }
  ]);
  const boundary = comparePermanentBenchmarkReports(baseline, borderline, 0.71);
  assert.equal(boundary.entries[0]?.status, 'unchanged');
  assert.match(summarizePermanentRegressionReport(boundary), /Regressions: 0/);
});

test('rejects duplicate, unknown, and missing criteria and keeps reports stable under input reordering', async () => {
  const definition = await loadPermanentBenchmark(root);
  const original = results([definition.briefs[0]!.id, definition.briefs[1]!.id]);
  const duplicate = {
    ...original[0]!,
    criteria: [...original[0]!.criteria.slice(0, -1), original[0]!.criteria[0]!]
  };
  assert.throws(
    () => createPermanentBenchmarkReport({ definition, results: [duplicate], createdAt: 'x' }),
    /duplicated/
  );
  const unknown = {
    ...original[0]!,
    criteria: original[0]!.criteria.map((criterion, index) =>
      index === 0 ? { ...criterion, criterion: 'unknown' as never } : criterion
    )
  };
  assert.throws(
    () => createPermanentBenchmarkReport({ definition, results: [unknown], createdAt: 'x' }),
    /unknown/
  );
  assert.throws(
    () =>
      createPermanentBenchmarkReport({
        definition,
        results: [{ ...original[0]!, criteria: original[0]!.criteria.slice(1) }],
        createdAt: 'x'
      }),
    /incomplete/
  );
  const ordered = createPermanentBenchmarkReport({ definition, results: original, createdAt: 'x' });
  const reversed = createPermanentBenchmarkReport({
    definition,
    results: original
      .slice()
      .reverse()
      .map((item) => ({ ...item, criteria: item.criteria.slice().reverse() })),
    createdAt: 'x'
  });
  assert.deepEqual(ordered, reversed);
});

test('separates deterministic failures and subjective evidence from regression decisions', async () => {
  const definition = await loadPermanentBenchmark(root);
  const baseline = await report(results([definition.briefs[0]!.id], 4));
  const changed = results([definition.briefs[0]!.id], 4);
  changed[0] = {
    ...changed[0]!,
    criteria: changed[0]!.criteria.map((criterion) =>
      criterion.criterion === 'visual-originality'
        ? {
            ...criterion,
            status: 'not-evaluated',
            score: null,
            evidence: ['evidence/review-pending.json']
          }
        : criterion.criterion === 'build-success'
          ? { ...criterion, status: 'failed', score: 1, evidence: ['evidence/build-failure.json'] }
          : criterion
    )
  };
  const current = await report(changed);
  assert.equal(current.summary.subjectivePending, 1);
  assert.equal(current.summary.deterministicFailures, 1);
  const regression = comparePermanentBenchmarkReports(baseline, current, 0.25);
  assert.equal(regression.entries[0]?.status, 'regressed');
  assert.deepEqual(regression.entries[0]?.evidence.current, [
    'evidence/build-failure.json',
    'evidence/review-pending.json'
  ]);
});

test('derives report and comparison scores from criteria instead of caller-supplied aggregates', async () => {
  const definition = await loadPermanentBenchmark(root);
  const caseResult = {
    ...results([definition.briefs[0]!.id], 4)[0]!,
    aggregateScore: 1,
    deterministicScore: 1,
    subjectiveScore: 1
  };
  const canonical = await report([caseResult]);
  assert.equal(canonical.results[0]?.aggregateScore, 4);
  assert.equal(canonical.results[0]?.deterministicScore, 4);
  assert.equal(canonical.results[0]?.subjectiveScore, 4);

  const tampered = {
    ...canonical,
    results: canonical.results.map((result) => ({
      ...result,
      aggregateScore: 1,
      deterministicScore: 1,
      subjectiveScore: 1
    }))
  };
  const comparison = comparePermanentBenchmarkReports(canonical, tampered, 0.25);
  assert.equal(comparison.entries[0]?.status, 'unchanged');
  assert.equal(comparison.entries[0]?.delta, 0);
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
        suiteVersion: '2.0.1' as PermanentBenchmarkReport['suiteVersion']
      }),
    /malformed|not comparable/
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
