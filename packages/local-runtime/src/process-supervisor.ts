import { spawn, type ChildProcess } from 'node:child_process';
import { open, stat, unlink, type FileHandle } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { redactSecrets } from '@universal/generation';
import type { BuildDiagnostic, RuntimeErrorCode } from '@universal/runtime-contracts';
import { RuntimeFailure } from './errors.ts';

const MAX_OUTPUT = 64 * 1024;
const installLockPath = path.join(os.tmpdir(), 'universal-pnpm-install.lock');
const PROCESS_EXIT_GRACE_MS = 250;
const TASKKILL_TIMEOUT_MS = 5_000;
const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function acquireInstallLock(
  signal: AbortSignal | undefined,
  timeoutMs: number
): Promise<() => Promise<void>> {
  const deadline = Date.now() + timeoutMs;
  let handle: FileHandle | undefined;
  while (!handle) {
    if (signal?.aborted)
      throw new RuntimeFailure('CANCELLED_OPERATION', 'Operation was cancelled.');
    try {
      handle = await open(installLockPath, 'wx');
      await handle.writeFile(`${process.pid}\n`, 'utf8');
      await handle.sync();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const lock = await stat(installLockPath);
        if (Date.now() - lock.mtimeMs > 10 * 60_000) await unlink(installLockPath);
      } catch (inspectionError) {
        if ((inspectionError as NodeJS.ErrnoException).code !== 'ENOENT') throw inspectionError;
      }
      if (Date.now() >= deadline)
        throw new RuntimeFailure(
          'TIMEOUT',
          'Timed out waiting for the locked dependency installer.',
          { retryable: true }
        );
      await delay(50);
    }
  }
  return async () => {
    await handle?.close();
    try {
      await unlink(installLockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
}

export class BuildPipelineFailure extends RuntimeFailure {
  readonly diagnostics: readonly BuildDiagnostic[];
  constructor(code: RuntimeErrorCode, message: string, diagnostics: readonly BuildDiagnostic[]) {
    super(code, message, { retryable: true });
    this.name = 'BuildPipelineFailure';
    this.diagnostics = diagnostics;
  }
}
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}
function commandOutput(result: CommandResult): string {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return redactSecrets(result.truncated ? `${output}\n[output truncated]` : output);
}
function appendBounded(
  current: string,
  chunk: Buffer,
  limit = MAX_OUTPUT
): { value: string; truncated: boolean } {
  if (Buffer.byteLength(current) >= limit) return { value: current, truncated: true };
  const next = current + chunk.toString('utf8'),
    bytes = Buffer.from(next);
  return bytes.byteLength <= limit
    ? { value: next, truncated: false }
    : { value: bytes.subarray(0, limit).toString('utf8'), truncated: true };
}
async function killTree(child: ChildProcess): Promise<void> {
  if (!child.pid || hasExited(child)) return;
  if (process.platform === 'win32') {
    // Windows does not expose POSIX process groups. taskkill /T keeps the target
    // tree intact while requesting graceful termination; /F is the escalation.
    await terminateWithTaskkill(child.pid, false);
    await waitForChildExit(child, PROCESS_EXIT_GRACE_MS);
    if (hasExited(child)) return;
    await terminateWithTaskkill(child.pid, true);
    await waitForChildExit(child, PROCESS_EXIT_GRACE_MS);
    if (hasExited(child)) return;
  } else {
    sendProcessGroupSignal(child, 'SIGTERM');
    await waitForChildExit(child, PROCESS_EXIT_GRACE_MS);
    if (hasExited(child)) return;
    sendProcessGroupSignal(child, 'SIGKILL');
    await waitForChildExit(child, PROCESS_EXIT_GRACE_MS);
    if (hasExited(child)) return;
  }
  throw new RuntimeFailure(
    'INTERNAL_FAILURE',
    'Unable to confirm termination of the supervised command process tree.',
    { retryable: true }
  );
}
export async function runSupervisedCommand(input: {
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  environment?: Readonly<Record<string, string>>;
}): Promise<CommandResult> {
  if (input.signal?.aborted)
    throw new RuntimeFailure('CANCELLED_OPERATION', 'Operation was cancelled.');
  return await new Promise<CommandResult>((resolve, reject) => {
    let stdout = '',
      stderr = '',
      truncated = false,
      settled = false,
      terminating = false;
    const userHome = os.homedir();
    const safeEnvironment: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      USERPROFILE: process.env.USERPROFILE ?? userHome,
      HOME: process.env.HOME ?? userHome,
      LOCALAPPDATA:
        process.env.LOCALAPPDATA ??
        (process.platform === 'win32' ? path.join(userHome, 'AppData', 'Local') : undefined),
      APPDATA:
        process.env.APPDATA ??
        (process.platform === 'win32' ? path.join(userHome, 'AppData', 'Roaming') : undefined),
      PNPM_HOME: process.env.PNPM_HOME,
      COREPACK_HOME: process.env.COREPACK_HOME,
      CI: '1',
      NO_COLOR: '1',
      ...input.environment
    };
    let child: ChildProcess;
    try {
      child = spawn(input.command, [...input.args], {
        cwd: input.cwd,
        env: safeEnvironment,
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch {
      reject(
        new RuntimeFailure('INTERNAL_FAILURE', 'Unable to start the supervised command.', {
          retryable: true
        })
      );
      return;
    }
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
      child.stdout?.removeListener('data', onStdout);
      child.stderr?.removeListener('data', onStderr);
      child.removeListener('error', onChildError);
      child.removeListener('exit', onChildExit);
      child.removeListener('close', onChildClose);
    };
    const settle = (outcome: { result: CommandResult } | { error: unknown }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if ('result' in outcome) resolve(outcome.result);
      else reject(outcome.error);
    };
    const finishError = async (error: RuntimeFailure) => {
      if (settled || terminating) return;
      terminating = true;
      // Stop further terminal events before awaiting termination; the selected
      // cancellation, timeout, or spawn-failure failure remains authoritative.
      cleanup();
      try {
        await killTree(child);
        settle({ error });
      } catch (terminationError) {
        settle({
          error:
            terminationError instanceof RuntimeFailure
              ? terminationError
              : new RuntimeFailure(
                  'INTERNAL_FAILURE',
                  'Unable to terminate the supervised command process tree.',
                  { retryable: true }
                )
        });
      }
    };
    const onStdout = (chunk: Buffer) => {
      const next = appendBounded(stdout, chunk);
      stdout = next.value;
      truncated ||= next.truncated;
    };
    const onStderr = (chunk: Buffer) => {
      const next = appendBounded(stderr, chunk);
      stderr = next.value;
      truncated ||= next.truncated;
    };
    const onChildError = () => {
      void finishError(
        new RuntimeFailure('INTERNAL_FAILURE', 'Unable to start the supervised command.', {
          retryable: true
        })
      );
    };
    // Normal success waits for close so all buffered stdout/stderr chunks have
    // been collected. The exit listener remains available to the terminator.
    const onChildExit = () => {};
    const onChildClose = (code: number | null) =>
      settle({ result: { exitCode: code ?? -1, stdout, stderr, truncated } });
    const abort = () => {
      void finishError(new RuntimeFailure('CANCELLED_OPERATION', 'Operation was cancelled.'));
    };
    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
    child.once('error', onChildError);
    child.once('exit', onChildExit);
    child.once('close', onChildClose);
    const timer = setTimeout(() => {
      void finishError(
        new RuntimeFailure('TIMEOUT', `Command exceeded ${input.timeoutMs} ms.`, {
          retryable: true
        })
      );
    }, input.timeoutMs);
    input.signal?.addEventListener('abort', abort, { once: true });
    if (input.signal?.aborted) abort();
  });
}
async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
async function pnpmInvocation(
  args: readonly string[]
): Promise<{ command: string; args: readonly string[] }> {
  const pathCandidates = (process.env.PATH ?? '')
    .split(path.delimiter)
    .flatMap((entry) => [
      path.join(entry, 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(entry, 'pnpm.cjs')
    ]);
  const candidates = [
    process.env.npm_execpath,
    process.env.PNPM_HOME ? path.join(process.env.PNPM_HOME, 'pnpm.cjs') : undefined,
    ...pathCandidates
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates)
    if (/pnpm\.(?:mjs|c?js)$/i.test(candidate) && (await exists(candidate)))
      return { command: process.execPath, args: [candidate, ...args] };
  if (process.platform === 'win32')
    throw new RuntimeFailure(
      'DEPENDENCY_INSTALL_FAILURE',
      'Could not resolve a shell-free pnpm JavaScript entrypoint.'
    );
  return { command: 'pnpm', args };
}
export async function installAndBuild(input: {
  root: string;
  signal?: AbortSignal;
  installTimeoutMs?: number;
  buildTimeoutMs?: number;
}): Promise<{ outputPath: string; diagnostics: readonly BuildDiagnostic[] }> {
  const diagnostics: BuildDiagnostic[] = [];
  const install = await pnpmInvocation([
    'install',
    '--offline',
    '--frozen-lockfile',
    '--ignore-scripts'
  ]);
  const installTimeoutMs = input.installTimeoutMs ?? 120_000;
  const releaseInstallLock = await acquireInstallLock(input.signal, installTimeoutMs);
  let result: CommandResult;
  try {
    result = await runSupervisedCommand({
      ...install,
      cwd: input.root,
      timeoutMs: installTimeoutMs,
      ...(input.signal ? { signal: input.signal } : {})
    });
  } finally {
    await releaseInstallLock();
  }
  diagnostics.push({
    code: result.exitCode === 0 ? 'INSTALL_READY' : 'INSTALL_FAILED',
    stage: 'install',
    severity: result.exitCode === 0 ? 'info' : 'error',
    message:
      result.exitCode === 0
        ? 'Dependencies installed from the locked offline template.'
        : 'Locked dependency installation failed.',
    output: commandOutput(result)
  });
  if (result.exitCode !== 0)
    throw new BuildPipelineFailure(
      'DEPENDENCY_INSTALL_FAILURE',
      'Locked dependency installation failed.',
      diagnostics
    );
  const build = await pnpmInvocation(['run', 'build']);
  result = await runSupervisedCommand({
    ...build,
    cwd: input.root,
    timeoutMs: input.buildTimeoutMs ?? 120_000,
    ...(input.signal ? { signal: input.signal } : {})
  });
  diagnostics.push({
    code: result.exitCode === 0 ? 'BUILD_READY' : 'BUILD_FAILED',
    stage: 'build',
    severity: result.exitCode === 0 ? 'info' : 'error',
    message: result.exitCode === 0 ? 'Production build completed.' : 'Production build failed.',
    output: commandOutput(result)
  });
  if (result.exitCode !== 0)
    throw new BuildPipelineFailure('BUILD_FAILURE', 'Production build failed.', diagnostics);
  const outputPath = path.join(input.root, 'dist');
  if (!(await stat(outputPath)).isDirectory())
    throw new RuntimeFailure('BUILD_FAILURE', 'Build completed without a dist directory.');
  return { outputPath, diagnostics };
}
function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (hasExited(child)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      if (timer) clearTimeout(timer);
      child.removeListener('exit', finish);
      child.removeListener('close', finish);
      child.removeListener('error', finish);
      resolve();
    };
    child.once('exit', finish);
    child.once('close', finish);
    child.once('error', finish);
    // An exit can happen between the state check above and listener registration.
    const timer = hasExited(child) ? undefined : setTimeout(finish, timeoutMs);
    if (hasExited(child)) finish();
  });
}
function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}
function sendProcessGroupSignal(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid || hasExited(child)) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    sendChildSignal(child, signal);
  }
}
function sendChildSignal(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the state check and the signal.
  }
}
async function terminateWithTaskkill(pid: number, force: boolean): Promise<void> {
  await new Promise<void>((resolve) => {
    let finished = false;
    let killer: ChildProcess;
    try {
      killer = spawn('taskkill.exe', ['/pid', String(pid), '/T', ...(force ? ['/F'] : [])], {
        stdio: 'ignore',
        windowsHide: true,
        shell: false
      });
    } catch {
      resolve();
      return;
    }
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      killer.removeListener('close', finish);
      killer.removeListener('exit', finish);
      killer.removeListener('error', finish);
      resolve();
    };
    const timeout = () => {
      try {
        killer.kill();
      } catch {
        // The terminator may have exited while the timeout fired.
      }
      finish();
    };
    killer.once('close', finish);
    killer.once('exit', finish);
    killer.once('error', finish);
    const timer = setTimeout(timeout, TASKKILL_TIMEOUT_MS);
  });
}
