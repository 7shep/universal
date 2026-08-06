import type { RuntimeError, RuntimeErrorCode } from '@universal/runtime-contracts';
export class RuntimeFailure extends Error {
  readonly detail: RuntimeError;
  constructor(
    code: RuntimeErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      path?: string;
      diagnosticId?: string;
      /**
       * A concrete, actionable next step for the caller (e.g. an exact command
       * to run). Surfaced verbatim in the MCP error envelope so a caller never
       * has to guess how to recover from a failed operation.
       */
      action?: string;
    } = {}
  ) {
    super(message);
    this.name = 'RuntimeFailure';
    this.detail = {
      code,
      message,
      retryable: options.retryable ?? false,
      ...(options.path ? { path: options.path } : {}),
      ...(options.diagnosticId ? { diagnosticId: options.diagnosticId } : {}),
      ...(options.action ? { action: options.action } : {})
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
