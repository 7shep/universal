import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { RevisionRecord } from '@universal/runtime-contracts';
import {
  executeRevisionRetention,
  planRevisionRetention,
  retainRevisions
} from '../src/retention.ts';

const now = '2026-07-29T12:00:00.000Z';
async function fixture(ids = ['revision:1', 'revision:2', 'revision:3']) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-retention-'));
  const revisions: RevisionRecord[] = [];
  for (const [number, id] of ids.entries()) {
    const workspacePath = path.join(root, 'projects', 'p', 'revisions', id.replaceAll(':', '_'));
    await mkdir(workspacePath, { recursive: true });
    await writeFile(path.join(workspacePath, 'marker'), id);
    revisions.push({
      contractVersion: '1.0.0',
      id,
      projectId: 'p',
      number: number + 1,
      requestDigest: 'd',
      generatedProjectDigest: 'd',
      designPlanId: 'plan',
      designPlanDigest: 'd',
      createdAt: `2026-07-${20 + number}T12:00:00.000Z`,
      workspacePath
    });
  }
  return {
    root,
    revisions,
    input: {
      workspaceRoot: root,
      now,
      policy: { retainCount: 0 },
      revisions,
      projects: [],
      builds: [],
      operations: [],
      activePreviewRevisionIds: [] as string[]
    }
  };
}
test('protects latest successful, current, active operation/build, and Preview revisions', async () => {
  const f = await fixture();
  const plan = await planRevisionRetention({
    ...f.input,
    projects: [
      {
        contractVersion: '1.0.0',
        id: 'p',
        briefId: 'b',
        briefDigest: 'd',
        directionId: 'd',
        directionDigest: 'd',
        designPlanId: 'plan',
        designPlanDigest: 'd',
        latestSuccessfulBuildId: 'good',
        currentRevisionId: 'revision:2',
        createdAt: now,
        updatedAt: now
      }
    ],
    builds: [
      {
        contractVersion: '1.0.0',
        id: 'good',
        projectId: 'p',
        revisionId: 'revision:1',
        generatedProjectDigest: 'd',
        status: 'ready',
        createdAt: now,
        updatedAt: now,
        diagnostics: []
      },
      {
        contractVersion: '1.0.0',
        id: 'active',
        projectId: 'p',
        revisionId: 'revision:3',
        generatedProjectDigest: 'd',
        status: 'building',
        createdAt: now,
        updatedAt: now,
        diagnostics: []
      }
    ],
    operations: [
      {
        contractVersion: '1.0.0',
        id: 'op',
        kind: 'generate-build-preview',
        projectId: 'p',
        revisionId: 'revision:2',
        requestDigest: 'd',
        idempotencyKey: 'k',
        status: 'building',
        createdAt: now,
        updatedAt: now,
        cancellable: true
      }
    ],
    activePreviewRevisionIds: ['revision:1']
  });
  assert.equal(plan.eligible.length, 0);
  assert.equal(plan.retained.length, 3);
});
test('applies count and age boundaries with deterministic ties', async () => {
  const f = await fixture(['revision:b', 'revision:a', 'revision:c']);
  f.revisions.forEach((r) => {
    r.createdAt = '2026-07-20T12:00:00.000Z';
    r.number = 1;
  });
  const plan = await planRevisionRetention({
    ...f.input,
    policy: { retainCount: 1, minAgeMs: 24 * 60 * 60 * 1000 }
  });
  assert.deepEqual(
    plan.retained.map((x) => x.revisionId),
    ['revision:a']
  );
  assert.deepEqual(
    plan.eligible.map((x) => x.revisionId),
    ['revision:b', 'revision:c']
  );
  const young = await planRevisionRetention({
    ...f.input,
    policy: { minAgeMs: 20 * 24 * 60 * 60 * 1000 }
  });
  assert.equal(young.eligible.length, 0);
});
test('dry run, partial failure, and repeated cleanup are safe', async () => {
  const f = await fixture(['revision:1', 'revision:2']);
  const dry = await retainRevisions({ ...f.input, dryRun: true });
  assert.equal(dry.removed.length, 0);
  const partial = await executeRevisionRetention(f.input, {
    remove: async (entry) => {
      if (entry.revisionId === 'revision:2') throw new Error('locked');
      await rm(entry.workspacePath, { recursive: true });
    }
  });
  assert.equal(partial.failed.length, 1);
  assert.equal(partial.removed.length, 1);
  const again = await planRevisionRetention(f.input);
  assert.equal(again.eligible.length, 1);
});
test('skips malformed paths and link targets without touching outside content', async () => {
  const f = await fixture(['revision:1']);
  await rm(f.revisions[0]!.workspacePath, { recursive: true });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'universal-outside-'));
  await symlink(
    outside,
    f.revisions[0]!.workspacePath,
    process.platform === 'win32' ? 'junction' : 'dir'
  ).catch(() => undefined);
  const linkPlan = await planRevisionRetention(f.input);
  assert.equal(linkPlan.eligible.length, 0);
  f.revisions[0]!.workspacePath = path.join(outside, 'r_1');
  const traversal = await planRevisionRetention(f.input);
  assert.equal(traversal.skipped[0]?.reason, 'unsafe-path');
});
test('does not cross project boundaries or remove unknown lookalike directories', async () => {
  const f = await fixture(['revision:1']);
  const otherPath = path.join(f.root, 'projects', 'other', 'revisions', 'revision_2');
  await mkdir(otherPath, { recursive: true });
  const other = {
    ...f.revisions[0]!,
    id: 'revision:2',
    projectId: 'other',
    workspacePath: otherPath
  };
  const lookalike = path.join(f.root, 'projects', 'p', 'revisions', 'revision_unknown');
  await mkdir(lookalike, { recursive: true });
  const plan = await planRevisionRetention({ ...f.input, revisions: [...f.revisions, other] });
  assert.deepEqual(
    plan.eligible.map((entry) => entry.projectId),
    ['p', 'other']
  );
  assert.equal(
    plan.eligible.some((entry) => entry.workspacePath === lookalike),
    false
  );
});
test('re-plans between deletions and skips a revision that becomes active', async () => {
  const f = await fixture(['revision:1', 'revision:2']);
  const result = await executeRevisionRetention(f.input, {
    remove: async (entry) => {
      if (entry.revisionId === 'revision:2') f.input.activePreviewRevisionIds.push('revision:1');
      await rm(entry.workspacePath, { recursive: true });
    }
  });
  assert.deepEqual(
    result.removed.map((entry) => entry.revisionId),
    ['revision:2']
  );
});
