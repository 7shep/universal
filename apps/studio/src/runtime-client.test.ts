import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  LocalGenerationLifecycleClient,
  RuntimeGenerationLifecycleClient
} from './runtime-client.ts';
import type { StudioProject } from './studio-client.ts';
const project = {
  id: 'p',
  name: 'Project',
  prompt: 'Prompt',
  completion: 100,
  groups: [],
  pages: [],
  brief: [],
  briefApproved: true,
  directionApproved: true,
  plan: {
    version: '2.0.0',
    status: 'Approved',
    title: 'Plan',
    thesis: 'Thesis',
    conceptSpine: 'Spine',
    visualSystem: 'System',
    interactionPrinciple: 'Static',
    confidence: 100,
    tokens: [],
    pages: [],
    constraints: []
  }
} satisfies StudioProject;
test('deterministic lifecycle adapter remains available for isolated Studio development', async () => {
  Object.assign(globalThis, { window: { setTimeout } });
  const client = new LocalGenerationLifecycleClient();
  assert.equal((await client.load(project)).status, 'idle');
  const started = await client.start(project);
  assert.equal(started.status, 'generating');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal((await client.load(project)).status, 'ready');
});
test('runtime lifecycle client rejects malformed serialized state', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ contractVersion: '1.0.0', projects: 'forged' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  await assert.rejects(
    () => new RuntimeGenerationLifecycleClient({ origin: 'http://127.0.0.1:4300' }).load(project),
    /projects/
  );
});
