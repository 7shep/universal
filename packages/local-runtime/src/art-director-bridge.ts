// Trusted host bridge between Studio and the local Art Director MCP server.
//
// Browsers cannot speak stdio, so Studio cannot reach the MCP server directly.
// This bridge is the only thing that can, and it is deliberately narrow: it
// exposes eight named operations, nothing else. It never forwards a tool name,
// a command, or a path supplied by the browser, so a compromised Studio origin
// cannot use it to reach the filesystem, spawn a process, or call an MCP tool
// that Studio has no business calling.
//
// See docs/STUDIO_HOST_BRIDGE.md for the trust boundary this implements.
import { RuntimeFailure } from './errors.ts';

/** One live MCP session. The transport is injected so tests need no subprocess. */
export interface ArtDirectorMcpSession {
  call(tool: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export type ArtDirectorSessionFactory = () => Promise<ArtDirectorMcpSession>;

export interface ArtDirectorBridgeOptions {
  createSession: ArtDirectorSessionFactory;
  timeoutMilliseconds?: number;
  maxAttempts?: number;
}

/** The complete serialized session plus whatever the operation returned. */
export interface ArtDirectorBridgeResponse {
  session: string;
  state: unknown;
  data?: unknown;
}

type Shape = 'prompt' | 'answers' | 'none' | 'approval';
interface Operation {
  tool: string;
  requiresSession: boolean;
  shape: Shape;
}

/**
 * The allowlist. An operation Studio does not need is not reachable, and the
 * `tool` name always comes from here rather than from the request.
 */
const OPERATIONS: Readonly<Record<string, Operation>> = {
  'start-art-direction': { tool: 'start_art_direction', requiresSession: false, shape: 'prompt' },
  'get-discovery-questions': {
    tool: 'get_discovery_questions',
    requiresSession: true,
    shape: 'none'
  },
  'submit-discovery-answers': {
    tool: 'submit_discovery_answers',
    requiresSession: true,
    shape: 'answers'
  },
  'get-creative-brief': { tool: 'get_creative_brief', requiresSession: true, shape: 'none' },
  'approve-creative-brief': {
    tool: 'approve_creative_brief',
    requiresSession: true,
    shape: 'approval'
  },
  'develop-art-direction': { tool: 'develop_art_direction', requiresSession: true, shape: 'none' },
  'get-selected-direction': {
    tool: 'get_selected_direction',
    requiresSession: true,
    shape: 'none'
  },
  'create-design-plan-v2': { tool: 'create_design_plan_v2', requiresSession: true, shape: 'none' }
};

export const ART_DIRECTOR_OPERATIONS = Object.freeze(Object.keys(OPERATIONS));

const MAX_PROMPT_CHARACTERS = 8 * 1024;
const MAX_SESSION_CHARACTERS = 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (message: string, path: string): RuntimeFailure =>
  new RuntimeFailure('INVALID_REQUEST', message, { path });

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw invalid(`${path} must be a non-empty string.`, path);
  if (value.length > max) throw invalid(`${path} exceeds the bridge quota.`, path);
  return value;
}

function optionalRequestId(input: Record<string, unknown>): Record<string, unknown> {
  if (input.requestId === undefined) return {};
  return { requestId: text(input.requestId, 'requestId', 256) };
}

/** Builds the MCP arguments from the request. Unknown fields are dropped, never forwarded. */
function argumentsFor(
  operation: Operation,
  session: string | undefined,
  input: Record<string, unknown>
): Record<string, unknown> {
  const base = session ? { session } : {};
  switch (operation.shape) {
    case 'prompt':
      return {
        prompt: text(input.prompt, 'prompt', MAX_PROMPT_CHARACTERS),
        ...optionalRequestId(input)
      };
    case 'answers': {
      if (!Array.isArray(input.answers) || input.answers.length === 0)
        throw invalid('answers must be a non-empty array.', 'answers');
      if (!isRecord(input.pageMap)) throw invalid('pageMap must be an object.', 'pageMap');
      return {
        ...base,
        answers: input.answers,
        pageMap: input.pageMap,
        ...optionalRequestId(input)
      };
    }
    case 'approval':
      return {
        ...base,
        ...(input.approvedBy === undefined
          ? {}
          : { approvedBy: text(input.approvedBy, 'approvedBy', 256) }),
        ...optionalRequestId(input)
      };
    case 'none':
      return { ...base, ...optionalRequestId(input) };
  }
}

function parseResponse(value: unknown): ArtDirectorBridgeResponse {
  if (!isRecord(value)) throw new RuntimeFailure('INTERNAL_FAILURE', 'MCP returned a non-object.');
  if (typeof value.session !== 'string' || value.session.length === 0)
    throw new RuntimeFailure(
      'INTERNAL_FAILURE',
      'MCP response did not carry the complete serialized session.'
    );
  if (value.session.length > MAX_SESSION_CHARACTERS)
    throw new RuntimeFailure('QUOTA_EXCEEDED', 'MCP session exceeds the bridge quota.');
  return {
    session: value.session,
    state: value.state,
    ...(value.data === undefined ? {} : { data: value.data })
  };
}

/** Distinguishes "the session engine rejected this" from "the transport broke". */
const isTransportFailure = (error: unknown): boolean =>
  !(error instanceof RuntimeFailure) &&
  !(error instanceof Error && /INVALID_SESSION|ILLEGAL_TRANSITION|IDEMPOTENCY/.test(error.message));

export class ArtDirectorBridge {
  private readonly createSession: ArtDirectorSessionFactory;
  private readonly timeoutMilliseconds: number;
  private readonly maxAttempts: number;
  private session: ArtDirectorMcpSession | undefined;
  /** The authoritative serialized session; the browser never becomes the source of truth. */
  private current = '';
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: ArtDirectorBridgeOptions) {
    this.createSession = options.createSession;
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? 60_000;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  }

