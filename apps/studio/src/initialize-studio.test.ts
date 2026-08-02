import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { initializeStudio } from './initialize-studio.ts';
import { resetRuntimeSessionForTests } from './runtime-client.ts';
import type { StudioAppProps } from './studio-app.tsx';

function stubFetch(order: string[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/v1/bootstrap')) {
      order.push('bootstrap');
      return new Response('{"status":"bootstrapped"}', { status: 200 });
    }
    order.push('probe');
    return new Response('{"available":true,"operations":[]}', { status: 200 });
  }) as typeof fetch;
}

test('the bridge probe runs only after the runtime session is established', async () => {
  resetRuntimeSessionForTests();
  const order: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(order);
  try {
    const props: StudioAppProps = {};
    let rendered = 0;
    await initializeStudio(
      { origin: 'http://127.0.0.1:4300', bootstrapToken: 't' },
      props,
      () => {
        rendered += 1;
      }
    );
    assert.deepEqual(order, ['bootstrap', 'probe']);
    assert.equal(rendered, 1);
    assert.ok(props.client, 'an available bridge must install the MCP art director client');
  } finally {
    globalThis.fetch = original;
    resetRuntimeSessionForTests();
  }
});

test('an unavailable bridge still renders Studio in fixture mode', async () => {
  resetRuntimeSessionForTests();
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).endsWith('/api/v1/bootstrap')
      ? new Response('{"status":"bootstrapped"}', { status: 200 })
      : new Response('{"available":false,"operations":[]}', { status: 200 })) as typeof fetch;
  try {
    const props: StudioAppProps = {};
    let rendered = 0;
    await initializeStudio({ origin: 'http://127.0.0.1:4300' }, props, () => {
      rendered += 1;
    });
    assert.equal(rendered, 1);
    assert.equal(props.client, undefined);
  } finally {
    globalThis.fetch = original;
    resetRuntimeSessionForTests();
  }
});

test('a failed bootstrap still renders rather than leaving a blank page', async () => {
  resetRuntimeSessionForTests();
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('runtime unreachable');
  }) as typeof fetch;
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const props: StudioAppProps = {};
    let rendered = 0;
    await initializeStudio({ origin: 'http://127.0.0.1:4300', bootstrapToken: 't' }, props, () => {
      rendered += 1;
    });
    assert.equal(rendered, 1);
    assert.equal(props.client, undefined);
    assert.ok(consoleErrorSpy.mock.calls.length >= 1, 'a swallowed failure must still be logged');
  } finally {
    globalThis.fetch = original;
    consoleErrorSpy.mockRestore();
    resetRuntimeSessionForTests();
  }
});
