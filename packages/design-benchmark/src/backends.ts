import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  canonicalizeRunnerPath,
  type ArmExecutionHandle,
  type ArmExecutionRequest,
  type ArmExecutor,
  type ArmExecutorFactory,
  type BenchmarkWorkspace,
  type IsolationAttestation,
  type WorkspaceFactory
} from './runner.ts';

const noIsolation = {
  filesystem_isolation: false,
  process_isolation: false,
  network_isolation: false,
  host_isolation: false,
  tool_isolation: false
} as const;

export const UNVERIFIED_INJECTED_ISOLATION: IsolationAttestation = {
  version: '1',
  provider: 'generic-injected-provider',
  capabilities: noIsolation,
  guarantees: [
    'Dependency injection provides lifecycle structure only.',
    'No network, host, filesystem, process, or tool isolation is implied.'
  ]
};

export interface LocalFilesystemWorkspace extends BenchmarkWorkspace {
  write(relativePath: string, content: string): Promise<void>;
  read(relativePath: string): Promise<string>;
}

const within = (root: string, candidate: string): boolean => {
  const fromRoot = relative(root, candidate);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
};

/**
 * Creates real local directories beneath an explicit benchmark-owned root.
 * This guarantees distinct roots and safe materialization, but is not an OS
 * filesystem sandbox; executors may still access the host unless separately sandboxed.
 */
