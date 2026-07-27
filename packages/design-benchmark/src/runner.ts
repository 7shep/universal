import { compareIdentifiers, serializeDeterministically, sha256 } from './deterministic.ts';
import { recordExecutedCheck, type ExecutedCheckResult, type RawCheckResult } from './checks.ts';
import type { BenchmarkArm } from './types.ts';

export const UNIVERSAL_GUIDED_TOOLS = [
  'create_design_plan',
  'get_design_rules',
  'review_implementation'
] as const;

export interface RunnerFile {
  readonly path: string;
  readonly content: string;
}

export interface RunnerBudget {
  readonly maxTokens: number;
  readonly maxMilliseconds: number;
}

export interface BenchmarkWorkspace {
  readonly id: string;
}

export interface WorkspaceFactory<Workspace extends BenchmarkWorkspace> {
  create(input: { readonly id: string; readonly files: readonly RunnerFile[] }): Promise<Workspace>;
}

export interface ArmExecutionContext<Workspace extends BenchmarkWorkspace> {
  readonly arm: BenchmarkArm;
  readonly workspace: Workspace;
  readonly briefBytes: string;
  readonly inputDigest: string;
  readonly budget: RunnerBudget;
  readonly instructions: readonly string[];
  readonly availableTools: readonly string[];
}

export interface ArmExecutor<Workspace extends BenchmarkWorkspace> {
  execute(context: ArmExecutionContext<Workspace>): Promise<void>;
}

export interface RunnerCheckAdapter<Workspace extends BenchmarkWorkspace> {
  readonly name: string;
  execute(context: ArmExecutionContext<Workspace>): Promise<RawCheckResult>;
}

export interface BenchmarkRunnerInput<Workspace extends BenchmarkWorkspace> {
  readonly briefId: string;
  readonly briefBytes: string;
  readonly starterFiles: readonly RunnerFile[];
  readonly budget: RunnerBudget;
  readonly sharedInstructions: readonly string[];
  readonly requiredChecks: readonly string[];
  readonly workspaceFactory: WorkspaceFactory<Workspace>;
  readonly armExecutor: ArmExecutor<Workspace>;
  readonly checkAdapters: readonly RunnerCheckAdapter<Workspace>[];
}

export interface ArmExecutionRecord {
  readonly arm: BenchmarkArm;
  readonly workspaceId: string;
  readonly starterDigest: string;
  readonly briefDigest: string;
  readonly inputDigest: string;
  readonly budget: RunnerBudget;
  readonly instructions: readonly string[];
  readonly availableTools: readonly string[];
  readonly checks: readonly ExecutedCheckResult[];
}

export interface BenchmarkExecutionRecord {
  readonly briefId: string;
  readonly arms: readonly ArmExecutionRecord[];
}

function canonicalFiles(files: readonly RunnerFile[]): readonly RunnerFile[] {
  const canonical = files
    .map((file) => ({
      path: file.path.replaceAll('\\', '/').replace(/^\.\/+/, ''),
      content: file.content
    }))
    .sort((left, right) => compareIdentifiers(left.path, right.path));
  const paths = new Set<string>();
  for (const file of canonical) {
    if (!file.path || file.path.startsWith('/') || file.path.split('/').includes('..'))
      throw new Error(`Runner file path must be project-relative: ${file.path}`);
    if (/(^|\/)AGENTS\.md$/i.test(file.path))
      throw new Error('Runner starter inputs must not expose repository AGENTS.md files.');
    if (paths.has(file.path)) throw new Error(`Duplicate runner file path: ${file.path}.`);
    paths.add(file.path);
  }
  return canonical;
}

function digestFiles(files: readonly RunnerFile[]): string {
  return sha256(serializeDeterministically(files, 0));
}

