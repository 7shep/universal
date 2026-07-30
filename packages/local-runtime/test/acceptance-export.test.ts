import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AcceptanceExportService, RuntimeFailure, type RevisionProvenance } from '../src/index.ts';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-export-'));
  const source = path.join(root, 'immutable', 'revision_1');
  const allowed = path.join(root, 'exports');
  const metadata = path.join(root, 'metadata');
  await mkdir(path.join(source, 'src'), { recursive: true });
  await writeFile(path.join(source, 'src', 'App.tsx'), 'export default function App(){}');
  await writeFile(
    path.join(source, '.universal-manifest.json'),
    JSON.stringify({ manifestDigest: 'project-digest' })
  );
  const provenance: RevisionProvenance = {
    projectId: 'project:1',
    revisionId: 'revision:1',
    designPlanId: 'plan:1',
    designPlanDigest: 'plan-digest',
    generatedProjectDigest: 'project-digest',
    reviewEvidence: [{ id: 'qa:1', digest: 'evidence-digest' }],
    createdAt: '2026-07-28T00:00:00.000Z',
    sourceRoot: source
  };
  return { root, source, allowed, metadata, provenance };
}

test('requires explicit acceptance and exports provenance to a controlled new destination', async () => {
  const value = await fixture();
  const service = new AcceptanceExportService({
    metadataRoot: value.metadata,
    allowedRoots: [value.allowed],
    now: () => '2026-07-28T01:00:00.000Z',
    createId: () => 'id'
  });
  await assert.rejects(
    () =>
      service.accept(value.provenance, {
        acceptedBy: '',
        confirmation: true
      }),
    RuntimeFailure
  );
  const acceptance = await service.accept(value.provenance, {
    acceptedBy: 'alex',
    confirmation: true
  });
  const destination = path.join(value.allowed, 'project');
  const exported = await service.export({
    acceptance,
    provenance: value.provenance,
    destination,
    authorization: { requestedBy: 'alex', confirmation: true }
  });
  assert.equal(exported.destination, destination);
  assert.match(
    await readFile(path.join(destination, '.universal', 'provenance.json'), 'utf8'),
    /"revisionId": "revision:1"/
  );
});

test('exports through an explicitly configured allowed-root alias', async (context) => {
  const value = await fixture();
  const alias = path.join(value.root, 'exports-alias');
  await mkdir(value.allowed, { recursive: true });
  try {
    await symlink(value.allowed, alias, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (process.platform === 'win32') {
      context.skip(`Windows could not create the test junction: ${String(error)}`);
      return;
    }
    throw error;
  }
  const service = new AcceptanceExportService({
    metadataRoot: value.metadata,
    allowedRoots: [alias]
  });
  const acceptance = await service.accept(value.provenance, {
    acceptedBy: 'alex',
    confirmation: true
  });
  const destination = path.join(alias, 'project');
  const exported = await service.export({
    acceptance,
    provenance: value.provenance,
    destination,
    authorization: { requestedBy: 'alex', confirmation: true }
  });

  assert.equal(exported.destination, destination);
  assert.match(
    await readFile(path.join(value.allowed, 'project', '.universal', 'provenance.json'), 'utf8'),
    /revisionId.*revision:1/
  );
});

test('supports an existing empty destination and rejects non-empty, outside, and traversal targets', async () => {
  const value = await fixture();
  const service = new AcceptanceExportService({
    metadataRoot: value.metadata,
    allowedRoots: [value.allowed]
  });
  const acceptance = await service.accept(value.provenance, {
    acceptedBy: 'alex',
    confirmation: true
  });
  const empty = path.join(value.allowed, 'empty');
  await mkdir(empty, { recursive: true });
  await service.export({
    acceptance,
    provenance: value.provenance,
    destination: empty,
    authorization: { requestedBy: 'alex', confirmation: true }
  });
  const nonEmpty = path.join(value.allowed, 'occupied');
  await mkdir(nonEmpty);
  await writeFile(path.join(nonEmpty, 'keep.txt'), 'keep');
  await assert.rejects(
    () =>
      service.export({
        acceptance,
        provenance: value.provenance,
        destination: nonEmpty,
        authorization: { requestedBy: 'alex', confirmation: true }
      }),
    /non-empty/
  );
  for (const destination of [
    path.join(value.root, 'outside'),
    `${value.allowed}${path.sep}child${path.sep}..${path.sep}escape`
  ])
    await assert.rejects(
      () =>
        service.export({
          acceptance,
          provenance: value.provenance,
          destination,
          authorization: { requestedBy: 'alex', confirmation: true }
        }),
      RuntimeFailure
    );
});

test('cleans staging after partial failure and does not mutate the accepted revision', async () => {
  const value = await fixture();
  const before = await readFile(path.join(value.source, 'src', 'App.tsx'), 'utf8');
  const service = new AcceptanceExportService({
    metadataRoot: value.metadata,
    allowedRoots: [value.allowed],
    async beforeCommit() {
      throw new Error('simulated disk failure');
    }
  });
  const acceptance = await service.accept(value.provenance, {
    acceptedBy: 'alex',
    confirmation: true
  });
  await assert.rejects(
    () =>
      service.export({
        acceptance,
        provenance: value.provenance,
        destination: path.join(value.allowed, 'failed'),
        authorization: { requestedBy: 'alex', confirmation: true }
      }),
    /simulated/
  );
  assert.equal(await readFile(path.join(value.source, 'src', 'App.tsx'), 'utf8'), before);
  assert.deepEqual(
    (await readdir(value.allowed)).filter((item) => item.startsWith('.universal-export-')),
    []
  );
});

test('rejects provenance drift after acceptance', async () => {
  const value = await fixture();
  const service = new AcceptanceExportService({
    metadataRoot: value.metadata,
    allowedRoots: [value.allowed]
  });
  const acceptance = await service.accept(value.provenance, {
    acceptedBy: 'alex',
    confirmation: true
  });
  await assert.rejects(
    () =>
      service.export({
        acceptance,
        provenance: { ...value.provenance, designPlanDigest: 'tampered' },
        destination: path.join(value.allowed, 'tampered'),
        authorization: { requestedBy: 'alex', confirmation: true }
      }),
    /does not match/
  );
});
