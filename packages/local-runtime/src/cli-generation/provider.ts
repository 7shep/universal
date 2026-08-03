import {
  ProviderError,
  type ProjectGenerationRequest,
  type RawGeneratedProject,
  type ReactGenerationProvider
} from '@universal/generation';
import type { CliAdapter } from './adapter-support.ts';
import { buildPrompt, buildRepairPrompt } from './prompt.ts';
import { selfCheck } from './self-check.ts';

/** One budget for the whole call, shared by the first pass and the repair. */
export const DEFAULT_GENERATION_TIMEOUT_MS = 10 * 60_000;

export interface CliProviderOptions {
  adapter: CliAdapter;
  timeoutMs?: number;
  now?: () => number;
}

/**
 * Drives an already-authenticated agent CLI to turn an approved Design Plan v2
 * into a React project.
 *
 * Two rules shape everything here. **At most two invocations, ever** -- an
 * unbounded repair loop against a subscription is the expensive failure mode. And
 * **a failing repair still returns its output**: the review gate is the authority
 * on correctness, and a provider that suppressed flawed output would only hide
 * the diagnostics the operator needs.
 */
export class CliGenerationProvider implements ReactGenerationProvider {
  readonly capabilities;
  private readonly adapter: CliAdapter;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(options: CliProviderOptions) {
    this.adapter = options.adapter;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS;
    this.now = options.now ?? (() => Date.now());
    this.capabilities = {
      providerId: `universal.cli-${options.adapter.id}`,
      contractVersions: ['1.0.0'] as const,
      structuredOutput: true as const,
      deterministic: false,
      // The CLI carries its own subscription login; the runtime holds no secret.
      requiresCredentials: false
    };
  }

  async generate(
    request: ProjectGenerationRequest,
    signal?: AbortSignal
  ): Promise<RawGeneratedProject> {
    if (signal?.aborted) throw new ProviderError('cancelled', 'Generation was cancelled.');
    const deadline = this.now() + this.timeoutMs;
    const remaining = () => deadline - this.now();

    const first = buildPrompt(request);
    const firstText = await this.adapter.run({
      system: first.system,
      user: first.user,
      deadlineMs: remaining(),
      signal
    });
    const firstProject = parsePayload(this.adapter.id, firstText);
    const gaps = selfCheck(firstProject, request);
    if (gaps.length === 0) return firstProject;

    // Out of time is not worth a wasted repair: return what we have and let the
    // gate report the same gaps with full build diagnostics attached.
    if (remaining() <= 0) return firstProject;

    const repair = buildRepairPrompt(request, firstText, gaps);
    const repairedText = await this.adapter.run({
      system: repair.system,
      user: repair.user,
      deadlineMs: remaining(),
      signal
    });
    return parsePayload(this.adapter.id, repairedText);
  }
}

/**
 * Models wrap JSON in prose or a markdown fence often enough to be worth handling
 * here rather than burning the single repair attempt on a formatting slip.
 */
export function parsePayload(id: string, text: string): RawGeneratedProject {
  const candidate = extractJsonObject(text);
  if (candidate === undefined)
    throw new ProviderError(
      'malformed-output',
      `${id} returned no JSON object.\n${text.slice(0, 2000)}`
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new ProviderError(
      'malformed-output',
      `${id} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { files?: unknown }).files)
  )
    throw new ProviderError('malformed-output', `${id} returned no files array.`);
  return parsed as RawGeneratedProject;
}

function extractJsonObject(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(trimmed);
  if (fenced?.[1]?.trim().startsWith('{')) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  return start === -1 ? undefined : trimmed.slice(start, trimmed.lastIndexOf('}') + 1);
}
