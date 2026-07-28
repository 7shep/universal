import type { RuntimeError, RuntimeErrorCode } from '@universal/runtime-contracts';
export class RuntimeFailure extends Error {
  readonly detail: RuntimeError;
  constructor(
    code: RuntimeErrorCode,
    message: string,
    options: { retryable?: boolean; path?: string; diagnosticId?: string } = {}
  ) {
    super(message);
    this.name = 'RuntimeFailure';
    this.detail = {
      code,
      message,
      retryable: options.retryable ?? false,
      ...(options.path ? { path: options.path } : {}),
      ...(options.diagnosticId ? { diagnosticId: options.diagnosticId } : {})
    };
  }
}
export const runtimeError = (
  error: unknown,
  fallback: RuntimeErrorCode = 'INTERNAL_FAILURE'
): RuntimeError =>
  error instanceof RuntimeFailure
    ? error.detail
    : {
        code: fallback,
        message: error instanceof Error ? error.message : String(error),
        retryable: fallback === 'INTERNAL_FAILURE'
      };
