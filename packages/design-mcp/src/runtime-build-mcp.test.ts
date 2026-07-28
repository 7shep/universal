import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ArtDirectorOrchestrator,
  ArtDirectorError,
  serializeArtDirectorSession
} from './art-director.js';
import { createIntegratedArtDirectorDependencies } from './art-director-services.js';
import { createRuntimeBuildMcpAdapter } from './runtime-build-mcp.js';

test('runtime generation preparation requires a current plan-created session', async () => {
  const orchestrator = new ArtDirectorOrchestrator(
      createIntegratedArtDirectorDependencies({
        now: () => '2026-07-28T18:00:00.000Z',
        createSessionId: () => 'art-direction:runtime-build-test'
      })
    ),
    session = orchestrator.start({ prompt: 'A custom editorial archive.' }),
    adapter = createRuntimeBuildMcpAdapter();

  await assert.rejects(
    () => adapter.prepare(serializeArtDirectorSession(session)),
    (error: unknown) => error instanceof ArtDirectorError && error.code === 'ILLEGAL_TRANSITION'
  );
});
