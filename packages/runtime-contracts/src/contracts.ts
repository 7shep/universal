export const RUNTIME_CONTRACT_VERSION = '1.0.0' as const;
export type RuntimeErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED_REQUEST'
  | 'INVALID_ORIGIN'
  | 'STALE_ARTIFACT'
  | 'GENERATION_FAILURE'
  | 'MATERIALIZATION_FAILURE'
  | 'DEPENDENCY_INSTALL_FAILURE'
  | 'BUILD_FAILURE'
  | 'PREVIEW_UNAVAILABLE'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'CANCELLED_OPERATION'
  | 'INTERRUPTED_OPERATION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INTERNAL_FAILURE';
export interface RuntimeError {
  code: RuntimeErrorCode;
  message: string;
  retryable: boolean;
  path?: string | undefined;
  diagnosticId?: string | undefined;
  /**
   * A concrete, actionable next step for the caller to take to recover from
   * this failure (e.g. an exact command to run). Optional: most runtime
   * errors are self-explanatory, but failures with a clear remediation
   * (like a missing local toolchain) should populate this.
   */
  action?: string | undefined;
}
export type RuntimeOperationKind = 'generate-build-preview';
export type RuntimeOperationStatus =
  | 'queued'
  | 'generating'
  | 'materializing'
  | 'installing'
  | 'building'
  | 'reviewing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'interrupted';
export interface RuntimeOperation {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: string;
  kind: RuntimeOperationKind;
  projectId: string;
  revisionId: string;
  requestDigest: string;
  idempotencyKey: string;
  status: RuntimeOperationStatus;
  createdAt: string;
  updatedAt: string;
  cancellable: boolean;
  buildId?: string | undefined;
  error?: RuntimeError | undefined;
}
export type RuntimeEventType =
  | 'project.updated'
  | 'operation.updated'
  | 'operation.failed'
  | 'build.updated'
  | 'build.ready'
  | 'review.updated'
  | 'runtime.shutdown';
export interface RuntimeEvent {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: number;
  type: RuntimeEventType;
  occurredAt: string;
  projectId?: string | undefined;
  operationId?: string | undefined;
  buildId?: string | undefined;
  payload: Readonly<Record<string, unknown>>;
}
export interface RevisionRecord {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: string;
  projectId: string;
  number: number;
  requestDigest: string;
  generatedProjectDigest: string;
  designPlanId: string;
  designPlanDigest: string;
  createdAt: string;
  workspacePath: string;
}
export interface ProjectRecord {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: string;
  briefId: string;
  briefDigest: string;
  directionId: string;
  directionDigest: string;
  designPlanId: string;
  designPlanDigest: string;
  currentRevisionId?: string | undefined;
  latestSuccessfulBuildId?: string | undefined;
  activeOperationId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}
export interface BuildRequest {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: string;
  projectId: string;
  revisionId: string;
  generatedProjectDigest: string;
  requestedAt: string;
}
export type BuildStatus =
  | 'queued'
  | 'installing'
  | 'building'
  | 'reviewing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'interrupted';
export interface BuildDiagnostic {
  code: string;
  stage: 'install' | 'typecheck' | 'build' | 'review' | 'preview';
  severity: 'info' | 'warning' | 'error';
  message: string;
  output?: string | undefined;
}
export interface BuildRecord {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  id: string;
  projectId: string;
  revisionId: string;
  generatedProjectDigest: string;
  status: BuildStatus;
  createdAt: string;
  updatedAt: string;
  outputPath?: string | undefined;
  diagnostics: readonly BuildDiagnostic[];
  review?: ImplementationReviewRecord | undefined;
}
export interface ImplementationReviewRecord {
  status: 'pass' | 'revision_recommended';
  checkedAt: string;
  checks: readonly {
    id: string;
    status: 'pass' | 'fail' | 'human-review';
    message: string;
    severity?: 'info' | 'warning' | 'error' | undefined;
    evidence?: Readonly<Record<string, unknown>> | undefined;
  }[];
}
export interface PreviewDescriptor {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  projectId: string;
  revisionId: string;
  buildId: string;
  url: string;
  origin: string;
  issuedAt: string;
  csp: string;
}
export interface RuntimeState {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  projects: readonly ProjectRecord[];
  operations: readonly RuntimeOperation[];
  builds: readonly BuildRecord[];
  revisions: readonly RevisionRecord[];
  events: readonly RuntimeEvent[];
}
export interface GenerateOperationAccepted {
  operation: RuntimeOperation;
  replayed: boolean;
}
