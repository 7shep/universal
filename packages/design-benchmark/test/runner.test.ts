import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertReleaseComparable,
  canonicalizeRunnerPath,
  createChildProcessExecutorFactory,
  createLocalFilesystemWorkspaceFactory,
  executeBenchmarkPair,
  ISOLATION_CAPABILITIES,
  loadBenchmarkDefinition,
  RunnerIsolationFailure,
  UNVERIFIED_INJECTED_ISOLATION,
  UNIVERSAL_GUIDED_TOOLS,
  type ArmExecutionHandle,
  type ArmExecutionRequest,
  type ArmExecutor,
  type BenchmarkRunnerInput,
  type BenchmarkSuiteManifest,
  type BenchmarkWorkspace,
  type IsolationAttestation,
  type RunnerFile
} from '../src/index.ts';

const corpusRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../benchmarks/design-quality/v1'
);
const suite = (await loadBenchmarkDefinition(corpusRoot)).suite;

interface MemoryWorkspace extends BenchmarkWorkspace {
  readonly files: readonly RunnerFile[];
}

type MutableRunnerInput = {
  -readonly [
    Key in keyof BenchmarkRunnerInput<MemoryWorkspace>
  ]: BenchmarkRunnerInput<MemoryWorkspace>[Key];
};

const verifiedIsolation = (provider: string): IsolationAttestation => ({
  version: '1',
  provider,
  capabilities: Object.fromEntries(ISOLATION_CAPABILITIES.map((name) => [name, true])) as Record<
    (typeof ISOLATION_CAPABILITIES)[number],
    boolean
  >,
  guarantees: ['Test provider attests all required capabilities.']
});

const completedHandle = (tokenUsage: number): ArmExecutionHandle => ({
  async join() {
    return { tokenUsage };
  },
  async terminate() {}
});

const baseInput = (suiteOverride: BenchmarkSuiteManifest = suite) => {
  const created: MemoryWorkspace[] = [];
  const requests: ArmExecutionRequest<MemoryWorkspace>[] = [];
  const executors: ArmExecutor<MemoryWorkspace>[] = [];
  const finalized: string[] = [];
  const released: string[] = [];
  const quarantined: string[] = [];
  const checks: string[] = [];
  const input: MutableRunnerInput = {
    suite: suiteOverride,
    briefId: 'dq-v1-01-fintech',
    briefBytes: '{"task":"Build the supplied interface"}\n',
    starterFiles: [
      { path: 'package.json', content: '{"scripts":{"build":"tsc"}}\n' },
      { path: 'src/App.tsx', content: 'export const App = () => null;\n' }
    ],
    sharedInstructions: ['Implement the verbatim brief using the supplied starter.'],
    workspaceFactory: {
      isolation: UNVERIFIED_INJECTED_ISOLATION,
      async create({ id, files }) {
        const workspace = {
          id,
          canonicalRoot: `/isolated/${id}`,
          backendId: `backend-${id}`,
          files: files.map((file) => ({ ...file }))
        };
        created.push(workspace);
        return workspace;
      },
      async release(workspace) {
        released.push(workspace.id);
      },
      async quarantine(workspace) {
        quarantined.push(workspace.id);
      }
    },
    executorFactory: {
      isolation: UNVERIFIED_INJECTED_ISOLATION,
      async create({ arm }) {
        const executor: ArmExecutor<MemoryWorkspace> = {
          async start(request) {
            requests.push(request);
            return completedHandle(arm === 'unguided' ? 101 : 102);
          },
          async finalize() {
            finalized.push(arm);
          }
        };
        executors.push(executor);
        return executor;
      }
    },
    checkAdapters: suiteOverride.source_evidence.required_checks.map((name) => ({
      name,
      async execute(request) {
        checks.push(`${request.arm}:${name}`);
        return { exitStatus: 0, stdout: `${name} passed\r\n`, stderr: '' };
      }
    }))
  };
  return { created, requests, executors, finalized, released, quarantined, checks, input };
};

