import { compareIdentifiers, serializeDeterministically, sha256 } from './deterministic.ts';
import { recordExecutedCheck, type ExecutedCheckResult, type RawCheckResult } from './checks.ts';
import { assertBenchmarkSuiteManifest, type BenchmarkSuiteManifest } from './schema.ts';
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

/** A capability scoped to one workspace backend and canonical root. */
export interface BenchmarkWorkspace {
  readonly id: string;
  readonly canonicalRoot: string;
  readonly backendId: string;
}

export interface WorkspaceFactory<Workspace extends BenchmarkWorkspace> {
  create(input: { readonly id: string; readonly files: readonly RunnerFile[] }): Promise<Workspace>;
  release(workspace: Workspace): Promise<void>;
}

export interface ArmExecutionRequest<Workspace extends BenchmarkWorkspace> {
  readonly arm: BenchmarkArm;
  readonly workspace: Workspace;
  readonly briefBytes: string;
  readonly inputDigest: string;
  readonly budget: RunnerBudget;
  readonly instructions: readonly string[];
  readonly availableTools: readonly string[];
  readonly signal: AbortSignal;
}

export interface ArmExecutorOutcome {
  readonly tokenUsage: number;
}

/**
 * Trusted provider boundary for model execution. A factory must return a fresh,
 * arm-local instance. The runner supplies only that arm's workspace capability,
 * instructions, tools, budget, and abort signal.
 */
export interface ArmExecutor<Workspace extends BenchmarkWorkspace> {
  execute(request: ArmExecutionRequest<Workspace>): Promise<ArmExecutorOutcome>;
  finalize(): Promise<void>;
}

export interface ArmExecutorFactory<Workspace extends BenchmarkWorkspace> {
  create(input: { readonly arm: BenchmarkArm }): Promise<ArmExecutor<Workspace>>;
}

export interface RunnerCheckAdapter<Workspace extends BenchmarkWorkspace> {
  readonly name: string;
  execute(request: ArmExecutionRequest<Workspace>): Promise<RawCheckResult>;
}

export interface BenchmarkRunnerInput<Workspace extends BenchmarkWorkspace> {
  readonly suite: BenchmarkSuiteManifest;
  readonly briefId: string;
  readonly briefBytes: string;
  readonly starterFiles: readonly RunnerFile[];
  readonly sharedInstructions: readonly string[];
  readonly workspaceFactory: WorkspaceFactory<Workspace>;
  readonly executorFactory: ArmExecutorFactory<Workspace>;
  readonly checkAdapters: readonly RunnerCheckAdapter<Workspace>[];
}

export interface ArmExecutionRecord {
  readonly arm: BenchmarkArm;
  readonly workspaceId: string;
  readonly canonicalWorkspaceRoot: string;
  readonly workspaceBackendId: string;
  readonly starterDigest: string;
  readonly briefDigest: string;
  readonly inputDigest: string;
  readonly budget: RunnerBudget;
  readonly tokenUsage: number;
  readonly instructions: readonly string[];
  readonly availableTools: readonly string[];
  readonly checks: readonly ExecutedCheckResult[];
}

export interface BenchmarkExecutionRecord {
  readonly briefId: string;
  readonly arms: readonly ArmExecutionRecord[];
}

/** Canonicalize a portable project-relative path before duplicate detection. */
export function canonicalizeRunnerPath(path: string): string {
  if (!path || path.includes('\0') || /^[a-zA-Z]:/.test(path) || /^(?:\\\\|\/\/|[\\/])/.test(path))
    throw new Error(`Runner file path must be portable and project-relative: ${path}`);
  const segments = path.replaceAll('\\', '/').split('/');
  if (segments.includes('..')) throw new Error(`Runner file path cannot traverse: ${path}`);
  const canonical = segments.filter((segment) => segment !== '' && segment !== '.').join('/');
  if (!canonical) throw new Error(`Runner file path resolves to an empty alias: ${path}`);
  return canonical;
}

