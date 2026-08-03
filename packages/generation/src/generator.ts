import type {
  GenerationResult,
  ProjectGenerationRequest,
  ProviderFailureCode,
  ReactGenerationProvider
} from './contracts.ts';
import { validateProjectGenerationRequest, validateProviderProject } from './validation.ts';

const SECRET_PATTERNS = [
  /\bsk-[a-z0-9_-]{12,}\b/gi,
  /\b(?:api[_-]?key|token|authorization|secret)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[a-z0-9._~+/-]+=*\b/gi
] as const;
export function redactSecrets(value: string, secrets: readonly string[] = []): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, '[REDACTED]');
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, '[REDACTED]');
  return result;
}
const RETRYABLE_FAILURES: ReadonlySet<ProviderFailureCode> = new Set([
  'rate-limit',
  'timeout',
  'unavailable',
  'internal'
]);
/**
 * Lets a provider name the failure it hit. Without this every provider throw
 * collapses to `internal`, so the runtime cannot tell "not logged in" or
 * "subscription usage limit reached" from a crash, and always advertises the
 * failure as retryable.
 */
export class ProviderError extends Error {
  readonly code: ProviderFailureCode;
  constructor(code: ProviderFailureCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProviderError';
    this.code = code;
  }
}
export class ReactGenerator {
  private readonly provider: ReactGenerationProvider;
  private readonly secrets: readonly string[];
  constructor(provider: ReactGenerationProvider, secrets: readonly string[] = []) {
    this.provider = provider;
    this.secrets = secrets;
  }
  get capabilities() {
    return this.provider.capabilities;
  }
  async generate(value: unknown, signal?: AbortSignal): Promise<GenerationResult> {
    const checked = validateProjectGenerationRequest(value);
    if (!checked.ok)
      return {
        ok: false,
        failure: {
          code: 'malformed-output',
          providerId: this.provider.capabilities.providerId,
          message: `${checked.error.path}: ${checked.error.message}`,
          retryable: false,
          diagnostics: [
            {
              code: checked.error.code,
              severity: 'error',
              path: checked.error.path,
              message: checked.error.message
            }
          ]
        }
      };
    try {
      const raw = await this.provider.generate(checked.value, signal);
      const project = validateProviderProject(raw, checked.value);
      if (!project.ok)
        return {
          ok: false,
          failure: {
            code: 'malformed-output',
            providerId: this.provider.capabilities.providerId,
            message: `${project.error.path}: ${project.error.message}`,
            retryable: false,
            diagnostics: [
              {
                code: project.error.code,
                severity: 'error',
                path: project.error.path,
                message: project.error.message
              }
            ]
          }
        };
      const providerText = [
        ...project.value.files.map((file) => file.content),
        ...project.value.assets.map((asset) =>
          Buffer.from(asset.content, 'base64').toString('utf8')
        )
      ].join('\n');
      if (redactSecrets(providerText, this.secrets) !== providerText)
        return {
          ok: false,
          failure: {
            code: 'malformed-output',
            providerId: this.provider.capabilities.providerId,
            message: 'Provider output contained credential-shaped material and was rejected.',
            retryable: false,
            diagnostics: [
              {
                code: 'SECRET_LEAK',
                severity: 'error',
                message: 'Generated project content failed the secret scan.'
              }
            ]
          }
        };
      return { ok: true, project: project.value };
    } catch (error) {
      // An aborted signal outranks whatever the provider reported: a CLI killed
      // mid-generation exits non-zero, and that exit is the cancellation, not a
      // separate failure.
      const code: ProviderFailureCode = (signal?.aborted ?? false)
        ? 'cancelled'
        : error instanceof ProviderError
          ? error.code
          : 'internal';
      const cancelled = code === 'cancelled';
      return {
        ok: false,
        failure: {
          code,
          providerId: this.provider.capabilities.providerId,
          message: redactSecrets(
            error instanceof Error ? error.message : String(error),
            this.secrets
          ),
          retryable: RETRYABLE_FAILURES.has(code),
          diagnostics: [
            {
              code: cancelled ? 'GENERATION_CANCELLED' : 'GENERATION_FAILED',
              severity: 'error',
              message: cancelled ? 'Generation was cancelled.' : 'Generation provider failed.'
            }
          ]
        }
      };
    }
  }
}
export function assertGenerationRequest(request: ProjectGenerationRequest): void {
  const checked = validateProjectGenerationRequest(request);
  if (!checked.ok)
    throw new Error(`${checked.error.code} at ${checked.error.path}: ${checked.error.message}`);
}