function validateBudget(budget: RunnerBudget): void {
  if (!Number.isInteger(budget.maxTokens) || budget.maxTokens <= 0)
    throw new Error('Runner maxTokens must be a positive integer.');
  if (!Number.isInteger(budget.maxMilliseconds) || budget.maxMilliseconds <= 0)
    throw new Error('Runner maxMilliseconds must be a positive integer.');
}

/** Execute both benchmark arms with identical bytes/budgets and injected offline adapters. */
export async function executeBenchmarkPair<Workspace extends BenchmarkWorkspace>(
  input: BenchmarkRunnerInput<Workspace>
): Promise<BenchmarkExecutionRecord> {
  if (!input.briefId.trim() || !input.briefBytes)
    throw new Error('Runner brief id and bytes are required.');
  validateBudget(input.budget);
  if (
    input.sharedInstructions.some((instruction) =>
      /AGENTS\.md|Universal|create_design_plan|get_design_rules|review_implementation/i.test(
        instruction
      )
    )
  )
    throw new Error('Shared instructions must remain neutral and exclude Universal guidance.');
  const starterFiles = canonicalFiles(input.starterFiles);
  const briefFile = { path: 'benchmark/brief.json', content: input.briefBytes };
  if (starterFiles.some((file) => file.path === briefFile.path))
    throw new Error(`Starter files cannot replace ${briefFile.path}.`);
  const initialFiles = [...starterFiles, briefFile];
  const starterDigest = digestFiles(starterFiles);
  const briefDigest = sha256(input.briefBytes);
  const inputDigest = digestFiles(initialFiles);
  if (
    input.requiredChecks.some((name) => !name.trim()) ||
    new Set(input.requiredChecks).size !== input.requiredChecks.length
  )
    throw new Error('Runner required check names must be non-empty and unique.');
  const adapters = new Map(input.checkAdapters.map((adapter) => [adapter.name, adapter]));
  if (adapters.size !== input.checkAdapters.length)
    throw new Error('Runner check adapter names must be unique.');
  const missingAdapter = input.requiredChecks.find((name) => !adapters.has(name));
  if (missingAdapter)
    throw new Error(`No injected adapter exists for required check: ${missingAdapter}.`);

  const records: ArmExecutionRecord[] = [];
  const workspaces: Workspace[] = [];
  for (const arm of ['unguided', 'universal_guided'] as const) {
    const workspace = await input.workspaceFactory.create({
      id: `${input.briefId}--${arm}`,
      files: initialFiles.map((file) => ({ ...file }))
    });
    if (workspace.id !== `${input.briefId}--${arm}`)
      throw new Error(`Workspace factory returned an unexpected id for ${arm}.`);
    if (workspaces.some((existing) => Object.is(existing, workspace)))
      throw new Error('Each benchmark arm requires an independent workspace.');
    workspaces.push(workspace);
    const guided = arm === 'universal_guided';
    const context: ArmExecutionContext<Workspace> = {
      arm,
      workspace,
      briefBytes: input.briefBytes,
      inputDigest,
      budget: { ...input.budget },
      instructions: guided
        ? [
            ...input.sharedInstructions,
            'Use the Universal design workflow and all provided Universal tools.'
          ]
        : [...input.sharedInstructions],
      availableTools: guided ? [...UNIVERSAL_GUIDED_TOOLS] : []
    };
    await input.armExecutor.execute(context);
    const checks: ExecutedCheckResult[] = [];
    for (const name of input.requiredChecks) {
      const adapter = adapters.get(name)!;
      const result = recordExecutedCheck(name, await adapter.execute(context));
      checks.push(result);
      if (result.exitStatus !== 0)
        throw new Error(`Required runner check failed (${result.exitStatus}): ${name}.`);
    }
    records.push({
      arm,
      workspaceId: workspace.id,
      starterDigest,
      briefDigest,
      inputDigest,
      budget: { ...input.budget },
      instructions: context.instructions,
      availableTools: context.availableTools,
      checks
    });
  }
  return { briefId: input.briefId, arms: records };
}
