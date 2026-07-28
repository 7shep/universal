import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RUNTIME_CONTRACT_VERSION,
  type BuildRecord,
  type ProjectRecord,
  type RuntimeOperation
} from '@universal/runtime-contracts';
import { RuntimeRecordStore } from '../src/index.ts';

test('restart marks active operations and builds interrupted while preserving last successful identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-recovery-')),
    store = new RuntimeRecordStore(root),
    now = '2026-07-28T16:00:00.000Z';
  await store.load(now);
  const project: ProjectRecord = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    id: 'p',
    briefId: 'brief',
    briefDigest: 'brief-digest',
    directionId: 'direction',
    directionDigest: 'direction-digest',
    designPlanId: 'plan',
    designPlanDigest: 'plan-digest',
    latestSuccessfulBuildId: 'build:good',
    activeOperationId: 'op:active',
    createdAt: now,
    updatedAt: now
  };
  const operation: RuntimeOperation = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    id: 'op:active',
    kind: 'generate-build-preview',
    projectId: 'p',
    revisionId: 'r:2',
    requestDigest: 'digest',
    idempotencyKey: 'key',
    status: 'building',
    createdAt: now,
    updatedAt: now,
    cancellable: true
  };
  const good: BuildRecord = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    id: 'build:good',
    projectId: 'p',
    revisionId: 'r:1',
    generatedProjectDigest: 'good',
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    diagnostics: []
  };
  const active: BuildRecord = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    id: 'build:active',
    projectId: 'p',
    revisionId: 'r:2',
    generatedProjectDigest: 'next',
    status: 'building',
    createdAt: now,
    updatedAt: now,
    diagnostics: []
  };
  await store.putProject(project);
  await store.putOperation(operation);
  await store.putBuild(good);
  await store.putBuild(active);
  const recovered = new RuntimeRecordStore(root);
  await recovered.load('2026-07-28T16:01:00.000Z');
  assert.equal(recovered.operation('op:active')?.status, 'interrupted');
  assert.equal(recovered.build('build:active')?.status, 'interrupted');
  assert.equal(recovered.project('p')?.latestSuccessfulBuildId, 'build:good');
});
test('serialized state is validated instead of trusted through a cast', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-recovery-'));
  await writeFile(
    path.join(root, 'runtime-state.json'),
    JSON.stringify({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      projects: [{ id: 3 }],
      operations: [],
      builds: [],
      events: [],
      revisions: [],
      nextEventId: 1
    })
  );
  const store = new RuntimeRecordStore(root);
  await assert.rejects(
    () => store.load('2026-07-28T16:00:00.000Z'),
    /projects\.0\.contractVersion/
  );
});
