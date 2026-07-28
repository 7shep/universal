import { compareIdentifiers, serializeDeterministically, sha256 } from './deterministic.ts';
import { recordExecutedCheck, type ExecutedCheckResult, type RawCheckResult } from './checks.ts';
import { assertBenchmarkSuiteManifest, type BenchmarkSuiteManifest } from './schema.ts';
import type { BenchmarkArm } from './types.ts';

export const UNIVERSAL_GUIDED_TOOLS = [
  'create_design_plan',
  'get_design_rules',
  'review_implementation'
] as const;

export const ISOLATION_CAPABILITIES = [
  'filesystem_isolation',
  'process_isolation',
  'network_isolation',
  'host_isolation',
  'tool_isolation'
] as const;
export type IsolationCapability = (typeof ISOLATION_CAPABILITIES)[number];

export interface IsolationAttestation {
  readonly version: '1';
  readonly scope: 'workspace' | 'executor' | 'system';
  readonly provider: string;
  readonly capabilities: Readonly<Record<IsolationCapability, boolean>>;
  readonly guarantees: readonly string[];
}

export interface RunnerFile {
  readonly path: string;
  readonly content: string;
}

export interface RunnerBudget {
  readonly maxTokens: number;
  readonly maxMilliseconds: number;
  readonly terminationGraceMilliseconds: number;
}

/** A capability scoped to one workspace backend and canonical root. */
export interface BenchmarkWorkspace {
  readonly id: string;
  readonly canonicalRoot: string;
  readonly backendId: string;
}

export interface WorkspaceFactory<Workspace extends BenchmarkWorkspace> {
  readonly isolation: IsolationAttestation;
  create(input: { readonly id: string; readonly files: readonly RunnerFile[] }): Promise<Workspace>;
  release(workspace: Workspace): Promise<void>;
  quarantine(workspace: Workspace, reason: string): Promise<void>;
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

export interface ArmExecutionHandle {
  /** Resolves/rejects only after the underlying execution has fully settled. */
  join(): Promise<ArmExecutorOutcome>;
  /** Requests hard termination. It does not itself prove settlement; join does. */
  terminate(reason: Error): Promise<void>;
}

/**
 * Trusted provider boundary for model execution. Injection alone is not a
 * sandbox and does not establish network, host, or tool isolation.
 */
export interface ArmExecutor<Workspace extends BenchmarkWorkspace> {
  start(request: ArmExecutionRequest<Workspace>): Promise<ArmExecutionHandle>;
  finalize(): Promise<void>;
}

export interface ArmExecutorFactory<Workspace extends BenchmarkWorkspace> {
  readonly isolation: IsolationAttestation;
  create(input: { readonly arm: BenchmarkArm }): Promise<ArmExecutor<Workspace>>;
}

export interface RunnerCheckHandle {
  join(): Promise<RawCheckResult>;
  terminate(reason: Error): Promise<void>;
}

export interface RunnerCheckAdapter<Workspace extends BenchmarkWorkspace> {
  readonly name: string;
  start(request: ArmExecutionRequest<Workspace>): Promise<RunnerCheckHandle>;
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

export interface IsolationVerification {
  readonly version: '1';
  readonly status: 'verified' | 'unverified';
  readonly comparable: boolean;
  readonly requiredCapabilities: readonly IsolationCapability[];
  readonly missingCapabilities: readonly IsolationCapability[];
  readonly attestations: readonly IsolationAttestation[];
  readonly rationale: string;
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
  readonly isolation: IsolationVerification;
  readonly arms: readonly ArmExecutionRecord[];
}

export class RunnerIsolationFailure extends Error {
  readonly workspaceId: string;

