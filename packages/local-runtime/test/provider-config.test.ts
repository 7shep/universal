import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfiguredGenerator, RuntimeFailure } from '../src/index.ts';
test('deterministic provider is credential-free default and live providers are explicit', () => {
  const configured = createConfiguredGenerator({});
  assert.equal(configured.live, false);
  assert.equal(configured.generator.capabilities.requiresCredentials, false);
  assert.throws(
    () => createConfiguredGenerator({ UNIVERSAL_GENERATION_PROVIDER: 'live' }),
    (error: unknown) => error instanceof RuntimeFailure && /not installed/.test(error.message)
  );
});
