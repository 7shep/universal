import {
  validatePreviewDescriptor,
  validateRuntimeState,
  type PreviewDescriptor,
  type RuntimeError
} from '@universal/runtime-contracts';
export type PreviewPhase =
  'no-selection' | 'loading' | 'building' | 'ready' | 'unavailable' | 'cancelled' | 'failed';
export interface PreviewViewState {
  phase: PreviewPhase;
  status: string;
  heading: string;
  description: string;
  descriptor?: PreviewDescriptor;
  diagnostic?: string;
  newerFailure?: RuntimeError;
}
export interface PreviewClient {
  load(projectId: string | undefined): Promise<PreviewViewState>;
}
const states: Record<Exclude<PreviewPhase, 'ready'>, PreviewViewState> = {
  'no-selection': {
    phase: 'no-selection',
    status: 'No selection',
    heading: 'Choose a generated project.',
    description:
      'Preview opens only a successful immutable build issued by the trusted local runtime.'
  },
  loading: {
    phase: 'loading',
    status: 'Loading',
    heading: 'Reading runtime state.',
    description: 'Confirming the selected project and its latest successful build.'
  },
  building: {
    phase: 'building',
    status: 'Build in progress',
    heading: 'Preparing the next immutable build.',
    description:
      'Generation, validation, installation, production build, and implementation review must complete before Preview loads it.'
  },
  unavailable: {
    phase: 'unavailable',
    status: 'Unavailable',
    heading: 'No successful preview yet.',
    description: 'The selected project does not currently have a ready build descriptor.'
  },
  cancelled: {
    phase: 'cancelled',
    status: 'Cancelled',
    heading: 'The operation was cancelled.',
    description: 'No new preview replaced the last successful build.'
  },
  failed: {
    phase: 'failed',
    status: 'Failed',
    heading: 'The latest attempt did not complete.',
    description: 'Review the structured diagnostic in Studio, then retry the operation.'
  }
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export class RuntimePreviewClient implements PreviewClient {
  private readonly origin: string;
  constructor(origin: string) {
    this.origin = origin;
  }
  private async request(path: string): Promise<unknown> {
    const response = await fetch(`${this.origin}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
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
  async load(projectId: string | undefined): Promise<PreviewViewState> {
    if (!projectId) return states['no-selection'];
    const checked = validateRuntimeState(await this.request('/api/v1/state'));
    if (!checked.ok) throw new Error(`${checked.error.path}: ${checked.error.message}`);
    const project = checked.value.projects.find((item) => item.id === projectId),
      operation = checked.value.operations
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    let descriptor: PreviewDescriptor | undefined;
    if (project?.latestSuccessfulBuildId) {
      const preview = validatePreviewDescriptor(
        await this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/preview`)
      );
      if (!preview.ok) throw new Error(`${preview.error.path}: ${preview.error.message}`);
      if (
        preview.value.projectId !== project.id ||
        preview.value.buildId !== project.latestSuccessfulBuildId ||
        preview.value.revisionId !== project.currentRevisionId
      )
        throw new Error('Runtime returned a stale or mismatched preview descriptor.');
      descriptor = preview.value;
    }
    if (descriptor)
      return {
        phase: 'ready',
        status: operation?.status === 'failed' ? 'Ready / newer attempt failed' : 'Ready',
        heading: 'Rendered implementation',
        description:
          'Serving a runtime-issued immutable production build on an isolated loopback origin.',
        descriptor,
        ...(operation?.status === 'failed' && operation.error
          ? { newerFailure: operation.error }
          : {})
      };
    if (
      operation &&
      ['queued', 'generating', 'materializing', 'installing', 'building', 'reviewing'].includes(
        operation.status
      )
    )
      return states.building;
    if (operation?.status === 'cancelled') return states.cancelled;
    if (operation?.status === 'failed' || operation?.status === 'interrupted')
      return {
        ...states.failed,
        ...(operation.error
          ? { diagnostic: `${operation.error.code}: ${operation.error.message}` }
          : {})
      };
    return states.unavailable;
  }
}
export class LocalPreviewClient implements PreviewClient {
  async load(projectId: string | undefined) {
    return projectId
      ? {
          ...states.unavailable,
          description:
            'The deterministic Preview adapter is active. Connect the trusted runtime to load an immutable build.'
        }
      : states['no-selection'];
  }
}
export const loadingPreviewState = states.loading;
