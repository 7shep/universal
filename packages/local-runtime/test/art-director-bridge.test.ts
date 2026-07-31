import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ART_DIRECTOR_OPERATIONS,
  ArtDirectorBridge,
  type ArtDirectorMcpSession
} from '../src/art-director-bridge.ts';
import { RuntimeFailure } from '../src/errors.ts';

interface Call {
  tool: string;
  args: Record<string, unknown>;
}

/** Deterministic stand-in for a live stdio MCP session. */
class FakeSession implements ArtDirectorMcpSession {
  closed = false;
  readonly calls: Call[];
  private readonly respond: (call: Call, index: number) => Promise<unknown>;
  private readonly startIndex: number;
  constructor(
    calls: Call[],
    respond: (call: Call, index: number) => Promise<unknown>,
    startIndex: number
  ) {
    this.calls = calls;
    this.respond = respond;
    this.startIndex = startIndex;
  }
  async call(tool: string, args: Record<string, unknown>) {
    const call = { tool, args };
    this.calls.push(call);
    return this.respond(call, this.startIndex + this.calls.length - 1);
  }
  async close() {
    this.closed = true;
  }
}

function harness(respond: (call: Call, index: number) => Promise<unknown>, options = {}) {
  const calls: Call[] = [];
  const sessions: FakeSession[] = [];
  const bridge = new ArtDirectorBridge({
    createSession: async () => {
      const session = new FakeSession(calls, respond, calls.length);
      sessions.push(session);
      return session;
    },
    ...options
  });
  return { bridge, calls, sessions };
}

const reply = (session: string, data?: unknown) => ({
  session,
  state: { phase: 'discovery' },
  ...(data === undefined ? {} : { data })
});

test('the allowlist is exactly the eight operations Studio needs', () => {
  assert.deepEqual([...ART_DIRECTOR_OPERATIONS].sort(), [
    'approve-creative-brief',
    'create-design-plan-v2',
    'develop-art-direction',
    'get-creative-brief',
    'get-discovery-questions',
    'get-selected-direction',
    'start-art-direction',
    'submit-discovery-answers'
  ]);
});

test('happy path walks the workflow and keeps the serialized session current', async () => {
  let counter = 0;
  const { bridge, calls } = harness(async () => reply(`session-${(counter += 1)}`, { ok: true }));

  const started = await bridge.run('start-art-direction', {
    prompt: 'A field notes membership site'
  });
  assert.equal(started.session, 'session-1');
  assert.equal(bridge.serializedSession, 'session-1');

  const questions = await bridge.run('get-discovery-questions', { session: 'session-1' });
  assert.equal(questions.session, 'session-2');
  assert.equal(bridge.serializedSession, 'session-2');

  const plan = await bridge.run('create-design-plan-v2', {});
  assert.equal(bridge.serializedSession, plan.session);

  assert.deepEqual(
    calls.map((call) => call.tool),
    ['start_art_direction', 'get_discovery_questions', 'create_design_plan_v2']
  );
  // The session sent to MCP is always the host's, never the browser's copy.
  assert.equal(calls[1]!.args.session, 'session-1');
  assert.equal(calls[2]!.args.session, 'session-2');
});

test('rejects operations, tool names, and fields the browser is not allowed to choose', async () => {
  const { bridge, calls } = harness(async () => reply('session-1'));
  await bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' });

  await assert.rejects(
    () => bridge.run('review_implementation', {}),
    (error: RuntimeFailure) => error.detail.code === 'INVALID_REQUEST'
  );
  await assert.rejects(
    () => bridge.run('__proto__', {}),
    (error: RuntimeFailure) => error.detail.code === 'INVALID_REQUEST'
  );
  await assert.rejects(
    () => bridge.run('start-art-direction', { prompt: '   ' }),
    (error: RuntimeFailure) => error.detail.path === 'prompt'
  );
  await assert.rejects(
    () => bridge.run('start-art-direction', 'not an object'),
    (error: RuntimeFailure) => error.detail.code === 'INVALID_REQUEST'
  );

  // Extra fields are dropped rather than forwarded to the MCP tool.
  await bridge.run('get-creative-brief', { command: 'rm -rf /', path: '/etc/passwd' });
  const forwarded = calls.at(-1)!.args;
  assert.deepEqual(Object.keys(forwarded), ['session']);
});

