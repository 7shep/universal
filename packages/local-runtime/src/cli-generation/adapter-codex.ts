// Codex adapter. Unlike Claude Code, Codex enforces the output shape natively via
// `--output-schema`, and writes the final message to a file rather than stdout,
// which keeps the payload clear of the CLI's own progress output.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ProviderError } from '@universal/generation';
import { RAW_PROJECT_SCHEMA_TEXT } from './schema.ts';
import { runCli, type CliAdapter, type CliRunInput } from './adapter-support.ts';

export const CODEX_COMMAND = 'codex';

export function codexArgs(input: {
  workspace: string;
  schemaPath: string;
  outputPath: string;
  model?: string | undefined;
}): string[] {
  return [
    'exec',
    // Reads the prompt from stdin; a design plan is far larger than a Windows
    // command line allows.
    '-',
    '--skip-git-repo-check',
    // No session files, and no shell command may touch anything: this call is
    // pure text generation, and materialization is the runtime's job.
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--cd',
    input.workspace,
    '--output-schema',
    input.schemaPath,
    '--output-last-message',
    input.outputPath,
    ...(input.model ? ['--model', input.model] : [])
  ];
}

export function createCodexAdapter(options: {
  executable: string;
  model?: string | undefined;
}): CliAdapter {
  return {
    id: 'codex',
    executable: options.executable,
    async run(input: CliRunInput): Promise<string> {
      return await runCli({
        id: 'codex',
        executable: options.executable,
        args: async (workspace) => {
          const schemaPath = path.join(workspace, 'output-schema.json');
          await writeFile(schemaPath, RAW_PROJECT_SCHEMA_TEXT, 'utf8');
          return codexArgs({
            workspace,
            schemaPath,
            outputPath: path.join(workspace, 'final-message.json'),
            model: options.model
          });
        },
        // Codex has no system-prompt flag, so the constraints lead the prompt body.
        stdin: `${input.system}\n\n---\n\n${input.user}`,
        deadlineMs: input.deadlineMs,
        ...(input.signal ? { signal: input.signal } : {}),
        read: async (workspace, result) => {
          try {
            return await readFile(path.join(workspace, 'final-message.json'), 'utf8');
          } catch {
            // Exit code 0 with no final message means Codex finished without
            // producing an answer, which is a malformed result, not a crash.
            throw new ProviderError(
              'malformed-output',
              `codex wrote no final message.\n${`${result.stderr}\n${result.stdout}`.trim().slice(0, 2000)}`
            );
          }
        }
      });
    }
  };
}
