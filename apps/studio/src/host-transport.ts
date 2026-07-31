// Browser side of the trusted host bridge.
//
// Studio cannot open a stdio MCP session, so it calls the trusted local runtime
// over its loopback HTTP API and the runtime holds the session. This module
// only names allowlisted operations; it never sends a tool name, a command, or
// a path, because the host would refuse them anyway.
//
// See docs/STUDIO_HOST_BRIDGE.md.
import type { DiscoveryAnswer, PageMap } from '@universal/design-engine';
import type { ArtDirectorMcpTransport, ArtDirectorSurfaceResponse } from './studio-client';

export class HostBridgeError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'HostBridgeError';
    this.code = code;
    this.retryable = retryable;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parse(value: unknown): ArtDirectorSurfaceResponse {
  if (!isRecord(value) || typeof value.session !== 'string' || value.session.length === 0)
    throw new HostBridgeError(
      'INVALID_RESPONSE',
      'The local runtime did not return a complete art direction session.',
      false
    );
  return {
    session: value.session,
    state: value.state,
    ...(value.data === undefined ? {} : { data: value.data })
  };
}

export interface HostBridgeOptions {
  /** Loopback origin of the trusted runtime, e.g. http://127.0.0.1:41234 */
  origin: string;
  fetchImplementation?: typeof fetch;
}

export class HostArtDirectorTransport implements ArtDirectorMcpTransport {
  private readonly origin: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: HostBridgeOptions) {
    const url = new URL(options.origin);
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')
      throw new HostBridgeError(
        'INVALID_ORIGIN',
        'The art director host bridge only talks to a loopback runtime.',
        false
      );
    this.origin = url.origin;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
  }

  private async post(operation: string, payload: unknown): Promise<ArtDirectorSurfaceResponse> {
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.origin}/api/v1/art-director/${operation}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload ?? {})
      });
    } catch (error) {
      throw new HostBridgeError(
        'RUNTIME_UNREACHABLE',
        `The trusted local runtime is not reachable: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
    const value: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail = isRecord(value) && isRecord(value.error) ? value.error : undefined;
      throw new HostBridgeError(
        typeof detail?.code === 'string' ? detail.code : 'RUNTIME_ERROR',
        typeof detail?.message === 'string'
          ? detail.message
          : `The local runtime rejected the request with ${response.status}.`,
        detail?.retryable === true
      );
    }
    return parse(value);
  }

  startArtDirection(input: { prompt: string; requestId?: string }) {
    return this.post('start-art-direction', input);
  }
  getDiscoveryQuestions(session: string) {
    return this.post('get-discovery-questions', { session });
  }
  submitDiscoveryAnswers(
    session: string,
    input: { answers: readonly DiscoveryAnswer[]; pageMap: PageMap; requestId?: string }
  ) {
    return this.post('submit-discovery-answers', { session, ...input });
  }
  getCreativeBrief(session: string, input?: { requestId?: string }) {
    return this.post('get-creative-brief', { session, ...input });
  }
  approveCreativeBrief(session: string, input?: { approvedBy?: string; requestId?: string }) {
    return this.post('approve-creative-brief', { session, ...input });
  }
  developArtDirection(session: string, input?: { requestId?: string }) {
    return this.post('develop-art-direction', { session, ...input });
  }
  getSelectedDirection(session: string, input?: { requestId?: string }) {
    return this.post('get-selected-direction', { session, ...input });
  }
  createDesignPlanV2(session: string, input?: { requestId?: string }) {
    return this.post('create-design-plan-v2', { session, ...input });
  }
}

/** True when this runtime was started with an art director bridge attached. */
export async function hostBridgeAvailable(
  origin: string,
  fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<boolean> {
  try {
    const response = await fetchImplementation(`${origin}/api/v1/art-director/operations`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return false;
    const value: unknown = await response.json();
    return isRecord(value) && value.available === true;
  } catch {
    return false;
  }
}
