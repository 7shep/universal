# Art Director Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `ArtDirectorBridge` into the local runtime so Studio produces a real Design Plan v2 and "Generate React site" builds an actual project.

**Architecture:** The runtime probes at startup for design-mcp's built entry point. If present, it constructs an `ArtDirectorBridge` whose session factory spawns `node <entry>` over the MCP SDK's stdio transport. Studio's bootstrap is extracted into a memoized `ensureRuntimeSession` so the bridge capability probe runs after a session exists rather than before it.

**Tech Stack:** TypeScript, Node 22 (`--experimental-strip-types`), `@modelcontextprotocol/sdk` 1.x, node:test (runtime), vitest (Studio), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-02-art-director-bridge-design.md`

## Global Constraints

- `@modelcontextprotocol/sdk` pinned at `^1.12.0`, matching `packages/design-mcp/package.json`.
- `@7shep/universal-mcp` added as `workspace:*`.
- No logic changes to `ArtDirectorBridge`, `http-server.ts`, or `host-transport.ts`. Tests may be extended.
- The eight-operation allowlist is unchanged. `trust-boundary.test.ts` and `security.test.ts` must keep passing untouched; if either fails, stop and report rather than editing them.
- Runtime source files use `.ts` extensions in import specifiers (`import { X } from './y.ts'`).
- Runtime tests are `node:test`; Studio tests are vitest.
- The runtime must still boot when design-mcp is unbuilt.

## Contract reference (verified against source)

design-mcp tool results, from `packages/design-mcp/src/art-director-mcp.ts:143-160`:

- Success: `{ content: [{ type: 'text', text: JSON.stringify({ session, state, data? }) }] }`
- Failure: `{ content: [{ type: 'text', text: JSON.stringify({ error: { code, message, action } }) }], isError: true }`

`ArtDirectorBridge.parseResponse` (`art-director-bridge.ts:131`) requires the parsed object to carry a non-empty `session` string. `isTransportFailure` (`:148`) does **not** retry when the thrown error message matches `/INVALID_SESSION|ILLEGAL_TRANSITION|IDEMPOTENCY/`, so session-level errors must be thrown with their code in the message.

---

### Task 1: Probe for the design-mcp entry point

**Files:**
- Modify: `packages/local-runtime/package.json`
- Create: `packages/local-runtime/src/art-director-session.ts`
- Test: `packages/local-runtime/test/art-director-session.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `resolveArtDirectorEntry(override?: string): string | undefined` — absolute path to design-mcp's `dist/index.js`, or `undefined` when unbuilt or unresolvable.

- [ ] **Step 1: Add the dependencies**

In `packages/local-runtime/package.json`, add to `dependencies` (keep the existing keys, alphabetical order):

```json
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@7shep/universal-mcp": "workspace:*",
```

Then run:

```bash
pnpm install
```

- [ ] **Step 2: Write the failing test**

Create `packages/local-runtime/test/art-director-session.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { resolveArtDirectorEntry } from '../src/art-director-session.ts';

test('resolveArtDirectorEntry finds the built design-mcp entry', () => {
  const entry = resolveArtDirectorEntry();
  if (entry === undefined) {
    // design-mcp is not built in this checkout; the negative case below still runs.
    return;
  }
  assert.equal(path.basename(entry), 'index.js');
  assert.ok(existsSync(entry), 'resolved entry must exist on disk');
});

test('resolveArtDirectorEntry returns undefined when the entry is missing', () => {
  const missing = path.join(import.meta.dirname, 'no-such-design-mcp-entry.js');
  assert.equal(resolveArtDirectorEntry(missing), undefined);
});

test('resolveArtDirectorEntry accepts an existing override path', () => {
  const self = path.join(import.meta.dirname, 'art-director-session.test.ts');
  assert.equal(resolveArtDirectorEntry(self), self);
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd packages/local-runtime && node --experimental-strip-types --test test/art-director-session.test.ts
```

Expected: FAIL — cannot find module `../src/art-director-session.ts`.

- [ ] **Step 4: Write the implementation**

Create `packages/local-runtime/src/art-director-session.ts`:

