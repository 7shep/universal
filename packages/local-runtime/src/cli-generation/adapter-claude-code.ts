// Claude Code adapter. `--tools ""` disables every built-in tool, which both
// isolates the run from the filesystem and skips the agent loop entirely -- this
// call wants one block of text, not an agent session.
//
// `--output-format json` wraps the reply in a result envelope; it does NOT
// constrain the reply's shape. The schema therefore travels in the prompt, and
// the model's text arrives as a string in `.result` that still needs parsing.
import { ProviderError } from '@universal/generation';
import {
  runCli,
  type CliAdapter,
  type CliRunInput
} from './adapter-support.ts';

export const CLAUDE_CODE_COMMAND = 'claude';

export function claudeCodeArgs(input: { system: string; model?: string | undefined }): string[] {
  return [
    '--print',
    '--output-format',
    'json',
    '--tools',
    '',
    '--append-system-prompt',
    input.system,
    ...(input.model ? ['--model', input.model] : [])
  ];
}

/**
 * Pulls the model's text out of the CLI's result envelope. A `subtype` other than
 * `success` means Claude Code stopped early -- usually a hit turn limit -- which
 * is a malformed result rather than a crash, because the process still exits 0.
 */
export function unwrapClaudeEnvelope(stdout: string): string {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new ProviderError(
      'malformed-output',
      `claude-code did not return a JSON envelope.\n${stdout.slice(0, 2000)}`
    );
  }
  if (typeof envelope !== 'object' || envelope === null)
    throw new ProviderError('malformed-output', 'claude-code returned a non-object envelope.');
  const record = envelope as Record<string, unknown>;
  if (record.is_error === true || (record.subtype !== undefined && record.subtype !== 'success'))
    throw new ProviderError(
      'malformed-output',
      `claude-code reported ${String(record.subtype ?? 'an error')}: ${String(record.result ?? '')}`
    );
  if (typeof record.result !== 'string')
    throw new ProviderError('malformed-output', 'claude-code envelope carried no result text.');
  return record.result;
}

export function createClaudeCodeAdapter(options: {
  executable: string;
  model?: string | undefined;
}): CliAdapter {
  return {
    id: 'claude-code',
    executable: options.executable,
    async run(input: CliRunInput): Promise<string> {
      const stdout = await runCli({
        id: 'claude-code',
        executable: options.executable,
        args: () => claudeCodeArgs({ system: input.system, model: options.model }),
        stdin: input.user,
        deadlineMs: input.deadlineMs,
        ...(input.signal ? { signal: input.signal } : {})
      });
      return unwrapClaudeEnvelope(stdout);
    }
  };
}