function canonicalFiles(files: readonly RunnerFile[]): readonly RunnerFile[] {
  const canonical = files
    .map((file) => ({ path: canonicalizeRunnerPath(file.path), content: file.content }))
    .sort((left, right) => compareIdentifiers(left.path, right.path));
  const paths = new Set<string>();
  for (const file of canonical) {
    if (/(^|\/)AGENTS\.md$/i.test(file.path))
      throw new Error('Runner starter inputs must not expose repository AGENTS.md files.');
    if (paths.has(file.path))
      throw new Error(`Duplicate runner file path after canonicalization: ${file.path}.`);
    paths.add(file.path);
  }
  return canonical;
}

const digestFiles = (files: readonly RunnerFile[]): string =>
  sha256(serializeDeterministically(files, 0));

function budgetFromSuite(suite: BenchmarkSuiteManifest): RunnerBudget {
  return {
    maxTokens: suite.execution_policy.budget.max_tokens,
    maxMilliseconds: suite.execution_policy.budget.max_milliseconds
  };
}

function workspaceIsolationKeys(
  workspace: BenchmarkWorkspace,
  expectedId: string
): { readonly root: string; readonly backend: string } {
  if (workspace.id !== expectedId)
    throw new Error(`Workspace factory returned an unexpected id: ${workspace.id}.`);
  const root = workspace.canonicalRoot;
  if (
    !root ||
    root.includes('\\') ||
    (!root.startsWith('/') && !/^[a-zA-Z]:\//.test(root)) ||
    (root.length > 1 && root.endsWith('/')) ||
    root
      .split('/')
      .some(
        (segment, index) => index > 0 && (segment === '' || segment === '.' || segment === '..')
      )
  )
    throw new Error(`Workspace factory returned a non-canonical absolute root: ${root}.`);
  if (!workspace.backendId.trim()) throw new Error('Workspace capability requires backendId.');
  return { root: root.toLowerCase(), backend: workspace.backendId.toLowerCase() };
}
async function executeArmWithinBudget<Workspace extends BenchmarkWorkspace>(input: {
  readonly arm: BenchmarkArm;
  readonly executor: ArmExecutor<Workspace>;
  readonly request: ArmExecutionRequest<Workspace>;
  readonly requiredChecks: readonly string[];
  readonly adapters: ReadonlyMap<string, RunnerCheckAdapter<Workspace>>;
}): Promise<{ readonly tokenUsage: number; readonly checks: readonly ExecutedCheckResult[] }> {
  const controller = new AbortController();
  const request = { ...input.request, signal: controller.signal };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: unknown;
  let completed:
    { readonly tokenUsage: number; readonly checks: readonly ExecutedCheckResult[] } | undefined;
  try {
    const operation = (async () => {
      const outcome = await input.executor.execute(request);
      if (!Number.isInteger(outcome.tokenUsage) || outcome.tokenUsage < 0)
        throw new Error(`Executor for ${input.arm} returned invalid tokenUsage.`);
      if (outcome.tokenUsage > request.budget.maxTokens)
        throw new Error(
          `Executor for ${input.arm} exceeded maxTokens: ${outcome.tokenUsage} > ${request.budget.maxTokens}.`
        );
      const checks: ExecutedCheckResult[] = [];
      for (const name of input.requiredChecks) {
        const result = recordExecutedCheck(name, await input.adapters.get(name)!.execute(request));
        if (result.exitStatus !== 0)
          throw new Error(`Required runner check failed (${result.exitStatus}): ${name}.`);
        checks.push(result);
      }
      return { tokenUsage: outcome.tokenUsage, checks };
    })();
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error(
          `${input.arm} exceeded maxMilliseconds (${request.budget.maxMilliseconds}).`
        );
        controller.abort(error);
        reject(error);
      }, request.budget.maxMilliseconds);
    });
    completed = await Promise.race([operation, timeout]);
  } catch (error) {
    failure = error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (!controller.signal.aborted)
      controller.abort(new Error(`${input.arm} execution finalized.`));
    try {
      await input.executor.finalize();
    } catch (finalizeError) {
      if (failure === undefined) failure = finalizeError;
    }
  }
  if (failure !== undefined) throw failure;
  if (completed === undefined)
    throw new Error(`Executor for ${input.arm} completed without an outcome.`);
  return completed;
}
/** Execute both arms from authoritative suite policy using isolated capabilities. */
export async function executeBenchmarkPair<Workspace extends BenchmarkWorkspace>(
  input: BenchmarkRunnerInput<Workspace>
): Promise<BenchmarkExecutionRecord> {
  assertBenchmarkSuiteManifest(input.suite);
  if (!input.briefId.trim() || !input.briefBytes)
    throw new Error('Runner brief id and bytes are required.');
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
  const budget = budgetFromSuite(input.suite);
  const requiredChecks = input.suite.source_evidence.required_checks;
  const adapters = new Map(input.checkAdapters.map((adapter) => [adapter.name, adapter]));
  if (adapters.size !== input.checkAdapters.length)
    throw new Error('Runner check adapter names must be unique.');
  const missingAdapter = requiredChecks.find((name) => !adapters.has(name));
  if (missingAdapter)
    throw new Error(`No injected adapter exists for required check: ${missingAdapter}.`);

  const arms = ['unguided', 'universal_guided'] as const;
  const records: ArmExecutionRecord[] = [];
  const workspaces: Workspace[] = [];
  const isolationKeys: { readonly root: string; readonly backend: string }[] = [];
  const executors: ArmExecutor<Workspace>[] = [];
  let failure: unknown;
  try {
    for (const arm of arms) {
      const id = `${input.briefId}--${arm}`;
      const workspace = await input.workspaceFactory.create({
        id,
        files: initialFiles.map((file) => ({ ...file }))
      });
      workspaces.push(workspace);
      const keys = workspaceIsolationKeys(workspace, id);
      if (
        isolationKeys.some(
          (existing) => existing.root === keys.root || existing.backend === keys.backend
        )
      )
        throw new Error('Each benchmark arm requires a distinct workspace root and backend.');
      isolationKeys.push(keys);
    }
    for (const [index, arm] of arms.entries()) {
      const workspace = workspaces[index]!;
      const executor = await input.executorFactory.create({ arm });
      if (executors.some((existing) => Object.is(existing, executor)))
        throw new Error('Executor factory must create a fresh executor instance for each arm.');
      executors.push(executor);
      const guided = arm === 'universal_guided';
      const request: ArmExecutionRequest<Workspace> = {
        arm,
        workspace,
        briefBytes: input.briefBytes,
        inputDigest,
        budget: { ...budget },
        instructions: guided
          ? [
              ...input.sharedInstructions,
              'Use the Universal design workflow and all provided Universal tools.'
            ]
          : [...input.sharedInstructions],
        availableTools: guided ? [...UNIVERSAL_GUIDED_TOOLS] : [],
        signal: new AbortController().signal
      };
      const outcome = await executeArmWithinBudget({
        arm,
        executor,
        request,
        requiredChecks,
        adapters
      });
      records.push({
        arm,
        workspaceId: workspace.id,
        canonicalWorkspaceRoot: workspace.canonicalRoot,
        workspaceBackendId: workspace.backendId,
        starterDigest,
        briefDigest,
        inputDigest,
        budget: { ...budget },
        tokenUsage: outcome.tokenUsage,
        instructions: request.instructions,
        availableTools: request.availableTools,
        checks: outcome.checks
      });
    }
  } catch (error) {
    failure = error;
  }
  for (const workspace of [...workspaces].reverse()) {
    try {
      await input.workspaceFactory.release(workspace);
    } catch (releaseError) {
      if (failure === undefined) failure = releaseError;
    }
  }
  if (failure !== undefined) throw failure;
  return { briefId: input.briefId, arms: records };
}
