import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DeterministicReactProvider, ReactGenerator } from '@universal/generation';
import { ArtDirectorBridge } from '../src/art-director-bridge.ts';
import { RuntimeHttpServer, RuntimeService } from '../src/index.ts';

function call(
  origin: string,
  input: {
    method?: string;
    path: string;
    origin?: string;
    host?: string;
    authorization?: string;
    cookie?: string;
  }
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}> {
  const url = new URL(input.path, origin);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: input.method ?? 'GET',
        headers: {
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.host ? { Host: input.host } : {}),
          ...(input.authorization ? { Authorization: input.authorization } : {}),
          ...(input.cookie ? { Cookie: input.cookie } : {})
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
          })
        );
      }
    );
    req.once('error', reject);
    req.end();
  });
}
test('runtime accepts one secure bootstrap and rejects invalid Host, Origin, and unauthenticated commands', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-http-')),
    repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-'));
  const service = new RuntimeService({
    workspaceRoot,
    repositoryRoot,
    generator: new ReactGenerator(new DeterministicReactProvider())
  });
  await service.initialize();
  const studio = 'http://127.0.0.1:5173',
    server = new RuntimeHttpServer({
      service,
      allowedOrigins: [studio],
      bootstrapToken: 'test-bootstrap-token'
    });
  await server.start();
  assert.equal(
    (await call(server.origin, { path: '/api/v1/health', host: 'evil.example' })).status,
    403
  );
  assert.equal(
    (
      await call(server.origin, {
        method: 'POST',
        path: '/api/v1/bootstrap',
        origin: 'http://evil.example',
        authorization: 'Bootstrap test-bootstrap-token'
      })
    ).status,
    403
  );
  assert.equal((await call(server.origin, { path: '/api/v1/state', origin: studio })).status, 401);
  const bootstrap = await call(server.origin, {
    method: 'POST',
    path: '/api/v1/bootstrap',
    origin: studio,
    authorization: 'Bootstrap test-bootstrap-token'
  });
  assert.equal(bootstrap.status, 200);
  const cookie = String(bootstrap.headers['set-cookie']?.[0]).split(';')[0]!;
  assert.match(cookie, /^universal_session=/);
  assert.equal(
    (await call(server.origin, { path: '/api/v1/state', origin: studio, cookie })).status,
    200
  );
  assert.equal(
    (await call(server.origin, { path: '/api/v1/state', origin: 'http://evil.example', cookie }))
      .status,
    403
  );
  assert.equal(
    (
      await call(server.origin, {
        method: 'POST',
        path: '/api/v1/bootstrap',
        origin: studio,
        authorization: 'Bootstrap test-bootstrap-token'
      })
    ).status,
    401
  );
  const early = await call(server.origin, {
    path: '/api/v1/projects/project%3Anone/preview',
    origin: studio,
    cookie
  });
  assert.equal(early.status, 400);
  assert.equal((early.body as { error: { code: string } }).error.code, 'PREVIEW_UNAVAILABLE');
  await server.close();
  await service.shutdown();
});

async function bootstrappedServer(
  artDirector: ArtDirectorBridge | undefined
): Promise<{ server: RuntimeHttpServer; service: RuntimeService; studio: string; cookie: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-http-')),
    repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-'));
  const service = new RuntimeService({
    workspaceRoot,
    repositoryRoot,
    generator: new ReactGenerator(new DeterministicReactProvider())
  });
  await service.initialize();
  const studio = 'http://127.0.0.1:5173',
    server = new RuntimeHttpServer({
      service,
      allowedOrigins: [studio],
      bootstrapToken: 'test-bootstrap-token',
      ...(artDirector ? { artDirector } : {})
    });
  await server.start();
  const bootstrap = await call(server.origin, {
    method: 'POST',
    path: '/api/v1/bootstrap',
    origin: studio,
    authorization: 'Bootstrap test-bootstrap-token'
  });
  assert.equal(bootstrap.status, 200);
  const cookie = String(bootstrap.headers['set-cookie']?.[0]).split(';')[0]!;
  return { server, service, studio, cookie };
}

test('the art director reports available only when a bridge is attached', async () => {
  const withBridge = await bootstrappedServer(
    new ArtDirectorBridge({
      createSession: async () => ({
        call: async () => ({ session: 's', state: {} }),
        close: async () => undefined
      })
    })
  );
  try {
    const response = await call(withBridge.server.origin, {
      path: '/api/v1/art-director/operations',
      origin: withBridge.studio,
      cookie: withBridge.cookie
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { available: boolean }).available, true);
  } finally {
    await withBridge.server.close();
    await withBridge.service.shutdown();
  }

  const withoutBridge = await bootstrappedServer(undefined);
  try {
    const response = await call(withoutBridge.server.origin, {
      path: '/api/v1/art-director/operations',
      origin: withoutBridge.studio,
      cookie: withoutBridge.cookie
    });
    assert.equal(response.status, 200);
    assert.equal((response.body as { available: boolean }).available, false);
  } finally {
    await withoutBridge.server.close();
    await withoutBridge.service.shutdown();
  }
});

test('art director operations still require a session', async () => {
  const { server, service, studio } = await bootstrappedServer(undefined);
  try {
    const response = await call(server.origin, {
      path: '/api/v1/art-director/operations',
      origin: studio
    });
    assert.equal(response.status, 401);
  } finally {
    await server.close();
    await service.shutdown();
  }
});
