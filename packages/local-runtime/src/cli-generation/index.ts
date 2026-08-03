import type { ReactGenerationProvider } from '@universal/generation';
import { RuntimeFailure } from '../errors.ts';
import type { LiveProviderConfiguration, LiveProviderFactory } from '../provider-config.ts';
import { resolveExecutable, type CliAdapter, type CliAdapterId } from './adapter-support.ts';
import { CLAUDE_CODE_COMMAND, createClaudeCodeAdapter } from './adapter-claude-code.ts';
import { CODEX_COMMAND, createCodexAdapter } from './adapter-codex.ts';
import { CliGenerationProvider } from './provider.ts';

export * from './adapter-support.ts';
export * from './adapter-claude-code.ts';
export * from './adapter-codex.ts';
export * from './prompt.ts';
export * from './provider.ts';
export * from './schema.ts';
export * from './self-check.ts';

const COMMANDS: Readonly<Record<CliAdapterId, string>> = {
  'claude-code': CLAUDE_CODE_COMMAND,
  codex: CODEX_COMMAND
};

export const CLI_PROVIDER_IDS = Object.keys(COMMANDS) as readonly CliAdapterId[];

export const isCliProviderId = (value: string): value is CliAdapterId =>
  Object.hasOwn(COMMANDS, value);

/**
 * Locates the CLI behind a provider id. Called at startup so an uninstalled tool
 * fails immediately with a path to point at, rather than ten minutes into a
 * generation as an opaque spawn error.
 *
 * `UNIVERSAL_PROVIDER_CLI_PATH` overrides the PATH lookup, which is how the
 * integration tests point at a stub without installing anything.
 */
export function probeCliProvider(
  id: CliAdapterId,
  environment: Readonly<Record<string, string | undefined>> = process.env
): { available: true; executable: string } | { available: false; reason: string } {
  const override = environment.UNIVERSAL_PROVIDER_CLI_PATH?.trim();
  const command = override || COMMANDS[id];
  const executable = resolveExecutable(command);
  return executable
    ? { available: true, executable }
    : {
        available: false,
        reason: override
          ? `UNIVERSAL_PROVIDER_CLI_PATH points at ${override}, which is not an executable file.`
          : `The ${id} CLI (\`${command}\`) is not on PATH. Install it and sign in to your ` +
            'existing subscription, or set UNIVERSAL_PROVIDER_CLI_PATH to its full path.'
      };
}

export function createCliAdapter(options: {
  id: CliAdapterId;
  executable: string;
  model?: string | undefined;
}): CliAdapter {
  const { executable, model } = options;
  return options.id === 'codex'
    ? createCodexAdapter({ executable, ...(model ? { model } : {}) })
    : createClaudeCodeAdapter({ executable, ...(model ? { model } : {}) });
}

/**
 * The seam `createConfiguredGenerator` expects. Generation runs on the CLI's own
 * subscription login, so no API key reaches this factory and none is required.
 */
export const cliProviderFactory: LiveProviderFactory = {
  create(config: LiveProviderConfiguration): ReactGenerationProvider {
    if (!isCliProviderId(config.providerId))
      throw new RuntimeFailure(
        'INVALID_REQUEST',
        `Live provider ${config.providerId} is not installed.`
      );
    const probe = probeCliProvider(config.providerId);
    if (!probe.available) throw new RuntimeFailure('INVALID_REQUEST', probe.reason);
    return new CliGenerationProvider({
      adapter: createCliAdapter({
        id: config.providerId,
        executable: probe.executable,
        ...(config.model ? { model: config.model } : {})
      })
    });
  }
};
