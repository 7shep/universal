import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RUNTIME_CONTRACT_VERSION,
  validateRuntimeState,
  type BuildRecord,
  type ProjectRecord,
  type RevisionRecord,
  type RuntimeEvent,
  type RuntimeEventType,
  type RuntimeOperation,
  type RuntimeState
} from '@universal/runtime-contracts';

interface PersistedState extends RuntimeState {
  nextEventId: number;
}
const empty = (): PersistedState => ({
  contractVersion: RUNTIME_CONTRACT_VERSION,
  projects: [],
  operations: [],
  builds: [],
  revisions: [],
  events: [],
  nextEventId: 1
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function parsePersistedState(value: unknown): PersistedState {
  const checked = validateRuntimeState(value);
  if (!checked.ok)
    throw new Error(
      `Invalid persisted runtime state at ${checked.error.path}: ${checked.error.message}`
    );
  if (!isRecord(value)) throw new Error('Invalid persisted runtime state: expected an object.');
  if (!Number.isSafeInteger(value.nextEventId) || Number(value.nextEventId) < 1)
    throw new Error('Invalid persisted runtime state at nextEventId: expected a positive integer.');
  return { ...checked.value, nextEventId: Number(value.nextEventId) };
}
export class RuntimeRecordStore {
  private readonly statePath: string;
  private state: PersistedState = empty();
  constructor(workspaceRoot: string) {
    this.statePath = path.join(workspaceRoot, 'runtime-state.json');
  }
  async load(now: string): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.statePath, 'utf8'));
      this.state = parsePersistedState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    let changed = false;
    this.state = {
      ...this.state,
      operations: this.state.operations.map((item) =>
        item.cancellable && !['ready', 'failed', 'cancelled', 'interrupted'].includes(item.status)
          ? ((changed = true),
            {
              ...item,
              status: 'interrupted' as const,
              cancellable: false,
              updatedAt: now,
              error: {
                code: 'INTERRUPTED_OPERATION' as const,
                message: 'Runtime restarted while the operation was active.',
                retryable: true
              }
            })
          : item
      ),
      builds: this.state.builds.map((item) =>
        !['ready', 'failed', 'cancelled', 'interrupted'].includes(item.status)
          ? ((changed = true),
            {
              ...item,
              status: 'interrupted' as const,
              updatedAt: now,
              diagnostics: [
                ...item.diagnostics,
                {
                  code: 'INTERRUPTED_OPERATION',
                  stage: 'build' as const,
                  severity: 'error' as const,
                  message: 'Runtime restarted before the build completed.'
                }
              ]
            })
          : item
      )
    };
    if (changed) await this.persist();
  }
  snapshot(): RuntimeState {
    return {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      projects: this.state.projects,
      operations: this.state.operations,
      builds: this.state.builds,
      revisions: this.state.revisions,
      events: this.state.events
    };
  }
  revisions(): readonly RevisionRecord[] {
    return this.state.revisions;
  }
  operation(id: string): RuntimeOperation | undefined {
    return this.state.operations.find((item) => item.id === id);
  }
  build(id: string): BuildRecord | undefined {
    return this.state.builds.find((item) => item.id === id);
  }
  project(id: string): ProjectRecord | undefined {
    return this.state.projects.find((item) => item.id === id);
  }
  operationByKey(key: string): RuntimeOperation | undefined {
    return this.state.operations.find((item) => item.idempotencyKey === key);
  }
  async putOperation(value: RuntimeOperation): Promise<void> {
    this.state = {
      ...this.state,
      operations: [...this.state.operations.filter((item) => item.id !== value.id), value]
    };
    await this.persist();
  }
  async putBuild(value: BuildRecord): Promise<void> {
    this.state = {
      ...this.state,
      builds: [...this.state.builds.filter((item) => item.id !== value.id), value]
    };
    await this.persist();
  }
  async putProject(value: ProjectRecord): Promise<void> {
    this.state = {
      ...this.state,
      projects: [...this.state.projects.filter((item) => item.id !== value.id), value]
    };
    await this.persist();
  }
  async putRevision(value: RevisionRecord): Promise<void> {
    this.state = {
      ...this.state,
      revisions: [...this.state.revisions.filter((item) => item.id !== value.id), value]
    };
    await this.persist();
  }
  async event(
    type: RuntimeEventType,
    occurredAt: string,
    input: {
      projectId?: string;
      operationId?: string;
      buildId?: string;
      payload?: Readonly<Record<string, unknown>>;
    } = {}
  ): Promise<RuntimeEvent> {
    const event: RuntimeEvent = {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      id: this.state.nextEventId,
      type,
      occurredAt,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.operationId ? { operationId: input.operationId } : {}),
      ...(input.buildId ? { buildId: input.buildId } : {}),
      payload: input.payload ?? {}
    };
    this.state = {
      ...this.state,
      nextEventId: this.state.nextEventId + 1,
      events: [...this.state.events.slice(-999), event]
    };
    await this.persist();
    return event;
  }
  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const temporary = `${this.statePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    await rename(temporary, this.statePath);
  }
}
