import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RUNTIME_CONTRACT_VERSION, type PreviewDescriptor } from '@universal/runtime-contracts';
import { RuntimeFailure } from './errors.ts';

const CSP =
  "default-src 'self'; base-uri 'none'; object-src 'none'; connect-src 'none'; frame-src 'none'; worker-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'none'; frame-ancestors http://127.0.0.1:*";
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};
export interface PreviewServer {
  descriptor: PreviewDescriptor;
  close(): Promise<void>;
}
function safeTarget(root: string, pathname: string): string | undefined {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..'))
    return undefined;
  const target = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? undefined : target;
}
export async function startPreviewServer(input: {
  outputPath: string;
  projectId: string;
  revisionId: string;
  buildId: string;
  now: string;
}): Promise<PreviewServer> {
  if (!(await stat(input.outputPath)).isDirectory())
    throw new RuntimeFailure('PREVIEW_UNAVAILABLE', 'Successful build output is unavailable.');
  const server: Server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const candidate = safeTarget(input.outputPath, url.pathname);
    if (!candidate) {
      response.writeHead(400).end('Invalid path');
      return;
    }
    let target = candidate;
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await stat(target);
    } catch {
      target = path.join(input.outputPath, 'index.html');
    }
    try {
      const content = await readFile(target);
      response.setHeader(
        'Content-Type',
        types[path.extname(target).toLowerCase()] ?? 'application/octet-stream'
      );
      response.writeHead(200).end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new RuntimeFailure('PREVIEW_UNAVAILABLE', 'Preview server failed to bind.');
  }
  const origin = `http://127.0.0.1:${address.port}`;
  const descriptor: PreviewDescriptor = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    projectId: input.projectId,
    revisionId: input.revisionId,
    buildId: input.buildId,
    url: `${origin}/`,
    origin,
    issuedAt: input.now,
    csp: CSP
  };
  return {
    descriptor,
    close: async () =>
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}