  get serializedSession(): string {
    return this.current;
  }

  async close(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    if (session) await session.close().catch(() => undefined);
  }

  /**
   * Runs one allowlisted operation. Calls are serialized: the session is a
   * single mutable artifact, so overlapping mutations would race.
   */
  async run(
    operation: string,
    input: unknown,
    signal?: AbortSignal
  ): Promise<ArtDirectorBridgeResponse> {
    const result = this.queue.then(
      () => this.execute(operation, input, signal),
      () => this.execute(operation, input, signal)
    );
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async execute(
    operation: string,
    input: unknown,
    signal?: AbortSignal
  ): Promise<ArtDirectorBridgeResponse> {
    const definition = Object.prototype.hasOwnProperty.call(OPERATIONS, operation)
      ? OPERATIONS[operation]
      : undefined;
    if (!definition)
      throw new RuntimeFailure('INVALID_REQUEST', `Unknown art director operation: ${operation}.`, {
        path: 'operation'
      });
    if (input !== undefined && !isRecord(input))
      throw invalid('Request body must be an object.', 'body');
    const body = isRecord(input) ? input : {};

    let session: string | undefined;
    if (definition.requiresSession) {
      if (!this.current)
        throw new RuntimeFailure(
          'INVALID_REQUEST',
          'No art direction has been started on this host.',
          { path: 'session' }
        );
      // The browser must echo the session it last saw. If it does not, its view
      // is stale and replaying it would silently discard newer decisions.
      const supplied = body.session;
      if (supplied !== undefined && supplied !== this.current)
        throw new RuntimeFailure(
          'STALE_ARTIFACT',
          'Supplied session is not the current host session. Reload Studio state before retrying.',
          { path: 'session' }
        );
      session = this.current;
    }

    const args = argumentsFor(definition, session, body);
    const response = await this.callWithRetry(definition.tool, args, signal);
    this.current = response.session;
    return response;
  }

  private async callWithRetry(
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ArtDirectorBridgeResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (signal?.aborted)
        throw new RuntimeFailure('CANCELLED_OPERATION', 'Art director request was cancelled.');
      try {
        return parseResponse(await this.callOnce(tool, args, signal));
      } catch (error) {
        lastError = error;
        if (error instanceof RuntimeFailure || !isTransportFailure(error)) throw error;
        // The stdio session is gone or unusable; drop it so the next attempt
        // reconnects. The MCP operations are idempotent by request id.
        await this.close();
        if (attempt === this.maxAttempts) break;
      }
    }
    throw new RuntimeFailure(
      'INTERNAL_FAILURE',
      `Art director MCP session is unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      { retryable: true }
    );
  }

  private async callOnce(
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    this.session ??= await this.createSession();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMilliseconds);
    // The bridge does not assume the transport honours the signal: it stops
    // waiting either way, then discards the session so nothing arrives late on
    // a connection a later request would reuse.
    const abandoned = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          const cancelled = signal?.aborted === true;
          reject(
            new RuntimeFailure(
              cancelled ? 'CANCELLED_OPERATION' : 'TIMEOUT',
              cancelled
                ? 'Art director request was cancelled.'
                : 'Art director request exceeded the host timeout.',
              { retryable: !cancelled }
            )
          );
        },
        { once: true }
      );
    });
    try {
      return await Promise.race([this.session.call(tool, args, controller.signal), abandoned]);
    } catch (error) {
      if (controller.signal.aborted) await this.close();
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