```ts
// Turns a filesystem path into a live art director MCP session. This module knows
// nothing about operations, allowlists, or HTTP; ArtDirectorBridge owns all of that.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PACKAGE = '@7shep/universal-mcp';

/**
 * Locates design-mcp's built entry point. Returns undefined when the package is
 * present but unbuilt, which is the realistic failure in a fresh checkout.
 * `override` exists so the negative case is testable without deleting build output.
 */
export function resolveArtDirectorEntry(override?: string): string | undefined {
  if (override !== undefined) return existsSync(override) ? override : undefined;
  try {
    const manifest = createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`);
    const entry = path.join(path.dirname(manifest), 'dist', 'index.js');
    return existsSync(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd packages/local-runtime && node --experimental-strip-types --test test/art-director-session.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/local-runtime/package.json packages/local-runtime/src/art-director-session.ts packages/local-runtime/test/art-director-session.test.ts pnpm-lock.yaml
git commit -m "feat(runtime): probe for the built design-mcp entry point"
```

---

### Task 2: Spawn a real stdio MCP session

**Files:**
- Modify: `packages/local-runtime/src/art-director-session.ts`
- Test: `packages/local-runtime/test/art-director-session.test.ts`

**Interfaces:**
- Consumes: `resolveArtDirectorEntry` from Task 1; `ArtDirectorMcpSession` and `ArtDirectorSessionFactory` from `../src/art-director-bridge.ts`.
- Produces: `createStdioArtDirectorSessionFactory(options: { entry: string; workspaceRoot: string; repositoryRoot: string }): ArtDirectorSessionFactory`.

- [ ] **Step 1: Write the failing integration test**

Append to `packages/local-runtime/test/art-director-session.test.ts`:

```ts
import { ArtDirectorBridge } from '../src/art-director-bridge.ts';
import { createStdioArtDirectorSessionFactory } from '../src/art-director-session.ts';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';

// The bridge's other tests all run against a FakeSession, which is why a bridge that
// was never constructed in production went unnoticed. This one spawns the real child.
test('a real stdio session starts art direction and closes cleanly', async (t) => {
  const entry = resolveArtDirectorEntry();
  if (entry === undefined) {
    t.skip('design-mcp is not built; run `pnpm --filter @7shep/universal-mcp build` first');
    return;
  }
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-art-director-'));
  const bridge = new ArtDirectorBridge({
    createSession: createStdioArtDirectorSessionFactory({
      entry,
      workspaceRoot,
      repositoryRoot: process.cwd()
    })
  });
  try {
    const response = await bridge.run('start-art-direction', {
      prompt: 'A portfolio site for a ceramicist.'
    });
    assert.equal(typeof response.session, 'string');
    assert.ok(response.session.length > 0, 'session must be a non-empty serialized string');
    assert.equal(bridge.serializedSession, response.session);
  } finally {
    await bridge.close();
  }
});

test('a session error carries its code so the bridge does not retry it', async (t) => {
  const entry = resolveArtDirectorEntry();
  if (entry === undefined) {
    t.skip('design-mcp is not built');
    return;
  }
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-art-director-'));
  const factory = createStdioArtDirectorSessionFactory({
    entry,
    workspaceRoot,
    repositoryRoot: process.cwd()
  });
  const session = await factory();
  try {
    await assert.rejects(
      () => session.call('get_discovery_questions', { session: 'not-a-session' }, new AbortController().signal),
      (error: Error) => /[A-Z_]+:/.test(error.message)
    );
  } finally {
    await session.close();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/local-runtime && node --experimental-strip-types --test test/art-director-session.test.ts
```

Expected: FAIL — `createStdioArtDirectorSessionFactory` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/local-runtime/src/art-director-session.ts`:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ArtDirectorMcpSession, ArtDirectorSessionFactory } from './art-director-bridge.ts';

export interface StdioArtDirectorOptions {
  entry: string;
  workspaceRoot: string;
  repositoryRoot: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class StdioArtDirectorSession implements ArtDirectorMcpSession {
  private readonly client: Client;
  constructor(client: Client) {
    this.client = client;
  }

  async call(
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<unknown> {
    const result = await this.client.callTool({ name: tool, arguments: args }, undefined, {
      signal
    });
    const content = Array.isArray(result.content) ? result.content : [];
    const first = content[0];
    if (!isRecord(first) || first.type !== 'text' || typeof first.text !== 'string')
      throw new Error('Art director tool returned no text content.');
    let payload: unknown;
    try {
      payload = JSON.parse(first.text);
    } catch {
      throw new Error('Art director tool returned malformed JSON.');
    }
    // The code must appear in the message: ArtDirectorBridge.isTransportFailure keys off
    // INVALID_SESSION / ILLEGAL_TRANSITION / IDEMPOTENCY to avoid retrying a session
    // error against a fresh child, which would only fail the same way.
    if (result.isError === true) {
      const detail = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
      const code = typeof detail?.code === 'string' ? detail.code : 'ART_DIRECTOR_FAILURE';
      const message = typeof detail?.message === 'string' ? detail.message : first.text;
      throw new Error(`${code}: ${message}`);
    }
    return payload;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * Each call spawns a fresh `node <entry>` child over stdio. The bridge creates a
 * session lazily and drops it on transport failure, so this factory may be called
 * again at any time.
 */
export function createStdioArtDirectorSessionFactory(
  options: StdioArtDirectorOptions
): ArtDirectorSessionFactory {
  return async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [options.entry],
      cwd: options.repositoryRoot,
      env: {
        ...getDefaultEnvironment(),
        UNIVERSAL_WORKSPACE_ROOT: options.workspaceRoot,
        UNIVERSAL_REPOSITORY_ROOT: options.repositoryRoot
      },
      stderr: 'pipe'
    });
    const client = new Client({ name: 'universal-local-runtime', version: '0.1.0' });
    await client.connect(transport);
    return new StdioArtDirectorSession(client);
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd packages/local-runtime && node --experimental-strip-types --test test/art-director-session.test.ts
```

Expected: PASS, 5 tests. If design-mcp is unbuilt the last two report as skipped — build it with `pnpm --filter @7shep/universal-mcp build` and re-run, because these are the tests that prove the feature.

- [ ] **Step 5: Run the whole runtime suite**

```bash
pnpm --filter @universal/local-runtime test
```

Expected: PASS. `trust-boundary.test.ts` and `security.test.ts` must be green and unmodified.

- [ ] **Step 6: Commit**

```bash
git add packages/local-runtime/src/art-director-session.ts packages/local-runtime/test/art-director-session.test.ts
git commit -m "feat(runtime): spawn design-mcp over stdio for the art director bridge"
```

---

### Task 3: Construct the bridge in the runtime CLI

**Files:**
- Modify: `packages/local-runtime/src/cli.ts`
- Modify: `packages/local-runtime/src/index.ts` (export the new module)
- Test: `packages/local-runtime/test/http-server.test.ts`

**Interfaces:**
- Consumes: `resolveArtDirectorEntry` and `createStdioArtDirectorSessionFactory` from Tasks 1-2.
- Produces: a runtime whose startup JSON line includes `artDirector: boolean`, and whose `/api/v1/art-director/operations` reports `available: true` when the bridge is wired.

- [ ] **Step 1: Write the failing test**

Append to `packages/local-runtime/test/http-server.test.ts`. Match the file's existing helper for building a server and an authenticated session — read the top of the file first and reuse it rather than inventing a second harness.

```ts
test('the art director reports available only when a bridge is attached', async () => {
  const withBridge = await startTestServer({
    artDirector: new ArtDirectorBridge({
      createSession: async () => ({
        call: async () => ({ session: 's', state: {} }),
        close: async () => undefined
      })
    })
  });
  try {
    const response = await authenticatedGet(withBridge, '/api/v1/art-director/operations');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).available, true);
  } finally {
    await withBridge.close();
  }

  const withoutBridge = await startTestServer({});
  try {
    const response = await authenticatedGet(withoutBridge, '/api/v1/art-director/operations');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).available, false);
  } finally {
    await withoutBridge.close();
  }
});

test('art director operations still require a session', async () => {
  const server = await startTestServer({});
  try {
    const response = await fetch(`${server.origin}/api/v1/art-director/operations`, {
      headers: { Origin: 'http://127.0.0.1:5173' }
    });
    assert.equal(response.status, 401);
  } finally {
    await server.close();
  }
});
```

Add `import { ArtDirectorBridge } from '../src/art-director-bridge.ts';` to the file's imports if absent.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/local-runtime && node --experimental-strip-types --test test/http-server.test.ts
```

Expected: FAIL. If it fails because `startTestServer`/`authenticatedGet` do not exist under those names, rename the calls to the file's actual helpers — do not add duplicates.

- [ ] **Step 3: Wire the CLI**

In `packages/local-runtime/src/cli.ts`, add to the imports:

```ts
import { ArtDirectorBridge } from './art-director-bridge.ts';
import {
  createStdioArtDirectorSessionFactory,
  resolveArtDirectorEntry
} from './art-director-session.ts';
```

Replace the server construction and startup line:

```ts
const artDirectorEntry = resolveArtDirectorEntry();
const artDirector = artDirectorEntry
  ? new ArtDirectorBridge({
      createSession: createStdioArtDirectorSessionFactory({
        entry: artDirectorEntry,
        workspaceRoot,
        repositoryRoot: process.cwd()
      })
    })
  : undefined;
const server = new RuntimeHttpServer({
  service,
  allowedOrigins: [studioOrigin, previewOrigin],
  ...(artDirector ? { artDirector } : {})
});
await server.start();
process.stdout.write(
  `${JSON.stringify({ runtimeOrigin: server.origin, bootstrapToken: server.bootstrapSecret, workspaceRoot, provider: configured.providerId, artDirector: artDirector !== undefined })}\n`
);
```

And in `shutdown`, close the bridge before the server:

```ts
const shutdown = async () => {
  if (artDirector) await artDirector.close();
  await server.close();
  await service.shutdown();
  process.exit(0);
};
```

- [ ] **Step 4: Export the module**

In `packages/local-runtime/src/index.ts`, add alongside the existing exports:

```ts
export {
  createStdioArtDirectorSessionFactory,
  resolveArtDirectorEntry
} from './art-director-session.ts';
```

- [ ] **Step 5: Run the tests and typecheck**

```bash
pnpm --filter @universal/local-runtime test
pnpm --filter @universal/local-runtime typecheck
pnpm --filter @universal/local-runtime lint
```

Expected: all PASS.

- [ ] **Step 6: Verify the runtime boots and reports the bridge**

```bash
pnpm --filter @universal/local-runtime start
```

Expected: the startup JSON line now includes `"artDirector":true`. Press Ctrl+C to stop. If it reports `false`, run `pnpm --filter @7shep/universal-mcp build` and retry.

- [ ] **Step 7: Commit**

```bash
git add packages/local-runtime/src/cli.ts packages/local-runtime/src/index.ts packages/local-runtime/test/http-server.test.ts
git commit -m "feat(runtime): construct the art director bridge when design-mcp is built"
```

---

### Task 4: Memoize Studio's runtime bootstrap

**Files:**
- Modify: `apps/studio/src/runtime-client.ts:82-98`
- Test: `apps/studio/src/runtime-client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ensureRuntimeSession(config: { origin: string; bootstrapToken?: string }): Promise<void>` and `resetRuntimeSessionForTests(): void`, both exported from `runtime-client.ts`.

**Why:** the bootstrap token is single-use (`http-server.ts:149`), but React StrictMode double-mounts create two clients that each redeem it, producing a spurious `POST /api/v1/bootstrap 401` on a freshly started runtime. Task 5 also needs bootstrap callable from outside the class.

- [ ] **Step 1: Write the failing test**

Append to `apps/studio/src/runtime-client.test.ts`:

```ts
import { ensureRuntimeSession, resetRuntimeSessionForTests } from './runtime-client.ts';

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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @universal/studio test -- runtime-client
```

Expected: FAIL — `ensureRuntimeSession` is not exported.

- [ ] **Step 3: Extract the bootstrap**

In `apps/studio/src/runtime-client.ts`, add above the `RuntimeGenerationLifecycleClient` class:

```ts
// The bootstrap token is single-use, and StrictMode mounts the app twice. One shared
// promise per page load means exactly one redemption.
let runtimeSession: Promise<void> | undefined;

async function bootstrapOnce(config: RuntimeConfig): Promise<void> {
  if (!config.bootstrapToken) return;
  const response = await fetch(`${config.origin}/api/v1/bootstrap`, {
    method: 'POST',
    headers: { Authorization: `Bootstrap ${config.bootstrapToken}` },
    credentials: 'include'
  });
  // A 401 means the token was already consumed by this runtime; the session cookie it
  // issued earlier is still valid, so this is not a failure.
  if (!response.ok && response.status !== 401) throw new Error('Local runtime bootstrap failed.');
}

export function ensureRuntimeSession(config: RuntimeConfig): Promise<void> {
  runtimeSession ??= bootstrapOnce(config);
  return runtimeSession;
}

export function resetRuntimeSessionForTests(): void {
  runtimeSession = undefined;
}
```

Then delete the private `bootstrap()` method and the `private bootstrapped = false;` field from the class, and change the 401 retry in `request()` to use the shared helper:

```ts
    if (response.status === 401 && this.config.bootstrapToken) {
      await ensureRuntimeSession(this.config);
      response = await fetch(`${this.config.origin}${path}`, {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
      });
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @universal/studio test -- runtime-client
```

Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/runtime-client.ts apps/studio/src/runtime-client.test.ts
git commit -m "fix(studio): redeem the single-use bootstrap token exactly once"
```

---

### Task 5: Probe the bridge after the session exists

**Files:**
- Modify: `apps/studio/src/main.tsx:36-48`
- Test: `apps/studio/src/main-ordering.test.ts` (create)

**Interfaces:**
- Consumes: `ensureRuntimeSession` from Task 4; `hostBridgeAvailable` from `./host-transport.ts`.
- Produces: no new exports. Behavioral guarantee: `POST /api/v1/bootstrap` precedes `GET /api/v1/art-director/operations`.

**Why:** `main.tsx:39` currently probes at module load, before any bootstrap. `/api/v1/art-director/operations` runs `authenticate()` (`http-server.ts:172`), so it 401s, `hostBridgeAvailable` returns false, and Studio latches to the fixture art director permanently. Without this task, Tasks 1-3 are unreachable from the UI.

- [ ] **Step 1: Write the failing test**

Create `apps/studio/src/main-ordering.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ensureRuntimeSession, resetRuntimeSessionForTests } from './runtime-client.ts';
import { hostBridgeAvailable } from './host-transport.ts';

// main.tsx cannot be imported directly: it mounts React into a real DOM node at module
// load. This test asserts the ordering contract main.tsx must honour.
test('the bridge probe runs only after the runtime session is established', async () => {
  resetRuntimeSessionForTests();
  const order: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/v1/bootstrap')) {
      order.push('bootstrap');
      return new Response('{"status":"bootstrapped"}', { status: 200 });
    }
    order.push('probe');
    return new Response('{"available":true,"operations":[]}', { status: 200 });
  }) as typeof fetch;
  try {
    const runtime = { origin: 'http://127.0.0.1:4300', bootstrapToken: 't' };
    await ensureRuntimeSession(runtime);
    const available = await hostBridgeAvailable(runtime.origin);
    assert.equal(available, true);
    assert.deepEqual(order, ['bootstrap', 'probe']);
  } finally {
    globalThis.fetch = original;
    resetRuntimeSessionForTests();
  }
});
```

- [ ] **Step 2: Run the test to verify it passes for the right reason**

```bash
pnpm --filter @universal/studio test -- main-ordering
```

Expected: PASS. This test pins the contract; Step 3 makes `main.tsx` honour it. Confirm it fails if you swap the two awaits — that is what proves the test has teeth.

- [ ] **Step 3: Fix the ordering in main.tsx**

In `apps/studio/src/main.tsx`, change the import to include the new helper:

```ts
import { createRuntimeGenerationLifecycleClient, ensureRuntimeSession } from './runtime-client';
```

Replace the `if (runtime) { ... }` block at the bottom:

```tsx
if (runtime) {
  // The capability probe is authenticated, so the session must exist first. Probing
  // before bootstrap 401s and latches Studio to the fixture art director for good.
  void ensureRuntimeSession({
    origin: runtime.origin,
    ...(runtime.bootstrapToken ? { bootstrapToken: runtime.bootstrapToken } : {})
  })
    .catch(() => undefined)
    .then(() => hostBridgeAvailable(runtime.origin))
    .then((available) => {
      if (available)
        props.client = createMcpArtDirectorClient(
          new HostArtDirectorTransport({ origin: runtime.origin })
        );
      render();
    });
} else {
  render();
}
```

The `.catch(() => undefined)` is deliberate: a failed bootstrap must still render Studio in fixture mode rather than leaving a blank page.

- [ ] **Step 4: Run the full Studio suite, typecheck, and lint**

```bash
pnpm --filter @universal/studio test
pnpm --filter @universal/studio typecheck
pnpm --filter @universal/studio lint
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/main.tsx apps/studio/src/main-ordering.test.ts
git commit -m "fix(studio): bootstrap the runtime session before probing the host bridge"
```

---

### Task 6: Manual end-to-end verification

**Files:** none modified. This task produces evidence, not code.

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: a confirmed run, or a defect report with the failing step named.

**Why this is a task:** every existing bridge test passed against a `FakeSession` while the bridge was never constructed in production. The automated suites and the real wiring have already disagreed once on this exact feature. Only a live run closes it.

- [ ] **Step 1: Build design-mcp and start the runtime**

```bash
pnpm --filter @7shep/universal-mcp build
pnpm --filter @universal/local-runtime start
```

Confirm the startup JSON shows `"artDirector":true`. Copy `runtimeOrigin` and `bootstrapToken`.

- [ ] **Step 2: Point Studio and Preview at the runtime**

In `apps/studio/public/dev-runtime.local.js`, uncomment and fill in:

```js
window.__UNIVERSAL_RUNTIME__ = {
  origin: 'http://127.0.0.1:PORT',
  bootstrapToken: 'TOKEN'
};
```

In `apps/preview/public/dev-runtime.local.js`, uncomment and fill in the `origin` only.

- [ ] **Step 3: Start the dev servers and open Studio**

```bash
pnpm dev
```

Open `http://127.0.0.1:5173/` — **not** `localhost`, which is a different origin and is rejected by the runtime's allowlist (`cli.ts:10`). Hard-reload (Ctrl+Shift+R) so the bootstrap file is not served from cache.

