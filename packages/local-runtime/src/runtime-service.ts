import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import type { ProjectGenerationRequest, ReactGenerator } from '@universal/generation';
import { digestValue, validateProjectGenerationRequest } from '@universal/generation';
import {
  RUNTIME_CONTRACT_VERSION,
  type BuildRecord,
  type GenerateOperationAccepted,
  type PreviewDescriptor,
  type ProjectRecord,
  type RevisionRecord,
  type RuntimeOperation,
  type RuntimeState
} from '@universal/runtime-contracts';
import { RuntimeFailure, runtimeError } from './errors.ts';
import { BuildPipelineFailure, installAndBuild } from './process-supervisor.ts';
import { startPreviewServer, type PreviewServer } from './preview-server.ts';
import { RuntimeRecordStore } from './record-store.ts';
import { reviewGeneratedImplementation } from './review.ts';
import { materializeProject } from './workspace.ts';

export interface RuntimeServiceOptions {
  workspaceRoot: string;
  repositoryRoot: string;
  generator: ReactGenerator;
  now?: () => string;
  createId?: () => string;
}
export class RuntimeService {
  private readonly workspaceRoot: string;
  private readonly repositoryRoot: string;
  private readonly generator: ReactGenerator;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly store: RuntimeRecordStore;
  private readonly controllers = new Map<string, AbortController>();
  private readonly tasks = new Map<string, Promise<void>>();
  private readonly previews = new Map<string, PreviewServer>();
  private accepting = false;
  constructor(options: RuntimeServiceOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.repositoryRoot = options.repositoryRoot;
    this.generator = options.generator;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? randomUUID;
    this.store = new RuntimeRecordStore(options.workspaceRoot);
  }
  async initialize(): Promise<void> {
    await this.store.load(this.now());
    for (const build of this.store
      .snapshot()
      .builds.filter((item) => item.status === 'ready' && item.outputPath)) {
      try {
        if (!(await stat(build.outputPath!)).isDirectory()) continue;
        const server = await startPreviewServer({
          outputPath: build.outputPath!,
          projectId: build.projectId,
          revisionId: build.revisionId,
          buildId: build.id,
          now: this.now()
        });
        this.previews.set(build.id, server);
      } catch {
        /* persisted records remain queryable; descriptor reports unavailable */
      }
    }
    this.accepting = true;
  }
  state(): RuntimeState {
    return this.store.snapshot();
  }
  operation(id: string): RuntimeOperation | undefined {
    return this.store.operation(id);
  }
  preview(projectId: string): PreviewDescriptor {
    const project = this.store.project(projectId);
    if (!project?.latestSuccessfulBuildId)
      throw new RuntimeFailure(
        'PREVIEW_UNAVAILABLE',
        'No successful build is available for this project.'
      );
    const server = this.previews.get(project.latestSuccessfulBuildId);
    if (!server)
      throw new RuntimeFailure(
        'PREVIEW_UNAVAILABLE',
        'The latest successful preview is not currently available.',
        { retryable: true }
      );
    return server.descriptor;
  }
  async startGeneration(
    value: unknown,
    idempotencyKey: string
  ): Promise<GenerateOperationAccepted> {
    if (!this.accepting)
      throw new RuntimeFailure('INTERNAL_FAILURE', 'Runtime is not accepting commands.', {
        retryable: true
      });
    if (!idempotencyKey.trim())
      throw new RuntimeFailure('INVALID_REQUEST', 'Idempotency-Key is required.', {
        path: 'Idempotency-Key'
      });
    const checked = validateProjectGenerationRequest(value);
    if (!checked.ok)
      throw new RuntimeFailure(
        checked.error.code === 'stale_artifact' ? 'STALE_ARTIFACT' : 'INVALID_REQUEST',
        checked.error.message,
        { path: checked.error.path }
      );
    const request = checked.value,
      requestDigest = digestValue(request),
      replay = this.store.operationByKey(idempotencyKey);
    if (replay) {
      if (replay.requestDigest !== requestDigest)
        throw new RuntimeFailure(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a different request.'
        );
      return { operation: replay, replayed: true };
    }
    const existing = this.store.project(request.projectId);
    if (
      existing &&
      (existing.briefDigest !== request.brief.digest ||
        existing.directionDigest !== request.direction.digest ||
        existing.designPlanDigest !== request.plan.digest)
    )
      throw new RuntimeFailure(
        'STALE_ARTIFACT',
        'Project id is already bound to different approved creative artifacts.'
      );
    const now = this.now(),
      operationId = `operation:${this.createId()}`;
    const operation: RuntimeOperation = {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: operationId,
      kind: 'generate-build-preview',
      projectId: request.projectId,
      revisionId: request.revisionId,
      requestDigest,
      idempotencyKey,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      cancellable: true
    };
    const project: ProjectRecord = existing ?? {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: request.projectId,
      briefId: request.brief.id,
      briefDigest: request.brief.digest,
      directionId: request.direction.id,
      directionDigest: request.direction.digest,
      designPlanId: request.plan.id,
      designPlanDigest: request.plan.digest,
      createdAt: now,
      updatedAt: now
    };
    await this.store.putProject({ ...project, activeOperationId: operationId, updatedAt: now });
    await this.store.putOperation(operation);
    await this.store.event('operation.updated', now, {
      projectId: request.projectId,
      operationId,
      payload: { status: 'queued' }
    });
    const controller = new AbortController();
    this.controllers.set(operationId, controller);
    const task = this.run(operation, request, controller.signal).finally(() => {
      this.controllers.delete(operationId);
      this.tasks.delete(operationId);
    });
    this.tasks.set(operationId, task);
    return { operation, replayed: false };
  }
  async waitForOperation(id: string): Promise<RuntimeOperation> {
    const task = this.tasks.get(id);
    if (task) await task;
    const operation = this.store.operation(id);
    if (!operation) throw new RuntimeFailure('INVALID_REQUEST', 'Operation does not exist.');
    return operation;
  }
  async cancel(id: string): Promise<RuntimeOperation> {
    const operation = this.store.operation(id);
    if (!operation) throw new RuntimeFailure('INVALID_REQUEST', 'Operation does not exist.');
    if (!operation.cancellable) return operation;
    this.controllers.get(id)?.abort(new Error('Cancelled by user.'));
    const task = this.tasks.get(id);
    if (task) await task;
    return this.store.operation(id)!;
  }
  private async transition(
    operation: RuntimeOperation,
    status: RuntimeOperation['status'],
    input: { buildId?: string; error?: RuntimeOperation['error'] } = {}
  ): Promise<RuntimeOperation> {
    const next: RuntimeOperation = {
      ...operation,
      status,
      updatedAt: this.now(),
      cancellable: !['ready', 'failed', 'cancelled', 'interrupted'].includes(status),
      ...(input.buildId ? { buildId: input.buildId } : {}),
      ...(input.error ? { error: input.error } : {})
    };
    await this.store.putOperation(next);
    await this.store.event(
      status === 'failed' ? 'operation.failed' : 'operation.updated',
      next.updatedAt,
      {
        projectId: next.projectId,
        operationId: next.id,
        ...(input.buildId ? { buildId: input.buildId } : {}),
        payload: { status, ...(input.error ? { code: input.error.code } : {}) }
      }
    );
    return next;
  }
  private async run(
    initial: RuntimeOperation,
    request: ProjectGenerationRequest,
    signal: AbortSignal
  ): Promise<void> {
    let operation = initial,
      build: BuildRecord | undefined;
    try {
      operation = await this.transition(operation, 'generating');
      const generated = await this.generator.generate(request, signal);
      if (!generated.ok)
        throw new RuntimeFailure(
          generated.failure.code === 'cancelled' ? 'CANCELLED_OPERATION' : 'GENERATION_FAILURE',
          generated.failure.message,
          { retryable: generated.failure.retryable }
        );
      operation = await this.transition(operation, 'materializing');
      const materialized = await materializeProject({
        workspaceRoot: this.workspaceRoot,
        repositoryRoot: this.repositoryRoot,
        project: generated.project
      });
      const now = this.now(),
        revisionNumber =
          this.store.revisions().filter((item) => item.projectId === request.projectId).length + 1;
      const revision: RevisionRecord = {
        contractVersion: RUNTIME_CONTRACT_VERSION,
        id: request.revisionId,
        projectId: request.projectId,
        number: revisionNumber,
        requestDigest: generated.project.requestDigest,
        generatedProjectDigest: materialized.manifestDigest,
        designPlanId: request.plan.id,
        designPlanDigest: request.plan.digest,
        createdAt: now,
        workspacePath: materialized.root
      };
      await this.store.putRevision(revision);
      const buildId = `build:${request.projectId}:${materialized.manifestDigest.slice(0, 16)}`;
      build = {
        contractVersion: RUNTIME_CONTRACT_VERSION,
        id: buildId,
        projectId: request.projectId,
        revisionId: request.revisionId,
        generatedProjectDigest: materialized.manifestDigest,
        status: 'installing',
        createdAt: now,
        updatedAt: now,
        diagnostics: []
      };
      await this.store.putBuild(build);
      operation = await this.transition(operation, 'installing', { buildId });
      await this.store.event('build.updated', now, {
        projectId: request.projectId,
        operationId: operation.id,
        buildId,
        payload: { status: 'installing' }
      });
      const built = await installAndBuild({ root: materialized.root, signal });
      build = {
        ...build,
        status: 'reviewing',
        updatedAt: this.now(),
        outputPath: built.outputPath,
        diagnostics: built.diagnostics
      };
      await this.store.putBuild(build);
      operation = await this.transition(operation, 'reviewing', { buildId });
      const review = reviewGeneratedImplementation(generated.project, request, this.now());
      const architectureDiagnostics = review.checks
        .filter(
          (check) =>
            check.id.startsWith('ARCH_') &&
            (check.status === 'fail' || check.severity === 'warning')
        )
        .map((check) => ({
          code: check.id,
          stage: 'review' as const,
          severity: check.status === 'fail' ? ('error' as const) : ('warning' as const),
          message: check.message,
          ...(check.evidence ? { output: JSON.stringify(check.evidence) } : {})
        }));
      build = {
        ...build,
        review,
        diagnostics: [...build.diagnostics, ...architectureDiagnostics],
        updatedAt: this.now()
      };
      await this.store.putBuild(build);
      await this.store.event('review.updated', build.updatedAt, {
        projectId: request.projectId,
        operationId: operation.id,
        buildId,
        payload: { status: review.status }
      });
      if (review.status !== 'pass')
        throw new RuntimeFailure(
          'BUILD_FAILURE',
          'Generated implementation failed deterministic implementation review.'
        );
      const server = await startPreviewServer({
        outputPath: built.outputPath,
        projectId: request.projectId,
        revisionId: request.revisionId,
        buildId,
        now: this.now()
      });
      this.previews.set(buildId, server);
      build = { ...build, status: 'ready', updatedAt: this.now() };
      await this.store.putBuild(build);
      const project = this.store.project(request.projectId)!;
      await this.store.putProject({
        ...project,
        currentRevisionId: request.revisionId,
        latestSuccessfulBuildId: buildId,
        activeOperationId: undefined,
        updatedAt: this.now()
      });
      await this.store.event('build.ready', this.now(), {
        projectId: request.projectId,
        operationId: operation.id,
        buildId,
        payload: { revisionId: request.revisionId }
      });
      await this.transition(operation, 'ready', { buildId });
    } catch (error) {
      const detail = runtimeError(
          error,
          signal.aborted ? 'CANCELLED_OPERATION' : 'INTERNAL_FAILURE'
        ),
        status = detail.code === 'CANCELLED_OPERATION' ? 'cancelled' : 'failed';
      if (build) {
        const pipelineDiagnostics = error instanceof BuildPipelineFailure ? error.diagnostics : [];
        const fallbackDiagnostic = {
          code: detail.code,
          stage: build.status === 'installing' ? ('install' as const) : ('build' as const),
          severity: 'error' as const,
          message: detail.message
        };
        build = {
          ...build,
          status: status === 'cancelled' ? 'cancelled' : 'failed',
          updatedAt: this.now(),
          diagnostics: [
            ...build.diagnostics,
            ...(pipelineDiagnostics.length > 0 ? pipelineDiagnostics : [fallbackDiagnostic])
          ]
        };
        await this.store.putBuild(build);
      }
      const project = this.store.project(request.projectId);
      if (project)
        await this.store.putProject({
          ...project,
          activeOperationId: undefined,
          updatedAt: this.now()
        });
      await this.transition(operation, status, {
        ...(build ? { buildId: build.id } : {}),
        error: detail
      });
    }
  }
  async shutdown(): Promise<void> {
    this.accepting = false;
    for (const controller of this.controllers.values())
      controller.abort(new Error('Runtime shutdown.'));
    await Promise.allSettled(this.tasks.values());
    await Promise.allSettled([...this.previews.values()].map((server) => server.close()));
    this.previews.clear();
    await this.store.event('runtime.shutdown', this.now());
  }
}
