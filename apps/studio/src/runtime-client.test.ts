import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  LocalGenerationLifecycleClient,
  RuntimeGenerationLifecycleClient,
  ensureRuntimeSession,
  resetRuntimeSessionForTests
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
test('ensureRuntimeSession redeems the single-use token exactly once', async () => {
  resetRuntimeSessionForTests();
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response('{"status":"bootstrapped"}', { status: 200 });
  }) as typeof fetch;
  try {
    const config = { origin: 'http://127.0.0.1:4300', bootstrapToken: 't' };
    await Promise.all([
      ensureRuntimeSession(config),
      ensureRuntimeSession(config),
      ensureRuntimeSession(config)
    ]);
    await ensureRuntimeSession(config);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!, /\/api\/v1\/bootstrap$/);
  } finally {
    globalThis.fetch = original;
    resetRuntimeSessionForTests();
  }
});
test('ensureRuntimeSession is a no-op without a token', async () => {
  resetRuntimeSessionForTests();
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    await ensureRuntimeSession({ origin: 'http://127.0.0.1:4300' });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
    resetRuntimeSessionForTests();
  }
});
