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
