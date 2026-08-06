import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BuildPipelineFailure, RuntimeFailure } from '@universal/local-runtime';
import {
  ArtDirectorOrchestrator,
  ArtDirectorError,
  serializeArtDirectorSession
} from './art-director.js';
import { createIntegratedArtDirectorDependencies } from './art-director-services.js';
import {
  createRuntimeBuildMcpAdapter,
  registerRuntimeBuildTools,
  type RuntimeBuildMcpAdapter
} from './runtime-build-mcp.js';

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

async function connectWithFakeAdapter(adapter: RuntimeBuildMcpAdapter): Promise<Client> {
  const server = new McpServer({ name: 'test-runtime-build', version: '0.0.0' });
  registerRuntimeBuildTools(server, adapter);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-runtime-build-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function firstResponseText(result: unknown): string {
  const [first] = (result as { content: Array<{ type: string; text: string }> }).content;
  if (!first) throw new Error('expected a text content item');
  return first.text;
}

test('prepare_react_generation names pnpm and the source-checkout tier when pnpm is not found', async () => {
  const adapter: RuntimeBuildMcpAdapter = {
    async prepare() {
      throw new RuntimeFailure(
        'DEPENDENCY_INSTALL_FAILURE',
        'Could not resolve a shell-free pnpm JavaScript entrypoint.'
      );
    },
    async build() {
      throw new Error('not exercised by this test');
    }
  };
  const client = await connectWithFakeAdapter(adapter);
  try {
    const result = await client.callTool({
      name: 'prepare_react_generation',
      arguments: { session: '{}' }
    });
    assert.equal(result.isError, true);
    const payload = JSON.parse(firstResponseText(result));
    assert.equal(payload.error.code, 'DEPENDENCY_INSTALL_FAILURE');
    assert.match(payload.error.action, /pnpm/i);
    assert.match(payload.error.action, /checkout/i);
  } finally {
    await client.close();
  }
});

test('build_react_project tells the operator to warm the pnpm store when a present pnpm cannot resolve packages offline', async () => {
  const adapter: RuntimeBuildMcpAdapter = {
    async prepare() {
      throw new Error('not exercised by this test');
    },
    async build() {
      throw new BuildPipelineFailure(
        'DEPENDENCY_INSTALL_FAILURE',
        'Locked dependency installation failed.',
        []
      );
    }
  };
  const client = await connectWithFakeAdapter(adapter);
  try {
    const result = await client.callTool({
      name: 'build_react_project',
      arguments: {
        session: '{}',
        requestId: 'preflight-test-request',
        files: [{ path: 'src/App.tsx', content: 'export default function App() { return null; }', kind: 'react' }]
      }
    });
    assert.equal(result.isError, true);
    const payload = JSON.parse(firstResponseText(result));
    assert.equal(payload.error.code, 'DEPENDENCY_INSTALL_FAILURE');
    assert.match(payload.error.action, /pnpm install --frozen-lockfile/);
  } finally {
    await client.close();
  }
});

test('runtime generation preparation fails fast when no pnpm toolchain is available, before touching the session', async () => {
  const adapter = createRuntimeBuildMcpAdapter({ checkPnpmToolchain: async () => false });

  await assert.rejects(
    // An empty session would normally fail session parsing first; the toolchain
    // preflight must short-circuit ahead of that so the error names pnpm, not
    // the unrelated session shape.
    () => adapter.prepare('{}'),
    (error: unknown) =>
      error instanceof RuntimeFailure &&
      error.detail.code === 'DEPENDENCY_INSTALL_FAILURE' &&
      error.detail.message === 'Could not resolve a shell-free pnpm JavaScript entrypoint.'
  );
});
