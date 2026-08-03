// Shared plumbing for the CLI adapters: locating the executable, spawning it, and
// turning its exit into a typed ProviderError. The adapters themselves are left
// with nothing but argv construction and result capture.
import { accessSync, constants } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProviderError } from '@universal/generation';
import { RuntimeFailure } from '../errors.ts';
import { runSupervisedCommand, type CommandResult } from '../process-supervisor.ts';

export type CliAdapterId = 'claude-code' | 'codex';

export interface CliRunInput {
  system: string;
  user: string;
  /** Time remaining in the whole generation budget, shared across both passes. */
  deadlineMs: number;
  signal?: AbortSignal | undefined;
}

export interface CliAdapter {
  readonly id: CliAdapterId;
  /** Absolute path, resolved once at startup so a missing CLI fails the probe. */
  readonly executable: string;
  /** Returns the raw JSON payload text the model produced. */
  run(input: CliRunInput): Promise<string>;
}

// A generated project is capped at 2 MB by validation; allow headroom for the
// CLI's own JSON envelope around it. The supervisor's 64 KB default suits build
// logs and would silently truncate a project payload into malformed JSON.
export const MAX_CLI_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * Resolves `command` against PATH, honouring PATHEXT on Windows. Node can spawn a
 * bare name, but doing the lookup here means "not installed" is discovered by the
 * startup probe with a path to point at, rather than as an ENOENT ten minutes into
 * a generation.
 */
export function resolveExecutable(command: string): string | undefined {
  if (command.includes(path.sep) || command.includes('/'))
    return executable(command) ? command : undefined;
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
      : [''];
  for (const entry of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean))
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      if (executable(candidate)) return candidate;
    }
  return undefined;
}

function executable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const AUTHENTICATION = /not logged in|logged out|please (?:run )?.{0,20}login|unauthori[sz]ed|authentication (?:failed|required)|invalid (?:api )?key|no credentials|session expired/i;
const RATE_LIMIT = /rate limit|usage limit|quota|too many requests|\b429\b|limit reached|try again later/i;

/**
 * Maps a finished command onto the seven-member ProviderFailureCode union. The
 * stderr patterns are not a stable contract with either CLI, so a miss falls back
 * to `internal` rather than guessing, and the CLI's own output always travels in
 * the message so the operator sees the real cause.
 */
export function assertCliSucceeded(id: CliAdapterId, result: CommandResult): void {
  if (result.exitCode === 0) return;
  const output = `${result.stderr}\n${result.stdout}`.trim();
  const code = AUTHENTICATION.test(output)
    ? 'authentication'
    : RATE_LIMIT.test(output)
      ? 'rate-limit'
      : 'internal';
  const hint =
    code === 'authentication'
      ? ` Run \`${id === 'codex' ? 'codex' : 'claude'}\` once interactively to sign in.`
      : '';
  throw new ProviderError(
    code,
    `${id} exited with code ${result.exitCode}.${hint}\n${output || '(no output)'}`
  );
}

/**
 * Runs the CLI in a throwaway working directory so neither tool can read or write
 * the repository, and translates the supervisor's failures into provider failures.
 */
export async function runCli(input: {
  id: CliAdapterId;
  executable: string;
  args: (workspace: string) => readonly string[] | Promise<readonly string[]>;
  stdin: string;
  deadlineMs: number;
  signal?: AbortSignal | undefined;
  read?: (workspace: string, result: CommandResult) => Promise<string> | string;
}): Promise<string> {
  if (input.deadlineMs <= 0)
    throw new ProviderError('timeout', `${input.id} ran out of the generation time budget.`);
  const workspace = await mkdtemp(path.join(os.tmpdir(), `universal-${input.id}-`));
  try {
    let result: CommandResult;
    try {
      result = await runSupervisedCommand({
        command: input.executable,
        args: await input.args(workspace),
        cwd: workspace,
        timeoutMs: input.deadlineMs,
        stdin: input.stdin,
        maxOutputBytes: MAX_CLI_OUTPUT_BYTES,
        // The supervisor sets CI=1 for build tooling. Agent CLIs treat that as a
        // non-interactive automation hint, which is not what this is.
        environment: { CI: '' },
        ...(input.signal ? { signal: input.signal } : {})
      });
    } catch (error) {
      throw asProviderError(input.id, error);
    }
    assertCliSucceeded(input.id, result);
    if (result.truncated)
      throw new ProviderError(
        'malformed-output',
        `${input.id} produced more than ${MAX_CLI_OUTPUT_BYTES} bytes and was truncated.`
      );
    return input.read ? await input.read(workspace, result) : result.stdout;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function asProviderError(id: CliAdapterId, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof RuntimeFailure) {
    if (error.detail.code === 'TIMEOUT')
      return new ProviderError('timeout', `${id} exceeded the generation time budget.`);
    if (error.detail.code === 'CANCELLED_OPERATION')
      return new ProviderError('cancelled', 'Generation was cancelled.');
    // The supervisor reports every spawn failure as INTERNAL_FAILURE. From the
    // provider's side that is the CLI being unusable, not a crash mid-generation.
    return new ProviderError('unavailable', `${id} could not be started: ${error.message}`);
  }
  return new ProviderError('internal', error instanceof Error ? error.message : String(error));
}