test('creates distinct executors/workspaces with identical suite-derived inputs and budgets', async () => {
  const fixture = baseInput();
  const result = await executeBenchmarkPair(fixture.input);
  assert.equal(fixture.created.length, 2);
  assert.notStrictEqual(fixture.created[0], fixture.created[1]);
  assert.notEqual(fixture.created[0]?.canonicalRoot, fixture.created[1]?.canonicalRoot);
  assert.notEqual(fixture.created[0]?.backendId, fixture.created[1]?.backendId);
  assert.notStrictEqual(fixture.executors[0], fixture.executors[1]);
  assert.deepEqual(fixture.created[0]?.files, fixture.created[1]?.files);
  assert.deepEqual(
    result.arms.map((arm) => arm.inputDigest),
    [result.arms[0]?.inputDigest, result.arms[0]?.inputDigest]
  );
  assert.deepEqual(
    result.arms.map((arm) => arm.budget),
    Array.from({ length: 2 }, () => ({
      maxTokens: suite.execution_policy.budget.max_tokens,
      maxMilliseconds: suite.execution_policy.budget.max_milliseconds,
      terminationGraceMilliseconds: suite.execution_policy.budget.termination_grace_milliseconds
    }))
  );
  assert.deepEqual(
    result.arms.map((arm) => arm.tokenUsage),
    [101, 102]
  );
  assert.deepEqual(fixture.finalized, ['unguided', 'universal_guided']);
  assert.deepEqual(fixture.released, [
    'dq-v1-01-fintech--universal_guided',
    'dq-v1-01-fintech--unguided'
  ]);
  assert.equal(result.isolation.status, 'unverified');
  assert.equal(result.isolation.comparable, false);
  assert.deepEqual(result.isolation.missingCapabilities, ISOLATION_CAPABILITIES);
  assert.throws(() => assertReleaseComparable(result), /not release-comparable/);
});

test('marks a run comparable only when every required capability is attested', async () => {
  const fixture = baseInput();
  fixture.input.workspaceFactory = {
    ...fixture.input.workspaceFactory,
    isolation: verifiedIsolation('verified-workspace-test')
  };
  const result = await executeBenchmarkPair(fixture.input);
  assert.equal(result.isolation.status, 'verified');
  assert.equal(result.isolation.comparable, true);
  assert.deepEqual(result.isolation.missingCapabilities, []);
  assert.doesNotThrow(() => assertReleaseComparable(result));
});

test('unguided request contains no guided instructions or tools', async () => {
  const fixture = baseInput();
  const result = await executeBenchmarkPair(fixture.input);
  const unguidedRequest = fixture.requests.find((request) => request.arm === 'unguided')!;
  const guidedRequest = fixture.requests.find((request) => request.arm === 'universal_guided')!;
  assert.deepEqual(unguidedRequest.instructions, fixture.input.sharedInstructions);
  assert.deepEqual(unguidedRequest.availableTools, []);
  assert.doesNotMatch(
    JSON.stringify({
      instructions: unguidedRequest.instructions,
      tools: unguidedRequest.availableTools
    }),
    /Universal|create_design_plan|get_design_rules|review_implementation/
  );
  assert.deepEqual(guidedRequest.availableTools, UNIVERSAL_GUIDED_TOOLS);
  assert.ok(
    result.arms.every((arm) =>
      arm.checks.every((check) => /^[a-f0-9]{64}$/.test(check.outputDigest))
    )
  );
});

