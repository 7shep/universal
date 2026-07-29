import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ProjectRecord } from '@universal/runtime-contracts';
import { RuntimeMutationCoordinator } from '../src/mutation-coordinator.ts';
import { RuntimeRecordStore } from '../src/record-store.ts';

const now = '2026-07-29T12:00:00.000Z';
const project = (): ProjectRecord => ({
  contractVersion: '1.0.0',
  id: 'project',
  briefId: 'brief',
  briefDigest: 'brief-digest',
  directionId: 'direction',
  directionDigest: 'direction-digest',
  designPlanId: 'plan',
  designPlanDigest: 'plan-digest',
  currentRevisionId: 'revision:1',
  createdAt: now,
  updatedAt: now
});

test('record mutations wait for the shared coordinator and remain usable after release', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-store-coordinator-'));
  const mutations = new RuntimeMutationCoordinator();
  const store = new RuntimeRecordStore(root, mutations);
  await store.load(now);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked!: () => void;
  const entered = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holder = mutations.run(async () => {
    locked();
    await gate;
  });
  await entered;
  let settled = false;
  const write = store.putProject(project()).then(() => {
    settled = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  release();
  await holder;
  await write;
  assert.equal(store.project('project')?.currentRevisionId, 'revision:1');
});
