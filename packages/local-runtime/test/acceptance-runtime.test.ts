import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DeterministicReactProvider, ReactGenerator } from '@universal/generation';
import { RuntimeService } from '../src/index.ts';

test('runtime acceptance/export methods require and preserve a passed immutable revision', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-acceptance-runtime-'));
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-acceptance-repo-'));
  const revisionRoot = path.join(workspaceRoot, 'projects', 'project_1', 'revisions', 'revision_1');
  const exportRoot = path.join(workspaceRoot, 'exports');
  await mkdir(path.join(revisionRoot, 'src'), { recursive: true });
  await writeFile(path.join(revisionRoot, 'src', 'App.tsx'), 'export default function App(){}');
  await writeFile(
    path.join(revisionRoot, '.universal-manifest.json'),
    JSON.stringify({ manifestDigest: 'generated-digest' })
  );
  await writeFile(
    path.join(workspaceRoot, 'runtime-state.json'),
    JSON.stringify({
      contractVersion: '1.0.0',
      projects: [],
      operations: [],
      builds: [
        {
          contractVersion: '1.0.0',
          id: 'build:1',
          projectId: 'project:1',
          revisionId: 'revision:1',
          generatedProjectDigest: 'generated-digest',
          status: 'ready',
          createdAt: '2026-07-28T00:00:00.000Z',
          updatedAt: '2026-07-28T00:00:01.000Z',
          diagnostics: [],
          review: {
            status: 'pass',
            checkedAt: '2026-07-28T00:00:01.000Z',
            checks: [{ id: 'build-success', status: 'pass', message: 'Build passed.' }]
          }
        }
      ],
      revisions: [
        {
          contractVersion: '1.0.0',
          id: 'revision:1',
          projectId: 'project:1',
          number: 1,
          requestDigest: 'request-digest',
          generatedProjectDigest: 'generated-digest',
          designPlanId: 'plan:1',
          designPlanDigest: 'plan-digest',
          createdAt: '2026-07-28T00:00:00.000Z',
          workspacePath: revisionRoot
        }
      ],
      events: [],
      nextEventId: 1
    })
  );
  const service = new RuntimeService({
    workspaceRoot,
    repositoryRoot,
    exportRoots: [exportRoot],
    generator: new ReactGenerator(new DeterministicReactProvider()),
    now: () => '2026-07-28T01:00:00.000Z',
    createId: () => 'fixture-id'
  });
  await service.initialize();
  const acceptance = await service.acceptRevision('revision:1', 'integration-user');
  const destination = path.join(exportRoot, 'project');
  const exported = await service.exportAcceptedRevision({
    acceptance,
    destination,
    requestedBy: 'integration-user'
  });
  assert.equal(exported.revisionId, 'revision:1');
  assert.match(
    await readFile(path.join(destination, '.universal', 'provenance.json'), 'utf8'),
    /integration-user/
  );
  await service.shutdown();
});