test('an operation before any session, and a stale session, are both refused', async () => {
  const { bridge } = harness(async () => reply('session-1'));

  await assert.rejects(
    () => bridge.run('get-creative-brief', {}),
    (error: RuntimeFailure) => error.detail.code === 'INVALID_REQUEST'
  );

  await bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' });
  await assert.rejects(
    () => bridge.run('get-creative-brief', { session: 'session-from-an-old-tab' }),
    (error: RuntimeFailure) => error.detail.code === 'STALE_ARTIFACT'
  );
  // The refusal did not disturb the current session.
  assert.equal(bridge.serializedSession, 'session-1');
});

test('a transport failure reconnects once and the retry succeeds', async () => {
  let attempts = 0;
  const { bridge, sessions } = harness(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('stdio pipe closed');
    return reply('session-1');
  });

  const response = await bridge.run('start-art-direction', {
    prompt: 'A membership site for a small collective'
  });
  assert.equal(response.session, 'session-1');
  assert.equal(attempts, 2);
  assert.equal(sessions.length, 2, 'the broken session was replaced rather than reused');
  assert.equal(sessions[0]!.closed, true);
});

test('a persistent transport failure surfaces one structured retryable error', async () => {
  const { bridge } = harness(async () => {
    throw new Error('stdio pipe closed');
  });

  await assert.rejects(
    () => bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' }),
    (error: RuntimeFailure) => {
      assert.equal(error.detail.code, 'INTERNAL_FAILURE');
      assert.equal(error.detail.retryable, true);
      assert.match(error.detail.message, /stdio pipe closed/);
      return true;
    }
  );
});

test('a session engine rejection is reported as-is and is not retried', async () => {
  let attempts = 0;
  const { bridge } = harness(async () => {
    attempts += 1;
    throw new Error('INVALID_SESSION: approval has not been recorded');
  });

  await assert.rejects(() =>
    bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' })
  );
  assert.equal(attempts, 1, 'a domain rejection must not be replayed against the engine');
});

test('a response without the complete serialized session is refused', async () => {
  const { bridge } = harness(async () => ({ state: { phase: 'discovery' } }));

  await assert.rejects(
    () => bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' }),
    (error: RuntimeFailure) => error.detail.code === 'INTERNAL_FAILURE'
  );
  assert.equal(bridge.serializedSession, '', 'a bad response must not become the current session');
});

test('a hung call times out, drops the session, and reports a retryable timeout', async () => {
  const { bridge, sessions } = harness(
    () =>
      new Promise((_resolve, reject) => {
        // Resolves only when the bridge aborts.
        setTimeout(() => reject(new Error('never')), 5_000).unref?.();
      }),
    { timeoutMilliseconds: 25, maxAttempts: 1 }
  );

  await assert.rejects(
    () => bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' }),
    (error: RuntimeFailure) => {
      assert.equal(error.detail.code, 'TIMEOUT');
      assert.equal(error.detail.retryable, true);
      return true;
    }
  );
  assert.equal(sessions[0]!.closed, true);
});

test('cancellation reports a cancelled operation rather than a timeout', async () => {
  const controller = new AbortController();
  const { bridge } = harness(
    () =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('never')), 5_000).unref?.();
      }),
    { timeoutMilliseconds: 5_000, maxAttempts: 1 }
  );

  const pending = bridge.run(
    'start-art-direction',
    { prompt: 'A membership site for a small collective' },
    controller.signal
  );
  controller.abort();
  await assert.rejects(
    () => pending,
    (error: RuntimeFailure) => error.detail.code === 'CANCELLED_OPERATION'
  );
});

test('concurrent operations are serialized so the session cannot race', async () => {
  let counter = 0;
  const observed: (string | undefined)[] = [];
  const { bridge } = harness(async (call) => {
    observed.push(call.args.session as string | undefined);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return reply(`session-${(counter += 1)}`);
  });

  await bridge.run('start-art-direction', { prompt: 'A membership site for a small collective' });
  await Promise.all([
    bridge.run('get-creative-brief', {}),
    bridge.run('develop-art-direction', {}),
    bridge.run('create-design-plan-v2', {})
  ]);

  assert.deepEqual(observed, [undefined, 'session-1', 'session-2', 'session-3']);
  assert.equal(bridge.serializedSession, 'session-4');
});