  constructor(workspaceId: string, message: string) {
    super(message);
    this.name = 'RunnerIsolationFailure';
    this.workspaceId = workspaceId;
  }
}

/** Canonicalize a portable project-relative path before duplicate detection. */
export function canonicalizeRunnerPath(path: string): string {
  if (!path || path.includes('\0') || /^[a-zA-Z]:/.test(path) || /^(?:\\\\|\/\/|[\\/])/.test(path))
    throw new Error(`Runner file path must be portable and project-relative: ${path}`);
  const segments = path.replaceAll('\\', '/').split('/');
  if (segments.includes('..')) throw new Error(`Runner file path cannot traverse: ${path}`);
  const canonicalSegments = segments.filter((segment) => segment !== '' && segment !== '.');
  if (canonicalSegments.length === 0)
    throw new Error(`Runner file path resolves to an empty alias: ${path}`);
  for (const segment of canonicalSegments) {
    if (
      /[<>:"|?*]/.test(segment) ||
      [...segment].some((character) => character.charCodeAt(0) < 32) ||
      /[ .]$/.test(segment)
    )
      throw new Error(`Runner file path contains Windows-illegal characters or suffixes: ${path}`);
    const stem = segment.split('.')[0]!.toUpperCase();
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem))
      throw new Error(`Runner file path uses a Windows reserved name: ${path}`);
  }
  return canonicalSegments.join('/');
}

function canonicalFiles(files: readonly RunnerFile[]): readonly RunnerFile[] {
  const canonical = files
    .map((file) => ({ path: canonicalizeRunnerPath(file.path), content: file.content }))
    .sort((left, right) => compareIdentifiers(left.path, right.path));
  const paths = new Set<string>();
  for (const file of canonical) {
    if (/(^|\/)AGENTS\.md$/i.test(file.path))
      throw new Error('Runner starter inputs must not expose repository AGENTS.md files.');
    const folded = file.path.toLowerCase();
    if (paths.has(folded))
      throw new Error(`Duplicate runner file path after portable canonicalization: ${file.path}.`);
    paths.add(folded);
  }
  return canonical;
}

const digestFiles = (files: readonly RunnerFile[]): string =>
  sha256(serializeDeterministically(files, 0));

function budgetFromSuite(suite: BenchmarkSuiteManifest): RunnerBudget {
  return {
    maxTokens: suite.execution_policy.budget.max_tokens,
    maxMilliseconds: suite.execution_policy.budget.max_milliseconds,
    terminationGraceMilliseconds: suite.execution_policy.budget.termination_grace_milliseconds
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

function verifyIsolation(
  suite: BenchmarkSuiteManifest,
  workspaceAttestation: IsolationAttestation,
  executorAttestation: IsolationAttestation
): IsolationVerification {
  const attestations = [workspaceAttestation, executorAttestation];
  for (const attestation of attestations) {
    if (attestation.version !== suite.isolation_policy.attestation_version)
      throw new Error(`Isolation attestation version mismatch for ${attestation.provider}.`);
  }
  if (!['workspace', 'system'].includes(workspaceAttestation.scope))
    throw new Error('Workspace factory must provide a workspace or system attestation.');
  if (!['executor', 'system'].includes(executorAttestation.scope))
    throw new Error('Executor factory must provide an executor or system attestation.');
  const required = suite.isolation_policy.required_capabilities;
  const missing = required.filter((capability) => {
    if (workspaceAttestation.scope === 'system' && workspaceAttestation.capabilities[capability])
      return false;
    if (executorAttestation.scope === 'system' && executorAttestation.capabilities[capability])
      return false;
    return capability === 'filesystem_isolation'
      ? !workspaceAttestation.capabilities.filesystem_isolation
      : !executorAttestation.capabilities[capability];
  });
  const verified = missing.length === 0;
  return {
    version: '1',
    status: verified ? 'verified' : 'unverified',
    comparable: verified,
    requiredCapabilities: [...required],
    missingCapabilities: missing,
    attestations: attestations.map((attestation) => ({
      ...attestation,
      capabilities: { ...attestation.capabilities },
      guarantees: [...attestation.guarantees]
    })),
    rationale: verified
      ? 'All suite-required isolation capabilities are attested by the responsible provider scope.'
      : `Run is not release-comparable; missing scoped isolation capabilities: ${missing.join(', ')}.`
  };
}

const settled = async <Value>(
  promise: Promise<Value>
): Promise<
  | { readonly status: 'fulfilled'; readonly value: Value }
  | { readonly status: 'rejected'; readonly reason: unknown }
> => {
  try {
    return { status: 'fulfilled', value: await promise };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
};

async function joinWithinArmDeadline<Outcome>(input: {
  readonly label: string;
  readonly workspaceId: string;
  readonly handle: { join(): Promise<Outcome>; terminate(reason: Error): Promise<void> };
  readonly controller: AbortController;
  readonly deadline: number;
  readonly budget: RunnerBudget;
}): Promise<Outcome> {
  const joined = settled(input.handle.join());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const remaining = Math.max(0, input.deadline - Date.now());
  const timedOut = new Promise<'timeout'>((resolve) => {
    timeout = setTimeout(() => resolve('timeout'), remaining);
  });
  const first = await Promise.race([joined, timedOut]);
  if (first !== 'timeout') {
    if (timeout !== undefined) clearTimeout(timeout);
    if (first.status === 'rejected') throw first.reason;
    return first.value;
  }
  const timeoutError = new Error(
    `${input.label} exceeded arm maxMilliseconds (${input.budget.maxMilliseconds}).`
  );
  input.controller.abort(timeoutError);
  void settled(input.handle.terminate(timeoutError));
  let grace: ReturnType<typeof setTimeout> | undefined;
  const graceExpired = new Promise<'grace-expired'>((resolve) => {
    grace = setTimeout(() => resolve('grace-expired'), input.budget.terminationGraceMilliseconds);
  });
  const termination = await Promise.race([joined, graceExpired]);
  if (grace !== undefined) clearTimeout(grace);
  if (timeout !== undefined) clearTimeout(timeout);
  if (termination === 'grace-expired')
    throw new RunnerIsolationFailure(
      input.workspaceId,
      `${input.label} termination could not be joined within ${input.budget.terminationGraceMilliseconds}ms; workspace quarantined.`
    );
  throw timeoutError;
}

async function executeArmWithinBudget<Workspace extends BenchmarkWorkspace>(input: {
  readonly arm: BenchmarkArm;
  readonly workspace: Workspace;
  readonly executor: ArmExecutor<Workspace>;
  readonly request: ArmExecutionRequest<Workspace>;
  readonly requiredChecks: readonly string[];
  readonly adapters: ReadonlyMap<string, RunnerCheckAdapter<Workspace>>;
}): Promise<{ readonly tokenUsage: number; readonly checks: readonly ExecutedCheckResult[] }> {
  const controller = new AbortController();
  const request = { ...input.request, signal: controller.signal };
  const deadline = Date.now() + request.budget.maxMilliseconds;
  let handle: ArmExecutionHandle;
  try {
    handle = await input.executor.start(request);
  } catch (error) {
    await input.executor.finalize();
    throw error;
  }
  try {
    const outcome = await joinWithinArmDeadline({
      label: input.arm,
      workspaceId: input.workspace.id,
      handle,
      controller,
      deadline,
      budget: request.budget
    });
    if (!Number.isInteger(outcome.tokenUsage) || outcome.tokenUsage < 0)
      throw new Error(`Executor for ${input.arm} returned invalid tokenUsage.`);
    if (outcome.tokenUsage > request.budget.maxTokens)
      throw new Error(
        `Executor for ${input.arm} exceeded maxTokens: ${outcome.tokenUsage} > ${request.budget.maxTokens}.`
      );
    const checks: ExecutedCheckResult[] = [];
    for (const name of input.requiredChecks) {
      const checkHandle = await input.adapters.get(name)!.start(request);
      const raw = await joinWithinArmDeadline({
        label: `${input.arm} check ${name}`,
        workspaceId: input.workspace.id,
        handle: checkHandle,
        controller,
        deadline,
        budget: request.budget
      });
      const result = recordExecutedCheck(name, raw);
      if (result.exitStatus !== 0)
        throw new Error(`Required runner check failed (${result.exitStatus}): ${name}.`);
      checks.push(result);
    }
    await input.executor.finalize();
    return { tokenUsage: outcome.tokenUsage, checks };
  } catch (error) {
    if (!(error instanceof RunnerIsolationFailure)) await input.executor.finalize();
    throw error;
  }
}

/** Execute both arms; structural injection alone yields an unverified run. */
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
  if (starterFiles.some((file) => file.path.toLowerCase() === briefFile.path))
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
  const isolation = verifyIsolation(
    input.suite,
    input.workspaceFactory.isolation,
    input.executorFactory.isolation
  );

  const arms = ['unguided', 'universal_guided'] as const;
  const records: ArmExecutionRecord[] = [];
  const workspaces: Workspace[] = [];
  const isolationKeys: { readonly root: string; readonly backend: string }[] = [];
  const executors: ArmExecutor<Workspace>[] = [];
  const quarantined = new Set<string>();
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
      try {
        const outcome = await executeArmWithinBudget({
          arm,
          workspace,
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
      } catch (error) {
        if (error instanceof RunnerIsolationFailure) {
          quarantined.add(workspace.id);
          await input.workspaceFactory.quarantine(workspace, error.message);
        }
        throw error;
      }
    }
  } catch (error) {
    failure = error;
  }
  for (const workspace of [...workspaces].reverse()) {
    if (quarantined.has(workspace.id)) continue;
    try {
      await input.workspaceFactory.release(workspace);
    } catch (releaseError) {
      if (failure === undefined) failure = releaseError;
    }
  }
  if (failure !== undefined) throw failure;
  return { briefId: input.briefId, isolation, arms: records };
}

export function assertReleaseComparable(record: BenchmarkExecutionRecord): void {
  if (!record.isolation.comparable) throw new Error(record.isolation.rationale);
}
