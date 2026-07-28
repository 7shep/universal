import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
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
  type GeneratedProject,
  type ReactGenerationProvider
} from '@universal/generation';
import { reviewGeneratedImplementation, RuntimeService } from '../src/index.ts';

const plan = () =>
  compileDesignPlanV2({
    brief: fixtureCreativeBrief,
    evaluation: fixtureSelectedDirectionEvaluation,
    providerOutput: serializedFixtureDesignPlanV2Draft,
    now: '2026-07-28T12:10:00.000Z'
  });
const request = () =>
  createProjectGenerationRequest({
    projectId: 'project:security',
    revisionId: 'revision:security:1',
    designPlan: plan()
  });

async function serviceFor(
  provider: ReactGenerationProvider,
  secrets: readonly string[] = []
): Promise<RuntimeService> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-security-')),
    repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-repository-'));
  const service = new RuntimeService({
    workspaceRoot,
    repositoryRoot,
    generator: new ReactGenerator(provider, secrets)
  });
  await service.initialize();
  return service;
}

test('runtime cancellation reaches the provider and records a terminal cancelled operation', async () => {
  const deterministic = new DeterministicReactProvider();
  let observedAbort = false;
  const provider: ReactGenerationProvider = {
    capabilities: deterministic.capabilities,
    generate: async (_request, signal) =>
      new Promise((resolve, reject) => {
        void resolve;
        const cancel = () => {
          observedAbort = true;
          reject(new Error('provider cancelled'));
        };
        if (signal?.aborted) cancel();
        else signal?.addEventListener('abort', cancel, { once: true });
      })
  };
  const service = await serviceFor(provider);
  const accepted = await service.startGeneration(request(), 'security:cancel');
  const cancelled = await service.cancel(accepted.operation.id);
  assert.equal(observedAbort, true);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellable, false);
  await service.shutdown();
});

test('runtime state, diagnostics, and events never persist provider secrets', async () => {
  const secret = 'sk-runtime-secret-123456789';
  const deterministic = new DeterministicReactProvider();
  const provider: ReactGenerationProvider = {
    capabilities: deterministic.capabilities,
    generate: async () => {
      throw new Error(`Authorization: Bearer ${secret}`);
    }
  };
  const service = await serviceFor(provider, [secret]);
  const accepted = await service.startGeneration(request(), 'security:secret');
  const operation = await service.waitForOperation(accepted.operation.id);
  assert.equal(operation.status, 'failed');
  const serialized = JSON.stringify(service.state());
  assert.doesNotMatch(serialized, /runtime-secret|123456789/);
  assert.match(serialized, /REDACTED/);
  await service.shutdown();
});

test('implementation review rejects generated external and privileged-runtime network access', () => {
  const generationRequest = request();
  const project: GeneratedProject = {
    contractVersion: '1.0.0',
    projectId: generationRequest.projectId,
    revisionId: generationRequest.revisionId,
    requestDigest: 'a'.repeat(64),
    framework: 'react-vite',
    entrypoint: 'src/main.tsx',
    files: [
      {
        path: 'src/App.tsx',
        kind: 'react',
        digest: 'a'.repeat(64),
        content:
          "export default function App(){fetch('/api/v1/state');return <><nav/><main><h1>Unsafe</h1></main></>}"
      },
      {
        path: 'src/styles.css',
        kind: 'stylesheet',
        digest: 'b'.repeat(64),
        content: ':focus-visible{outline:2px solid} @media (prefers-reduced-motion: reduce){}'
      }
    ],
    assets: [],
    diagnostics: []
  };
  const review = reviewGeneratedImplementation(
    project,
    generationRequest,
    '2026-07-28T15:00:00.000Z'
  );
  assert.equal(review.status, 'revision_recommended');
  assert.equal(review.checks.find((check) => check.id === 'network-denial')?.status, 'fail');
});
