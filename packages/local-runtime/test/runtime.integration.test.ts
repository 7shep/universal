import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import {
  createProjectGenerationRequest,
  DeterministicReactProvider,
  ReactGenerator,
  type ReactGenerationProvider
} from '@universal/generation';
import { RuntimeService } from '../src/index.ts';

const plan = () =>
  compileDesignPlanV2({
    brief: fixtureCreativeBrief,
    evaluation: fixtureSelectedDirectionEvaluation,
    providerOutput: serializedFixtureDesignPlanV2Draft,
    now: '2026-07-28T12:10:00.000Z'
  });
test(
  'locked build serves an isolated preview and a failed rebuild preserves last known good',
  { timeout: 180_000 },
  async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-runtime-')),
      repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-repository-'));
    const deterministic = new DeterministicReactProvider();
    const provider: ReactGenerationProvider = {
      capabilities: deterministic.capabilities,
      async generate(request, signal) {
        if (request.revisionId.includes('monolith'))
          return {
            files: [
              {
                path: 'src/App.tsx',
                kind: 'react',
                content: `export default function App(){return <><nav><a href="/">Home</a></nav><main><h1>Journal</h1><section><h2>Issue</h2><p>Introduction</p></section><section><h2>Projects</h2><article><h3>One</h3><p>Record</p></article></section><section><h2>About</h2><p>Independent practice</p></section><section><h2>Subscribe</h2><p>Monthly notes</p></section></main><footer>Journal</footer></>}`
              },
              {
                path: 'src/styles.css',
                kind: 'stylesheet',
                content:
                  ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){*{transition:none}}'
              }
            ]
          };
        if (request.revisionId.includes('broken'))
          return {
            files: [
              { path: 'src/App.tsx', content: 'export default function App( {', kind: 'react' },
              {
                path: 'src/styles.css',
                content:
                  ':focus-visible{outline:2px solid} @media(prefers-reduced-motion:reduce){}',
                kind: 'stylesheet'
              }
            ]
          };
        return deterministic.generate(request, signal);
      }
    };
    let tick = 0;
    const service = new RuntimeService({
      workspaceRoot,
      repositoryRoot,
      generator: new ReactGenerator(provider),
      now: () => `2026-07-28T15:${String(tick++).padStart(2, '0')}:00.000Z`,
      createId: () => `id-${tick}`
    });
    await service.initialize();
    const firstRequest = createProjectGenerationRequest({
      projectId: 'project:keyboard',
      revisionId: 'revision:keyboard:1',
      designPlan: plan()
    });
    const first = await service.startGeneration(firstRequest, 'keyboard:1');
    const completed = await service.waitForOperation(first.operation.id);
    assert.equal(
      completed.status,
      'ready',
      [
        completed.error?.message ?? 'operation failed',
        JSON.stringify(service.state().builds, null, 2)
      ].join('\n')
    );
    const descriptor = service.preview('project:keyboard');
    const response = await fetch(descriptor.url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root"><\/div>/);
    assert.match(response.headers.get('content-security-policy') ?? '', /connect-src 'none'/);
    const runtimeProbe = await fetch(`${descriptor.origin}/api/v1/state`);
    assert.equal(runtimeProbe.status, 404);
    const monolithRequest = createProjectGenerationRequest({
      projectId: 'project:keyboard',
      revisionId: 'revision:keyboard:monolith',
      designPlan: plan()
    });
    const monolith = await service.startGeneration(monolithRequest, 'keyboard:monolith');
    const architectureRejected = await service.waitForOperation(monolith.operation.id);
    assert.equal(architectureRejected.status, 'failed');
    assert.equal(architectureRejected.error?.code, 'BUILD_FAILURE');
    const rejectedBuild = service
      .state()
      .builds.find((item) => item.revisionId === monolithRequest.revisionId);
    assert.ok(rejectedBuild?.diagnostics.some((item) => item.code === 'ARCH_APP_MONOLITH'));
    const rejectedRevision = service
      .state()
      .revisions.find((item) => item.id === monolithRequest.revisionId);
    assert.match(
      await readFile(path.join(rejectedRevision!.workspacePath, 'src', 'App.tsx'), 'utf8'),
      /Journal/
    );
    assert.equal(service.preview('project:keyboard').buildId, descriptor.buildId);
    assert.equal(service.state().projects[0]?.latestSuccessfulBuildId, descriptor.buildId);
    const brokenRequest = createProjectGenerationRequest({
      projectId: 'project:keyboard',
      revisionId: 'revision:keyboard:broken',
      designPlan: plan()
    });
    const broken = await service.startGeneration(brokenRequest, 'keyboard:broken');
    const failed = await service.waitForOperation(broken.operation.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error?.code, 'BUILD_FAILURE');
    assert.equal(service.preview('project:keyboard').buildId, descriptor.buildId);
    assert.equal(service.state().projects[0]?.latestSuccessfulBuildId, descriptor.buildId);
    const retryRequest = createProjectGenerationRequest({
      projectId: 'project:keyboard',
      revisionId: 'revision:keyboard:broken-retry',
      designPlan: plan()
    });
    const retry = await service.startGeneration(retryRequest, 'keyboard:broken-retry');
    const retryFailed = await service.waitForOperation(retry.operation.id);
    assert.equal(retryFailed.status, 'failed');
    assert.equal(retryFailed.error?.code, 'BUILD_FAILURE');
    const failedRevisions = service.state().revisions.filter((item) => item.id.includes('broken'));
    assert.equal(failedRevisions.length, 2);
    assert.notEqual(failedRevisions[0]?.workspacePath, failedRevisions[1]?.workspacePath);
    assert.equal(service.preview('project:keyboard').buildId, descriptor.buildId);
    const replay = await service.startGeneration(firstRequest, 'keyboard:1');
    assert.equal(replay.replayed, true);
    await assert.rejects(
      () => service.startGeneration(brokenRequest, 'keyboard:1'),
      /different request/
    );
    await service.shutdown();
  }
);
