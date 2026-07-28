import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { redactSecrets } from '@universal/generation';
import { RUNTIME_CONTRACT_VERSION, type RuntimeError } from '@universal/runtime-contracts';
import { RuntimeFailure, runtimeError } from './errors.ts';
import type { RuntimeService } from './runtime-service.ts';

const MAX_BODY = 1024 * 1024;
function json(response: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`;
  response
    .writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    })
    .end(body);
}
function cookie(request: IncomingMessage, name: string): string | undefined {
  for (const item of (request.headers.cookie ?? '').split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return undefined;
}
function sameSecret(left: string | undefined, right: string): boolean {
  if (!left) return false;
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}
async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_BODY)
      throw new RuntimeFailure('QUOTA_EXCEEDED', 'Request body exceeds the runtime quota.');
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RuntimeFailure('INVALID_REQUEST', 'Request body must be valid JSON.');
  }
}
export interface RuntimeHttpServerOptions {
  service: RuntimeService;
  allowedOrigins: readonly string[];
  secrets?: readonly string[];
  bootstrapToken?: string;
}
export class RuntimeHttpServer {
  private readonly service: RuntimeService;
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly secrets: readonly string[];
  private readonly bootstrapToken: string;
  private readonly sessionToken = randomBytes(32).toString('base64url');
  private server: Server | undefined;
  private expectedHost = '';
  private bootstrapped = false;
  constructor(options: RuntimeHttpServerOptions) {
    this.service = options.service;
    this.allowedOrigins = new Set(options.allowedOrigins);
    this.secrets = options.secrets ?? [];
    this.bootstrapToken = options.bootstrapToken ?? randomBytes(32).toString('base64url');
  }
  get bootstrapSecret(): string {
    return this.bootstrapToken;
  }
  get origin(): string {
    if (!this.server) throw new Error('Runtime HTTP server is not started.');
    const address = this.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Runtime HTTP server has no TCP address.');
    return `http://127.0.0.1:${address.port}`;
  }
  async start(): Promise<void> {
    if (this.server) return;
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
    this.expectedHost = new URL(this.origin).host;
  }
  private cors(request: IncomingMessage, response: ServerResponse): string | undefined {
    const origin = request.headers.origin;
    if (origin && this.allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }
    return origin;
  }
  private assertBoundary(request: IncomingMessage, mutating: boolean): void {
    if (request.headers.host !== this.expectedHost)
      throw new RuntimeFailure(
        'INVALID_ORIGIN',
        'Host header is not the bound loopback runtime host.'
      );
    const origin = request.headers.origin;
    if ((mutating || origin !== undefined) && (!origin || !this.allowedOrigins.has(origin)))
      throw new RuntimeFailure(
        'INVALID_ORIGIN',
        'Origin is not allowed to call the local runtime.'
      );
  }
  private authenticate(request: IncomingMessage): void {
    if (!this.bootstrapped || !sameSecret(cookie(request, 'universal_session'), this.sessionToken))
      throw new RuntimeFailure('UNAUTHORIZED_REQUEST', 'Runtime session is missing or invalid.');
  }
  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const origin = this.cors(request, response),
        method = request.method ?? 'GET',
        url = new URL(request.url ?? '/', this.origin);
      if (method === 'OPTIONS') {
        this.assertBoundary(request, true);
        response
          .writeHead(204, {
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Idempotency-Key,Authorization',
            'Access-Control-Max-Age': '600'
          })
          .end();
        return;
      }
      if (method === 'GET' && url.pathname === '/api/v1/health') {
        this.assertBoundary(request, false);
        json(response, 200, { status: 'ready', contractVersion: RUNTIME_CONTRACT_VERSION });
        return;
      }
      if (method === 'POST' && url.pathname === '/api/v1/bootstrap') {
        this.assertBoundary(request, true);
        if (
          this.bootstrapped ||
          !sameSecret(
            request.headers.authorization?.replace(/^Bootstrap\s+/i, ''),
            this.bootstrapToken
          )
        )
          throw new RuntimeFailure(
            'UNAUTHORIZED_REQUEST',
            'Bootstrap token is invalid or already consumed.'
          );
        this.bootstrapped = true;
        response.setHeader(
          'Set-Cookie',
          `universal_session=${this.sessionToken}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=28800`
        );
        json(response, 200, {
          status: 'bootstrapped',
          contractVersion: RUNTIME_CONTRACT_VERSION,
          origin: this.origin
        });
        return;
      }
      this.assertBoundary(request, method !== 'GET');
      this.authenticate(request);
      if (method === 'GET' && url.pathname === '/api/v1/state') {
        json(response, 200, this.service.state());
        return;
      }
      if (method === 'POST' && url.pathname === '/api/v1/projects/generate') {
        const accepted = await this.service.startGeneration(
          await body(request),
          String(request.headers['idempotency-key'] ?? '')
        );
        json(response, accepted.replayed ? 200 : 202, accepted);
        return;
      }
      const operationMatch = /^\/api\/v1\/operations\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && operationMatch) {
        const operation = this.service.operation(decodeURIComponent(operationMatch[1]!));
        if (!operation) throw new RuntimeFailure('INVALID_REQUEST', 'Operation does not exist.');
        json(response, 200, operation);
        return;
      }
      const cancelMatch = /^\/api\/v1\/operations\/([^/]+)\/cancel$/.exec(url.pathname);
      if (method === 'POST' && cancelMatch) {
        json(response, 200, await this.service.cancel(decodeURIComponent(cancelMatch[1]!)));
        return;
      }
      const previewMatch = /^\/api\/v1\/projects\/([^/]+)\/preview$/.exec(url.pathname);
      if (method === 'GET' && previewMatch) {
        json(response, 200, this.service.preview(decodeURIComponent(previewMatch[1]!)));
        return;
      }
      if (method === 'GET' && url.pathname === '/api/v1/events') {
        const after = Number(url.searchParams.get('after') ?? 0);
        json(response, 200, {
          events: this.service.state().events.filter((event) => event.id > after)
        });
        return;
      }
      json(response, 404, {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Runtime route does not exist.',
          retryable: false
        }
      });
      void origin;
    } catch (error) {
      const detail = runtimeError(error);
      const safe: RuntimeError = {
        ...detail,
        message: redactSecrets(detail.message, this.secrets)
      };
      const status =
        safe.code === 'UNAUTHORIZED_REQUEST'
          ? 401
          : safe.code === 'INVALID_ORIGIN'
            ? 403
            : safe.code === 'IDEMPOTENCY_CONFLICT' || safe.code === 'STALE_ARTIFACT'
              ? 409
              : safe.code === 'QUOTA_EXCEEDED'
                ? 413
                : 400;
      json(response, status, { error: safe });
    }
  }
  async close(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}