test('timeout terminates, joins, finalizes, and releases a cooperative executor', async () => {
  const timedSuite: BenchmarkSuiteManifest = {
    ...suite,
    execution_policy: {
      budget: {
        ...suite.execution_policy.budget,
        max_milliseconds: 5,
        termination_grace_milliseconds: 25
      }
    }
  };
  const fixture = baseInput(timedSuite);
  let observedSignal: AbortSignal | undefined;
  let terminated = 0;
  fixture.input.executorFactory = {
    isolation: UNVERIFIED_INJECTED_ISOLATION,
    async create({ arm }) {
      return {
        async start(request) {
          observedSignal = request.signal;
          let rejectJoin!: (reason: unknown) => void;
          const joined = new Promise<never>((_resolve, reject) => {
            rejectJoin = reject;
          });
          return {
            join: () => joined,
            async terminate(reason) {
              terminated += 1;
              rejectJoin(reason);
            }
          };
        },
        async finalize() {
          fixture.finalized.push(arm);
        }
      };
    }
  };
  await assert.rejects(
    () => executeBenchmarkPair(fixture.input),
    /unguided exceeded maxMilliseconds \(5\)/
  );
  assert.equal(observedSignal?.aborted, true);
  assert.equal(terminated, 1);
  assert.deepEqual(fixture.finalized, ['unguided']);
  assert.deepEqual(fixture.quarantined, []);
  assert.equal(fixture.released.length, 2);
});

test('non-cooperative execution is quarantined and never released or finalized', async () => {
  const timedSuite: BenchmarkSuiteManifest = {
    ...suite,
    execution_policy: {
      budget: {
        ...suite.execution_policy.budget,
        max_milliseconds: 5,
        termination_grace_milliseconds: 5
      }
    }
  };
  const fixture = baseInput(timedSuite);
  let terminated = 0;
  fixture.input.executorFactory = {
    isolation: UNVERIFIED_INJECTED_ISOLATION,
    async create() {
      return {
        async start() {
          return {
            join: () => new Promise<never>(() => undefined),
            async terminate() {
              terminated += 1;
            }
          };
        },
        async finalize() {
          fixture.finalized.push('unexpected');
        }
      };
    }
  };
  await assert.rejects(
    () => executeBenchmarkPair(fixture.input),
    (error: unknown) =>
      error instanceof RunnerIsolationFailure && /could not be joined/.test(error.message)
  );
  assert.equal(terminated, 1);
  assert.deepEqual(fixture.finalized, []);
  assert.deepEqual(fixture.quarantined, ['dq-v1-01-fintech--unguided']);
  assert.deepEqual(fixture.released, ['dq-v1-01-fintech--universal_guided']);
});

test('rejects token overage and still finalizes the arm executor', async () => {
  const limitedSuite: BenchmarkSuiteManifest = {
    ...suite,
    execution_policy: { budget: { ...suite.execution_policy.budget, max_tokens: 5 } }
  };
  const fixture = baseInput(limitedSuite);
  fixture.input.executorFactory = {
    isolation: UNVERIFIED_INJECTED_ISOLATION,
    async create({ arm }) {
      return {
        async start() {
          return completedHandle(6);
        },
        async finalize() {
          fixture.finalized.push(arm);
        }
      };
    }
  };
  await assert.rejects(() => executeBenchmarkPair(fixture.input), /exceeded maxTokens: 6 > 5/);
  assert.deepEqual(fixture.finalized, ['unguided']);
  assert.equal(fixture.released.length, 2);
});

test('rejects shared workspace roots/backends and reused executor instances', async () => {
  const sharedWorkspace = baseInput();
  sharedWorkspace.input.workspaceFactory = {
    isolation: UNVERIFIED_INJECTED_ISOLATION,
    async create({ id, files }) {
      return {
        id,
        canonicalRoot: '/shared',
        backendId: 'shared-backend',
        files: files.map((file) => ({ ...file }))
      };
    },
    async release(workspace) {
      sharedWorkspace.released.push(workspace.id);
    },
    async quarantine(workspace) {
      sharedWorkspace.quarantined.push(workspace.id);
    }
  };
  await assert.rejects(
    () => executeBenchmarkPair(sharedWorkspace.input),
    /distinct workspace root and backend/
  );

  const sharedExecutor = baseInput();
  const executor: ArmExecutor<MemoryWorkspace> = {
    async start() {
      return completedHandle(1);
    },
    async finalize() {}
  };
  sharedExecutor.input.executorFactory = {
    isolation: UNVERIFIED_INJECTED_ISOLATION,
    async create() {
      return executor;
    }
  };
  await assert.rejects(() => executeBenchmarkPair(sharedExecutor.input), /fresh executor instance/);
});

