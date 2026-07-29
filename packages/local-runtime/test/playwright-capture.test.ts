import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runRenderedQaWithPlaywright } from '../src/index.ts';

test('captures real desktop and mobile evidence for every route with a pinned browser', async () => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), 'universal-browser-evidence-'));
  let server: ReturnType<typeof createServer> | undefined;
  let closeCount = 0;
  const result = await runRenderedQaWithPlaywright({
    revisionId: 'revision:browser-1',
    routes: ['/', '/archive'],
    evidenceRoot,
    adapter: {
      async build() {},
      async launch() {
        server = createServer((_request, response) => {
          response.setHeader('content-type', 'text/html; charset=utf-8');
          response.end(`<!doctype html><html><head><style>
            *{box-sizing:border-box} body{margin:0;padding:24px;font:16px system-ui}
            a:focus-visible{outline:3px solid #05f;outline-offset:3px}
            @media(prefers-reduced-motion:reduce){*{animation:none!important}}
          </style></head><body><main><h1>Archive</h1><a href="/archive">Browse</a></main></body></html>`);
        });
        await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        return {
          url: `http://127.0.0.1:${address.port}/`,
          async close() {
            closeCount += 1;
            await new Promise<void>((resolve, reject) =>
              server!.close((error) => (error ? reject(error) : resolve()))
            );
          }
        };
      }
    }
  });
  assert.equal(result.decision, 'accepted-initial');
  assert.equal(result.initial.captures.length, 4);
  assert.equal(closeCount, 1);
  for (const capture of result.initial.captures) {
    const bytes = await readFile(path.join(evidenceRoot, capture.screenshotPath));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  }
});
