import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { BuildRecord, ProjectRecord, RevisionRecord } from '@universal/runtime-contracts';
import { RuntimeMutationCoordinator } from '../src/mutation-coordinator.ts';
import {
  executeRevisionRetention,
  type RevisionRetentionInput,
  type RevisionRetentionStateLock
} from '../src/retention.ts';

const now = '2026-07-29T12:00:00.000Z';

async function fixture() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-retention-race-'));
  const workspacePath = path.join(workspaceRoot, 'projects', 'project', 'revisions', 'revision_1');
  await mkdir(workspacePath, { recursive: true });
  const revision: RevisionRecord = {
    contractVersion: '1.0.0',
    id: 'revision:1',
    projectId: 'project',
    number: 1,
    requestDigest: 'request',
    generatedProjectDigest: 'generated',
    designPlanId: 'plan',
    designPlanDigest: 'plan-digest',
    createdAt: '2026-07-01T12:00:00.000Z',
    workspacePath
  };
  const input: RevisionRetentionInput = {
    workspaceRoot,
    now,
    policy: { retainCount: 0 },
    revisions: [revision],
    projects: [],
    builds: [],
    operations: [],
    activePreviewRevisionIds: [],
    pinnedRevisionIds: []
  };
  const mutations = new RuntimeMutationCoordinator();
  const locked: RevisionRetentionStateLock = (work) => mutations.run(() => work(input));
  return { input, mutations, locked };
}

const project = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  contractVersion: '1.0.0',
  id: 'project',
  briefId: 'brief',
  briefDigest: 'brief-digest',
  directionId: 'direction',
  directionDigest: 'direction-digest',
  designPlanId: 'plan',
  designPlanDigest: 'plan-digest',
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const build = (): BuildRecord => ({
  contractVersion: '1.0.0',
  id: 'build:ready',
  projectId: 'project',
  revisionId: 'revision:1',
  generatedProjectDigest: 'generated',
  status: 'ready',
  createdAt: now,
  updatedAt: now,
  diagnostics: []
});

for (const [name, protect] of [
  [
    'current',
    (input: RevisionRetentionInput) => {
      input.projects = [project({ currentRevisionId: 'revision:1' })];
    }
  ],
  [
    'latest successful',
    (input: RevisionRetentionInput) => {
      input.builds = [build()];
      input.projects = [project({ latestSuccessfulBuildId: 'build:ready' })];
    }
  ],
  [
    'accepted',
    (input: RevisionRetentionInput) => {
      input.pinnedRevisionIds = ['revision:1'];
    }
  ],
  [
    'active Preview',
    (input: RevisionRetentionInput) => {
      input.activePreviewRevisionIds = ['revision:1'];
    }
  ]
] as const)
  test(`serializes a concurrent ${name} protection before retention validation`, async () => {
    const value = await fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let protectedStateReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      protectedStateReady = resolve;
    });
    const mutation = value.mutations.run(async () => {
      protect(value.input);
      protectedStateReady();
      await gate;
    });
    await ready;
    const cleanup = executeRevisionRetention(value.locked);
    release();
    await mutation;
    const result = await cleanup;
    assert.equal(result.removed.length, 0);
    assert.equal(result.retained[0]?.revisionId, 'revision:1');
  });

test('holds the coordinator until deletion settles', async () => {
  const value = await fixture();
  let deletionStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    deletionStarted = resolve;
  });
  let releaseDeletion!: () => void;
  const deletionGate = new Promise<void>((resolve) => {
    releaseDeletion = resolve;
  });
  const cleanup = executeRevisionRetention(value.locked, {
    remove: async () => {
      deletionStarted();
      await deletionGate;
    }
  });
  await started;
  let mutationSettled = false;
  const mutation = value.mutations.run(async () => {
    value.input.activePreviewRevisionIds = ['revision:1'];
    mutationSettled = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(mutationSettled, false);
  releaseDeletion();
  await cleanup;
  await mutation;
  assert.equal(mutationSettled, true);
});

test('releases the coordinator after deletion failure and remains usable', async () => {
  const value = await fixture();
  const result = await executeRevisionRetention(value.locked, {
    remove: async () => {
      throw new Error('simulated deletion failure');
    }
  });
  assert.equal(result.failed[0]?.error, 'simulated deletion failure');
  await value.mutations.run(async () => {
    value.input.projects = [project({ currentRevisionId: 'revision:1' })];
  });
  const after = await executeRevisionRetention(value.locked, { dryRun: true });
  assert.equal(after.retained[0]?.reason, 'current-revision');
});

test('rejects recursive coordinator acquisition instead of deadlocking', async () => {
  const mutations = new RuntimeMutationCoordinator();
  await assert.rejects(
    () => mutations.run(() => mutations.run(async () => undefined)),
    /non-reentrant/
  );
});