test('suite policy is authoritative and cannot omit mandatory checks', async () => {
  const fixture = baseInput();
  const result = await executeBenchmarkPair(fixture.input);
  assert.equal(result.arms[0]?.budget.maxTokens, suite.execution_policy.budget.max_tokens);
  assert.deepEqual(
    result.arms[0]?.checks.map((check) => check.name),
    suite.source_evidence.required_checks
  );

  const incompleteSuite = {
    ...suite,
    source_evidence: { ...suite.source_evidence, required_checks: ['build', 'static_contract'] }
  } as unknown as BenchmarkSuiteManifest;
  await assert.rejects(
    () => executeBenchmarkPair(baseInput(incompleteSuite).input),
    /source_evidence/
  );
});

test('portable path canonicalization rejects platform aliases and unsafe names', async () => {
  for (const path of [
    'C:relative.ts',
    'C:\\absolute.ts',
    '\\\\server\\share.ts',
    '/absolute.ts',
    '../escape.ts'
  ])
    assert.throws(() => canonicalizeRunnerPath(path), /portable|traverse/);
  for (const path of ['NUL.txt', 'src/COM1', 'src/bad?.tsx', 'src/trailing.', 'src/trailing '])
    assert.throws(() => canonicalizeRunnerPath(path), /reserved|illegal/);
  assert.equal(canonicalizeRunnerPath('src//components/./App.tsx'), 'src/components/App.tsx');
  assert.throws(() => canonicalizeRunnerPath('./'), /empty alias/);

  const fixture = baseInput();
  fixture.input.starterFiles = [
    { path: 'src/App.tsx', content: 'one' },
    { path: 'SRC/app.tsx', content: 'two' }
  ];
  await assert.rejects(
    () => executeBenchmarkPair(fixture.input),
    /Duplicate runner file path after portable canonicalization/
  );
});

test('local filesystem backend owns real roots, performs safe I/O, and quarantines in place', async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), 'benchmark-owned-'));
  try {
    const factory = await createLocalFilesystemWorkspaceFactory(ownedRoot);
    assert.equal(factory.isolation.capabilities.filesystem_isolation, false);
    const workspace = await factory.create({
      id: 'local-test',
      files: [{ path: 'src/App.tsx', content: 'safe' }]
    });
    assert.equal(await workspace.read('src/App.tsx'), 'safe');
    await assert.rejects(() => workspace.write('../escape', 'unsafe'), /traverse/);
    await factory.quarantine(workspace, 'non-cooperative child');
    const marker = JSON.parse(
      await readFile(join(workspace.canonicalRoot, '.benchmark-quarantine.json'), 'utf8')
    ) as { reason: string };
    assert.equal(marker.reason, 'non-cooperative child');
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test('child process backend is shell-free, sanitized, terminable, and joins on close', async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), 'benchmark-child-'));
  try {
    const workspaceFactory = await createLocalFilesystemWorkspaceFactory(ownedRoot);
    const workspace = await workspaceFactory.create({ id: 'child-test', files: [] });
    const executorFactory = createChildProcessExecutorFactory<BenchmarkWorkspace>({
      command: process.execPath,
      args: [
        '-e',
        "process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({tokenUsage:3})))"
      ],
      env: {}
    });
    assert.equal(executorFactory.isolation.capabilities.process_isolation, true);
    assert.equal(executorFactory.isolation.capabilities.network_isolation, false);
    const executor = await executorFactory.create({ arm: 'unguided' });
    const handle = await executor.start({
      arm: 'unguided',
      workspace,
      briefBytes: '{}',
      inputDigest: 'digest',
      budget: { maxTokens: 10, maxMilliseconds: 1000, terminationGraceMilliseconds: 1000 },
      instructions: [],
      availableTools: [],
      signal: new AbortController().signal
    });
    assert.deepEqual(await handle.join(), { tokenUsage: 3 });
    await executor.finalize();
    await workspaceFactory.release(workspace);
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});