- [ ] **Step 4: Confirm the bridge was detected**

In DevTools, filter Network by the runtime port. Expected, in order: `POST /api/v1/bootstrap` → 200, then `GET /api/v1/art-director/operations` → 200 with `{"available":true,...}`.

If `available` is false, stop: the runtime did not construct the bridge (re-check Task 3, Step 6).

- [ ] **Step 5: Run the wizard against the real art director**

Enter a prompt and walk through discovery → brief → direction → plan. Each step should issue a `POST /api/v1/art-director/<operation>` returning 200. The plan digest shown on the plan screen now comes from design-mcp rather than the fixture.

- [ ] **Step 6: Generate and preview**

Click "Generate React site". Expected: it no longer throws `Runtime generation requires the canonical approved Design Plan v2.` The lifecycle advances through its phases and an "Open isolated preview" link appears. Follow it and confirm the generated site renders.

- [ ] **Step 7: Restore the local bootstrap files**

```bash
git checkout apps/studio/public/dev-runtime.local.js apps/preview/public/dev-runtime.local.js
```

These must never be committed with a live origin or token.

- [ ] **Step 8: Record the result**

If every step passed, the feature is done. If any step failed, capture the failing request/response and the browser console, and report which step broke rather than patching forward.

---

## Notes for the implementer

- **Do not "fix" `ArtDirectorBridge`.** It is complete. If a bridge test fails, the new session wrapper is returning the wrong shape — compare against the Contract reference at the top of this plan.
- **Do not weaken the allowlist.** If `trust-boundary.test.ts` or `security.test.ts` fails, stop and report.
- **Session errors must not be retried.** The thrown message must start with the MCP error code, or `isTransportFailure` will retry a session error against a fresh child and fail identically twice.
- **One art-direction flow at a time.** The bridge holds a single `current` session (`art-director-bridge.ts:158`). This is intended; see the spec's Constraints section.
