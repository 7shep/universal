import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { resolveArtDirectorEntry } from '../src/art-director-session.ts';

test('resolveArtDirectorEntry finds the built design-mcp entry', (t) => {
  const entry = resolveArtDirectorEntry();
  if (entry === undefined) {
    // Skip loudly rather than returning early: a silent pass would hide the fact
    // that this assertion never ran.
    t.skip('design-mcp is not built; run `pnpm --filter @7shep/universal-mcp build`');
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
