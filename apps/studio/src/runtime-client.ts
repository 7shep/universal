import { createProjectGenerationRequest } from '@universal/generation/browser';
import {
  validatePreviewDescriptor,
  validateRuntimeState,
  type PreviewDescriptor,
  type RuntimeError,
  type RuntimeOperationStatus,
  type RuntimeState
} from '@universal/runtime-contracts';
import type { StudioProject } from './studio-client';
export type GenerationStatus = 'idle' | RuntimeOperationStatus;
export interface GenerationSnapshot {
  status: GenerationStatus;
  operationId?: string;
  buildId?: string;
  cancellable: boolean;
  retryable: boolean;
  diagnostics: readonly string[];
  currentPreview?: PreviewDescriptor;
  newerFailure?: RuntimeError;
}
export interface GenerationLifecycleClient {
  load(project: StudioProject): Promise<GenerationSnapshot>;
  start(project: StudioProject): Promise<GenerationSnapshot>;
  cancel(project: StudioProject, operationId: string): Promise<GenerationSnapshot>;
}
const idle = (): GenerationSnapshot => ({
  status: 'idle',
  cancellable: false,
  retryable: false,
  diagnostics: []
});
export class LocalGenerationLifecycleClient implements GenerationLifecycleClient {
  private readonly snapshots = new Map<string, GenerationSnapshot>();
  async load(project: StudioProject) {
    return this.snapshots.get(project.id) ?? idle();
  }
  async start(project: StudioProject) {
    const operationId = `local:${project.id}:1`;
    const current: GenerationSnapshot = {
      status: 'generating',
      operationId,
      cancellable: true,
      retryable: false,
      diagnostics: ['Deterministic UI adapter is generating a local fixture.']
    };
    this.snapshots.set(project.id, current);
    window.setTimeout(
      () =>
        this.snapshots.set(project.id, {
          status: 'ready',
          operationId,
          buildId: `local-build:${project.id}`,
          cancellable: false,
          retryable: false,
          diagnostics: [
            'Fixture generation and build completed. Connect the trusted runtime to open an isolated preview.'
          ]
        }),
      450
    );
    return current;
  }
  async cancel(project: StudioProject, operationId: string) {
    const next: GenerationSnapshot = {
      status: 'cancelled',
      operationId,
      cancellable: false,
      retryable: true,
      diagnostics: ['Fixture operation cancelled.']
    };
    this.snapshots.set(project.id, next);
    return next;
  }
}
interface RuntimeConfig {
  origin: string;
  bootstrapToken?: string;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export class RuntimeGenerationLifecycleClient implements GenerationLifecycleClient {
  private readonly config: RuntimeConfig;
  private bootstrapped = false;
  private inflight: Promise<GenerationSnapshot> | undefined;
  constructor(config: RuntimeConfig) {
    this.config = config;
  }
  private async bootstrap(): Promise<void> {
    if (this.bootstrapped || !this.config.bootstrapToken) return;
    const response = await fetch(`${this.config.origin}/api/v1/bootstrap`, {
      method: 'POST',
      headers: { Authorization: `Bootstrap ${this.config.bootstrapToken}` },
      credentials: 'include'
    });
    if (!response.ok && response.status !== 401) throw new Error('Local runtime bootstrap failed.');
    this.bootstrapped = true;
  }
  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    let response = await fetch(`${this.config.origin}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
    });
    if (response.status === 401 && this.config.bootstrapToken) {
      await this.bootstrap();
      response = await fetch(`${this.config.origin}${path}`, {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
      });
    }
    const value: unknown = await response.json();
    if (!response.ok) {
      const message =
        isRecord(value) && isRecord(value.error) && typeof value.error.message === 'string'
          ? value.error.message
          : `Runtime request failed with ${response.status}.`;
      throw new Error(message);
    }
    return value;
  }
  private projectId(project: StudioProject) {
    return `project:${project.id}`;
  }
  private async state(): Promise<RuntimeState> {
    const checked = validateRuntimeState(await this.request('/api/v1/state'));
    if (!checked.ok) throw new Error(`${checked.error.path}: ${checked.error.message}`);
    return checked.value;
  }
  private async snapshot(project: StudioProject, state: RuntimeState): Promise<GenerationSnapshot> {
    const projectId = this.projectId(project),
      record = state.projects.find((item) => item.id === projectId),
      operations = state.operations
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      operation = operations[0];
    let currentPreview: PreviewDescriptor | undefined;
    if (record?.latestSuccessfulBuildId) {
      const checked = validatePreviewDescriptor(
        await this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/preview`)
      );
      if (checked.ok) currentPreview = checked.value;
    }
    if (!operation)
      return {
        ...idle(),
        ...(currentPreview ? { currentPreview, buildId: currentPreview.buildId } : {})
      };
    const build = operation.buildId
      ? state.builds.find((item) => item.id === operation.buildId)
      : undefined;
    return {
      status: operation.status,
      operationId: operation.id,
      ...(operation.buildId ? { buildId: operation.buildId } : {}),
      cancellable: operation.cancellable,
      retryable: operation.error?.retryable ?? false,
      diagnostics: [
        ...(operation.error ? [`${operation.error.code}: ${operation.error.message}`] : []),
        ...(build?.diagnostics.map((item) => `${item.code}: ${item.message}`) ?? [])
      ],
      ...(currentPreview ? { currentPreview } : {}),
      ...(operation.status === 'failed' && currentPreview && operation.error
        ? { newerFailure: operation.error }
        : {})
    };
  }
  async load(project: StudioProject) {
    return this.snapshot(project, await this.state());
  }
  async start(project: StudioProject): Promise<GenerationSnapshot> {
    if (this.inflight) return this.inflight;
    this.inflight = this.startOnce(project).finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }
  private async startOnce(project: StudioProject): Promise<GenerationSnapshot> {
    if (!project.enginePlan)
      throw new Error('Runtime generation requires the canonical approved Design Plan v2.');
    const state = await this.state(),
      projectId = this.projectId(project),
      attempt = state.operations.filter((item) => item.projectId === projectId).length + 1,
      revisionId = `revision:${project.id}:${attempt}`,
      request = createProjectGenerationRequest({
        projectId,
        revisionId,
        designPlan: project.enginePlan
      });
    await this.request('/api/v1/projects/generate', {
      method: 'POST',
      headers: {
        'Idempotency-Key': `studio:${project.id}:${project.enginePlan.digest}:${attempt}`
      },
      body: JSON.stringify(request)
    });
    return this.load(project);
  }
  async cancel(project: StudioProject, operationId: string) {
    await this.request(`/api/v1/operations/${encodeURIComponent(operationId)}/cancel`, {
      method: 'POST',
      body: '{}'
    });
    return this.load(project);
  }
}
export const createLocalGenerationLifecycleClient = (): GenerationLifecycleClient =>
  new LocalGenerationLifecycleClient();
export const createRuntimeGenerationLifecycleClient = (
  config: RuntimeConfig
): GenerationLifecycleClient => new RuntimeGenerationLifecycleClient(config);