export async function createLocalFilesystemWorkspaceFactory(
  benchmarkOwnedRoot: string
): Promise<WorkspaceFactory<LocalFilesystemWorkspace>> {
  const ownedRoot = await realpath(resolve(benchmarkOwnedRoot));
  if (!(await lstat(ownedRoot)).isDirectory())
    throw new Error('Benchmark-owned root must be a directory.');
  const active = new Set<string>();

  const makeWorkspace = async (id: string, root: string): Promise<LocalFilesystemWorkspace> => {
    const canonicalRoot = (await realpath(root)).replaceAll('\\', '/');
    const safeTarget = async (relativePath: string, createParent: boolean): Promise<string> => {
      const canonical = canonicalizeRunnerPath(relativePath);
      const target = resolve(root, ...canonical.split('/'));
      if (!within(root, target))
        throw new Error(`Workspace path escapes its root: ${relativePath}`);
      const parent = dirname(target);
      if (createParent) await mkdir(parent, { recursive: true });
      const realParent = await realpath(parent);
      if (!within(root, realParent))
        throw new Error(`Workspace parent escapes through a link: ${relativePath}`);
      return target;
    };
    return {
      id,
      canonicalRoot,
      backendId: `local-fs:${canonicalRoot}`,
      async write(relativePath, content) {
        const target = await safeTarget(relativePath, true);
        try {
          if ((await lstat(target)).isSymbolicLink())
            throw new Error(`Workspace target cannot be a symlink: ${relativePath}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await writeFile(target, content, 'utf8');
      },
      async read(relativePath) {
        const target = await safeTarget(relativePath, false);
        const metadata = await lstat(target);
        if (!metadata.isFile() || metadata.isSymbolicLink())
          throw new Error(`Workspace target must be a regular non-symlink file: ${relativePath}`);
        const realTarget = await realpath(target);
        if (!within(root, realTarget))
          throw new Error(`Workspace target escapes through a link: ${relativePath}`);
        return readFile(realTarget, 'utf8');
      }
    };
  };

  return {
    isolation: {
      version: '1',
      provider: 'local-filesystem-workspace-v1',
      capabilities: noIsolation,
      guarantees: [
        'Uses mkdtemp beneath one explicit benchmark-owned realpath.',
        'Creates distinct roots and rejects path traversal and symlink escapes during capability I/O.',
        'Does not confine arbitrary executor filesystem access outside the workspace.'
      ]
    },
    async create({ id, files }) {
      const prefix = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'arm';
      const root = await mkdtemp(join(ownedRoot, `${prefix}-`));
      const realRoot = await realpath(root);
      if (!within(ownedRoot, realRoot))
        throw new Error('Created workspace escaped benchmark-owned root.');
      active.add(realRoot);
      const workspace = await makeWorkspace(id, realRoot);
      for (const file of files) await workspace.write(file.path, file.content);
      return workspace;
    },
    async release(workspace) {
      const root = await realpath(workspace.canonicalRoot);
      if (!active.has(root) || !within(ownedRoot, root))
        throw new Error('Refusing to release a workspace not owned by this factory.');
      active.delete(root);
      await rm(root, { recursive: true, force: true });
    },
    async quarantine(workspace, reason) {
      const root = await realpath(workspace.canonicalRoot);
      if (!active.has(root) || !within(ownedRoot, root))
        throw new Error('Refusing to quarantine a workspace not owned by this factory.');
      await workspace.write(
        '.benchmark-quarantine.json',
        `${JSON.stringify({ version: 1, workspaceId: workspace.id, reason }, null, 2)}\n`
      );
      active.delete(root);
    }
  };
}

export interface ChildProcessExecutorOptions {
  readonly command: string;
  readonly args?: readonly string[];
  /** Exact child environment. Parent environment variables are not inherited. */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Terminable shell-free child process backend. It joins on the child `close`
 * event and parses `{ "tokenUsage": number }` from the final stdout line.
 * It does not provide network, host, filesystem, or tool sandboxing.
 */
export function createChildProcessExecutorFactory<Workspace extends BenchmarkWorkspace>(
  options: ChildProcessExecutorOptions
): ArmExecutorFactory<Workspace> {
  if (!isAbsolute(options.command)) throw new Error('Child executor command must be absolute.');
  return {
    isolation: {
      version: '1',
      provider: 'terminable-child-process-v1',
      capabilities: { ...noIsolation, process_isolation: true },
      guarantees: [
        'Spawns with shell:false, an exact sanitized environment, and workspace cwd.',
        'terminate() kills the child and join() settles only on the close event.',
        'Does not block child network or host filesystem access.'
      ]
    },
    async create(): Promise<ArmExecutor<Workspace>> {
      let child: ReturnType<typeof spawn> | undefined;
      let joined: Promise<{ tokenUsage: number }> | undefined;
      return {
        async start(request: ArmExecutionRequest<Workspace>): Promise<ArmExecutionHandle> {
          if (child) throw new Error('Child executor instances are single-use.');
          let stdout = '';
          let stderr = '';
          child = spawn(options.command, [...(options.args ?? [])], {
            cwd: request.workspace.canonicalRoot,
            env: { ...(options.env ?? {}) },
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          child.stdout?.setEncoding('utf8');
          child.stderr?.setEncoding('utf8');
          child.stdout?.on('data', (chunk: string) => {
            stdout += chunk;
          });
          child.stderr?.on('data', (chunk: string) => {
            stderr += chunk;
          });
          joined = new Promise((resolveJoin, rejectJoin) => {
            child!.once('error', rejectJoin);
            child!.once('close', (code, signal) => {
              if (code !== 0) {
                rejectJoin(
                  new Error(
                    `Child executor failed (code=${String(code)}, signal=${String(signal)}): ${stderr.trim()}`
                  )
                );
                return;
              }
              const finalLine = stdout.trim().split(/\r?\n/).at(-1);
              try {
                const parsed = JSON.parse(finalLine ?? '') as { tokenUsage?: unknown };
                if (!Number.isInteger(parsed.tokenUsage) || Number(parsed.tokenUsage) < 0)
                  throw new Error('tokenUsage must be a non-negative integer.');
                resolveJoin({ tokenUsage: Number(parsed.tokenUsage) });
              } catch (error) {
                rejectJoin(
                  new Error(`Child executor returned invalid outcome: ${(error as Error).message}`)
                );
              }
            });
          });
          child.stdin?.end(
            JSON.stringify({
              version: 1,
              arm: request.arm,
              briefBytes: request.briefBytes,
              instructions: request.instructions,
              availableTools: request.availableTools,
              budget: request.budget
            })
          );
          return {
            join: () => joined!,
            async terminate() {
              if (child && child.exitCode === null && child.signalCode === null) child.kill();
            }
          };
        },
        async finalize() {
          if (child && child.exitCode === null && child.signalCode === null)
            throw new Error('Cannot finalize a child executor before it has closed.');
          if (joined) await joined.catch(() => undefined);
        }
      };
    }
  };
}
