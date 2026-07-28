import {
  RUNTIME_CONTRACT_VERSION,
  type PreviewDescriptor,
  type RuntimeError,
  type RuntimeErrorCode,
  type RuntimeOperation
} from './contracts.ts';
export type RuntimeContractResult<T> = { ok: true; value: T } | { ok: false; error: RuntimeError };
const codes = new Set<RuntimeErrorCode>([
  'INVALID_REQUEST',
  'UNAUTHORIZED_REQUEST',
  'INVALID_ORIGIN',
  'STALE_ARTIFACT',
  'GENERATION_FAILURE',
  'MATERIALIZATION_FAILURE',
  'DEPENDENCY_INSTALL_FAILURE',
  'BUILD_FAILURE',
  'PREVIEW_UNAVAILABLE',
  'TIMEOUT',
  'QUOTA_EXCEEDED',
  'CANCELLED_OPERATION',
  'INTERRUPTED_OPERATION',
  'IDEMPOTENCY_CONFLICT',
  'INTERNAL_FAILURE'
]);
const statuses = new Set<RuntimeOperation['status']>([
  'queued',
  'generating',
  'materializing',
  'installing',
  'building',
  'reviewing',
  'ready',
  'failed',
  'cancelled',
  'interrupted'
]);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const invalid = <T>(message: string, path: string): RuntimeContractResult<T> => ({
  ok: false,
  error: { code: 'INVALID_REQUEST', message, path, retryable: false }
});
export function validateRuntimeError(value: unknown): RuntimeContractResult<RuntimeError> {
  if (!record(value)) return invalid('Runtime error must be an object.', '$');
  if (!codes.has(value.code as RuntimeErrorCode))
    return invalid('Runtime error code is invalid.', 'code');
  if (!text(value.message)) return invalid('Runtime error message is required.', 'message');
  if (typeof value.retryable !== 'boolean')
    return invalid('Runtime error retryable must be boolean.', 'retryable');
  const code = [...codes].find((item) => item === value.code)!;
  return {
    ok: true,
    value: {
      code,
      message: value.message,
      retryable: value.retryable,
      ...(text(value.path) ? { path: value.path } : {}),
      ...(text(value.diagnosticId) ? { diagnosticId: value.diagnosticId } : {})
    }
  };
}
export function validateRuntimeOperation(value: unknown): RuntimeContractResult<RuntimeOperation> {
  if (!record(value)) return invalid('Runtime operation must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  for (const field of [
    'id',
    'projectId',
    'revisionId',
    'requestDigest',
    'idempotencyKey',
    'createdAt',
    'updatedAt'
  ] as const)
    if (!text(value[field])) return invalid(`${field} is required.`, field);
  if (value.kind !== 'generate-build-preview') return invalid('Operation kind is invalid.', 'kind');
  if (!statuses.has(value.status as RuntimeOperation['status']))
    return invalid('Operation status is invalid.', 'status');
  if (typeof value.cancellable !== 'boolean')
    return invalid('cancellable must be boolean.', 'cancellable');
  const status = [...statuses].find((item) => item === value.status)!;
  let error: RuntimeError | undefined;
  if (value.error !== undefined) {
    const checked = validateRuntimeError(value.error);
    if (!checked.ok) return checked;
    error = checked.value;
  }
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: String(value.id),
      kind: 'generate-build-preview',
      projectId: String(value.projectId),
      revisionId: String(value.revisionId),
      requestDigest: String(value.requestDigest),
      idempotencyKey: String(value.idempotencyKey),
      status,
      createdAt: String(value.createdAt),
      updatedAt: String(value.updatedAt),
      cancellable: value.cancellable,
      ...(text(value.buildId) ? { buildId: value.buildId } : {}),
      ...(error ? { error } : {})
    }
  };
}
export function validatePreviewDescriptor(
  value: unknown,
  expectedOrigin?: string
): RuntimeContractResult<PreviewDescriptor> {
  if (!record(value)) return invalid('Preview descriptor must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  for (const field of [
    'projectId',
    'revisionId',
    'buildId',
    'url',
    'origin',
    'issuedAt',
    'csp'
  ] as const)
    if (!text(value[field])) return invalid(`${field} is required.`, field);
  let url: URL;
  try {
    url = new URL(String(value.url));
  } catch {
    return invalid('Preview URL is invalid.', 'url');
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== value.origin)
    return invalid('Preview URL must use the runtime-issued loopback origin.', 'url');
  if (expectedOrigin !== undefined && value.origin !== expectedOrigin)
    return invalid('Preview origin does not match the selected build.', 'origin');
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      projectId: String(value.projectId),
      revisionId: String(value.revisionId),
      buildId: String(value.buildId),
      url: String(value.url),
      origin: String(value.origin),
      issuedAt: String(value.issuedAt),
      csp: String(value.csp)
    }
  };
}

