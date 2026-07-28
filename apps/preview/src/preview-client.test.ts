import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { RUNTIME_CONTRACT_VERSION, type RuntimeState } from '@universal/runtime-contracts';
import { RuntimePreviewClient } from './preview-client.ts';
const project = {
  contractVersion: RUNTIME_CONTRACT_VERSION,
  id: 'project:p',
  briefId: 'brief',
  briefDigest: 'brief-digest',
  directionId: 'direction',
  directionDigest: 'direction-digest',
  designPlanId: 'plan',
  designPlanDigest: 'plan-digest',
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:01:00.000Z'
} as const;
const state = (status: 'building' | 'ready' | 'failed'): RuntimeState => ({
  contractVersion: RUNTIME_CONTRACT_VERSION,
  projects: [
    {
      ...project,
      ...(status !== 'building'
        ? { latestSuccessfulBuildId: 'build:good', currentRevisionId: 'revision:1' }
        : {})
    }
  ],
  operations: [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: 'op',
      kind: 'generate-build-preview',
      projectId: 'project:p',
      revisionId: 'revision:2',
      requestDigest: 'request',
      idempotencyKey: 'key',
      status,
      createdAt: '2026-07-28T10:00:00.000Z',
      updatedAt: '2026-07-28T10:02:00.000Z',
      cancellable: status === 'building',
      ...(status === 'failed'
        ? {
            error: { code: 'BUILD_FAILURE' as const, message: 'New build failed.', retryable: true }
          }
        : {})
    }
  ],
  builds: [],
  revisions: [],
  events: []
});
const descriptor = {
  contractVersion: RUNTIME_CONTRACT_VERSION,
  projectId: 'project:p',
  revisionId: 'revision:1',
  buildId: 'build:good',
  url: 'http://127.0.0.1:4400/',
  origin: 'http://127.0.0.1:4400',
  issuedAt: '2026-07-28T10:00:00.000Z',
  csp: "default-src 'self'; connect-src 'none'"
};
function mockFetch(runtimeState: RuntimeState, preview: unknown = descriptor) {
  globalThis.fetch = async (input) =>
    new Response(JSON.stringify(String(input).includes('/preview') ? preview : runtimeState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
}
test('Preview derives building, ready, and retained-last-good states from runtime records', async () => {
  const client = new RuntimePreviewClient('http://127.0.0.1:4300');
  mockFetch(state('building'));
  assert.equal((await client.load('project:p')).phase, 'building');
  mockFetch(state('ready'));
  assert.equal((await client.load('project:p')).descriptor?.buildId, 'build:good');
  mockFetch(state('failed'));
  const retained = await client.load('project:p');
  assert.equal(retained.phase, 'ready');
  assert.equal(retained.newerFailure?.code, 'BUILD_FAILURE');
});
test('Preview rejects an arbitrary injected preview URL', async () => {
  mockFetch(state('ready'), {
    ...descriptor,
    url: 'https://example.com/',
    origin: 'https://example.com'
  });
  await assert.rejects(
    () => new RuntimePreviewClient('http://127.0.0.1:4300').load('project:p'),
    /loopback/
  );
});
test('Preview iframe keeps generated code in a scripts-only sandbox', async () => {
  const source = await readFile(new URL('./preview-app.tsx', import.meta.url), 'utf8');
  assert.match(source, /sandbox="allow-scripts"/);
  assert.doesNotMatch(source, /allow-same-origin/);
});

test('Preview rejects a stale descriptor that is not bound to the project latest successful revision', async () => {
  mockFetch(state('ready'), {
    ...descriptor,
    buildId: 'build:stale',
    revisionId: 'revision:stale'
  });
  await assert.rejects(
    () => new RuntimePreviewClient('http://127.0.0.1:4300').load('project:p'),
    /stale or mismatched/
  );
});