import type {
  BuildDiagnostic,
  BuildRecord,
  ImplementationReviewRecord,
  ProjectRecord,
  RevisionRecord,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeState
} from './contracts.ts';
const buildStatuses = new Set<BuildRecord['status']>([
  'queued',
  'installing',
  'building',
  'reviewing',
  'ready',
  'failed',
  'cancelled',
  'interrupted'
]);
const eventTypes = new Set<RuntimeEventType>([
  'project.updated',
  'operation.updated',
  'operation.failed',
  'build.updated',
  'build.ready',
  'review.updated',
  'runtime.shutdown'
]);
const stages = new Set<BuildDiagnostic['stage']>([
  'install',
  'typecheck',
  'build',
  'review',
  'preview'
]);
const severities = new Set<BuildDiagnostic['severity']>(['info', 'warning', 'error']);
function requireStrings(
  value: Record<string, unknown>,
  fields: readonly string[]
): { field: string } | undefined {
  return fields.map((field) => ({ field })).find(({ field }) => !text(value[field]));
}
export function validateProjectRecord(value: unknown): RuntimeContractResult<ProjectRecord> {
  if (!record(value)) return invalid('Project record must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  const missing = requireStrings(value, [
    'id',
    'briefId',
    'briefDigest',
    'directionId',
    'directionDigest',
    'designPlanId',
    'designPlanDigest',
    'createdAt',
    'updatedAt'
  ]);
  if (missing) return invalid(`${missing.field} is required.`, missing.field);
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: String(value.id),
      briefId: String(value.briefId),
      briefDigest: String(value.briefDigest),
      directionId: String(value.directionId),
      directionDigest: String(value.directionDigest),
      designPlanId: String(value.designPlanId),
      designPlanDigest: String(value.designPlanDigest),
      createdAt: String(value.createdAt),
      updatedAt: String(value.updatedAt),
      ...(text(value.currentRevisionId) ? { currentRevisionId: value.currentRevisionId } : {}),
      ...(text(value.latestSuccessfulBuildId)
        ? { latestSuccessfulBuildId: value.latestSuccessfulBuildId }
        : {}),
      ...(text(value.activeOperationId) ? { activeOperationId: value.activeOperationId } : {})
    }
  };
}
export function validateRevisionRecord(value: unknown): RuntimeContractResult<RevisionRecord> {
  if (!record(value)) return invalid('Revision record must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  const missing = requireStrings(value, [
    'id',
    'projectId',
    'requestDigest',
    'generatedProjectDigest',
    'designPlanId',
    'designPlanDigest',
    'createdAt',
    'workspacePath'
  ]);
  if (missing) return invalid(`${missing.field} is required.`, missing.field);
  if (!Number.isSafeInteger(value.number) || Number(value.number) < 1)
    return invalid('Revision number must be positive.', 'number');
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: String(value.id),
      projectId: String(value.projectId),
      number: Number(value.number),
      requestDigest: String(value.requestDigest),
      generatedProjectDigest: String(value.generatedProjectDigest),
      designPlanId: String(value.designPlanId),
      designPlanDigest: String(value.designPlanDigest),
      createdAt: String(value.createdAt),
      workspacePath: String(value.workspacePath)
    }
  };
}
function validateDiagnostic(value: unknown, path: string): RuntimeContractResult<BuildDiagnostic> {
  if (!record(value)) return invalid('Build diagnostic must be an object.', path);
  const missing = requireStrings(value, ['code', 'message']);
  if (missing) return invalid(`${missing.field} is required.`, `${path}.${missing.field}`);
  const stage = [...stages].find((item) => item === value.stage),
    severity = [...severities].find((item) => item === value.severity);
  if (!stage) return invalid('Diagnostic stage is invalid.', `${path}.stage`);
  if (!severity) return invalid('Diagnostic severity is invalid.', `${path}.severity`);
  return {
    ok: true,
    value: {
      code: String(value.code),
      stage,
      severity,
      message: String(value.message),
      ...(typeof value.output === 'string' ? { output: value.output } : {})
    }
  };
}
function validateReview(value: unknown): RuntimeContractResult<ImplementationReviewRecord> {
  if (
    !record(value) ||
    !['pass', 'revision_recommended'].includes(String(value.status)) ||
    !text(value.checkedAt) ||
    !Array.isArray(value.checks)
  )
    return invalid('Implementation review is malformed.', 'review');
  const checks: ImplementationReviewRecord['checks'][number][] = [];
  for (const [index, item] of value.checks.entries()) {
    if (
      !record(item) ||
      !text(item.id) ||
      !['pass', 'fail', 'human-review'].includes(String(item.status)) ||
      !text(item.message)
    )
      return invalid('Implementation review check is malformed.', `review.checks.${index}`);
    const status = (['pass', 'fail', 'human-review'] as const).find(
      (candidate) => candidate === item.status
    )!;
    const severity =
      item.severity === undefined
        ? undefined
        : (['info', 'warning', 'error'] as const).find((candidate) => candidate === item.severity);
    if (item.severity !== undefined && !severity)
      return invalid(
        'Implementation review check severity is invalid.',
        `review.checks.${index}.severity`
      );
    if (item.evidence !== undefined && !record(item.evidence))
      return invalid(
        'Implementation review check evidence must be an object.',
        `review.checks.${index}.evidence`
      );
    checks.push({
      id: item.id,
      status,
      message: item.message,
      ...(severity ? { severity } : {}),
      ...(record(item.evidence) ? { evidence: item.evidence } : {})
    });
  }
  const status = value.status === 'pass' ? ('pass' as const) : ('revision_recommended' as const);
  return { ok: true, value: { status, checkedAt: value.checkedAt, checks } };
}
export function validateBuildRecord(value: unknown): RuntimeContractResult<BuildRecord> {
  if (!record(value)) return invalid('Build record must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  const missing = requireStrings(value, [
    'id',
    'projectId',
    'revisionId',
    'generatedProjectDigest',
    'createdAt',
    'updatedAt'
  ]);
  if (missing) return invalid(`${missing.field} is required.`, missing.field);
  const status = [...buildStatuses].find((item) => item === value.status);
  if (!status) return invalid('Build status is invalid.', 'status');
  if (!Array.isArray(value.diagnostics))
    return invalid('Build diagnostics must be an array.', 'diagnostics');
  const diagnostics: BuildDiagnostic[] = [];
  for (const [index, item] of value.diagnostics.entries()) {
    const checked = validateDiagnostic(item, `diagnostics.${index}`);
    if (!checked.ok) return checked;
    diagnostics.push(checked.value);
  }
  let review: ImplementationReviewRecord | undefined;
  if (value.review !== undefined) {
    const checked = validateReview(value.review);
    if (!checked.ok) return checked;
    review = checked.value;
  }
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: String(value.id),
      projectId: String(value.projectId),
      revisionId: String(value.revisionId),
      generatedProjectDigest: String(value.generatedProjectDigest),
      status,
      createdAt: String(value.createdAt),
      updatedAt: String(value.updatedAt),
      diagnostics,
      ...(text(value.outputPath) ? { outputPath: value.outputPath } : {}),
      ...(review ? { review } : {})
    }
  };
}
export function validateRuntimeEvent(value: unknown): RuntimeContractResult<RuntimeEvent> {
  if (!record(value)) return invalid('Runtime event must be an object.', '$');
  if (value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime contract version is unsupported.', 'contractVersion');
  if (!Number.isSafeInteger(value.id) || Number(value.id) < 1)
    return invalid('Event id must be positive.', 'id');
  const type = [...eventTypes].find((item) => item === value.type);
  if (!type) return invalid('Event type is invalid.', 'type');
  if (!text(value.occurredAt)) return invalid('Event timestamp is required.', 'occurredAt');
  if (!record(value.payload)) return invalid('Event payload must be an object.', 'payload');
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: Number(value.id),
      type,
      occurredAt: value.occurredAt,
      ...(text(value.projectId) ? { projectId: value.projectId } : {}),
      ...(text(value.operationId) ? { operationId: value.operationId } : {}),
      ...(text(value.buildId) ? { buildId: value.buildId } : {}),
      payload: value.payload
    }
  };
}
export function validateRuntimeState(value: unknown): RuntimeContractResult<RuntimeState> {
  if (!record(value) || value.contractVersion !== RUNTIME_CONTRACT_VERSION)
    return invalid('Runtime state contract version is invalid.', 'contractVersion');
  const projectValues = value.projects,
    operationValues = value.operations,
    buildValues = value.builds,
    revisionValues = value.revisions,
    eventValues = value.events;
  if (!Array.isArray(projectValues)) return invalid('projects must be an array.', 'projects');
  if (!Array.isArray(operationValues)) return invalid('operations must be an array.', 'operations');
  if (!Array.isArray(buildValues)) return invalid('builds must be an array.', 'builds');
  if (!Array.isArray(revisionValues)) return invalid('revisions must be an array.', 'revisions');
  if (!Array.isArray(eventValues)) return invalid('events must be an array.', 'events');
  const projects: ProjectRecord[] = [],
    operations: RuntimeOperation[] = [],
    builds: BuildRecord[] = [],
    revisions: RevisionRecord[] = [],
    events: RuntimeEvent[] = [];
  for (const [index, item] of projectValues.entries()) {
    const checked = validateProjectRecord(item);
    if (!checked.ok)
      return invalid(checked.error.message, `projects.${index}.${checked.error.path}`);
    projects.push(checked.value);
  }
  for (const [index, item] of operationValues.entries()) {
    const checked = validateRuntimeOperation(item);
    if (!checked.ok)
      return invalid(checked.error.message, `operations.${index}.${checked.error.path}`);
    operations.push(checked.value);
  }
  for (const [index, item] of buildValues.entries()) {
    const checked = validateBuildRecord(item);
    if (!checked.ok) return invalid(checked.error.message, `builds.${index}.${checked.error.path}`);
    builds.push(checked.value);
  }
  for (const [index, item] of revisionValues.entries()) {
    const checked = validateRevisionRecord(item);
    if (!checked.ok)
      return invalid(checked.error.message, `revisions.${index}.${checked.error.path}`);
    revisions.push(checked.value);
  }
  for (const [index, item] of eventValues.entries()) {
    const checked = validateRuntimeEvent(item);
    if (!checked.ok) return invalid(checked.error.message, `events.${index}.${checked.error.path}`);
    events.push(checked.value);
  }
  return {
    ok: true,
    value: {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      projects,
      operations,
      builds,
      revisions,
      events
    }
  };
}
