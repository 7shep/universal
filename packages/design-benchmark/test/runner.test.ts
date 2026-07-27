import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeRunnerPath,
  executeBenchmarkPair,
  loadBenchmarkDefinition,
  UNIVERSAL_GUIDED_TOOLS,
  type ArmExecutionRequest,
  type ArmExecutor,
  type BenchmarkSuiteManifest,
  type BenchmarkWorkspace,
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

const baseInput = (suiteOverride: BenchmarkSuiteManifest = suite) => {
  const created: MemoryWorkspace[] = [];
  const requests: ArmExecutionRequest<MemoryWorkspace>[] = [];
  const executors: ArmExecutor<MemoryWorkspace>[] = [];
  const finalized: string[] = [];
  const released: string[] = [];
  const checks: string[] = [];
  return {
    created,
    requests,
    executors,
    finalized,
    released,
    checks,
    input: {
      suite: suiteOverride,
      briefId: 'dq-v1-01-fintech',
      briefBytes: '{"task":"Build the supplied interface"}\n',
      starterFiles: [
        { path: 'package.json', content: '{"scripts":{"build":"tsc"}}\n' },
        { path: 'src/App.tsx', content: 'export const App = () => null;\n' }
      ],
      sharedInstructions: ['Implement the verbatim brief using the supplied starter.'],
      workspaceFactory: {
        async create({ id, files }: { id: string; files: readonly RunnerFile[] }) {
          const workspace = {
            id,
            canonicalRoot: `/isolated/${id}`,
            backendId: `backend-${id}`,
            files: files.map((file) => ({ ...file }))
          };
          created.push(workspace);
          return workspace;
        },
        async release(workspace: MemoryWorkspace) {
          released.push(workspace.id);
        }
      },
      executorFactory: {
        async create({ arm }: { arm: 'unguided' | 'universal_guided' }) {
          const executor: ArmExecutor<MemoryWorkspace> = {
            async execute(request) {
              requests.push(request);
              return { tokenUsage: arm === 'unguided' ? 101 : 102 };
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
        async execute(request: ArmExecutionRequest<MemoryWorkspace>) {
          checks.push(`${request.arm}:${name}`);
          return { exitStatus: 0, stdout: `${name} passed\r\n`, stderr: '' };
        }
      }))
    }
  };
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
    [
      {
        maxTokens: suite.execution_policy.budget.max_tokens,
        maxMilliseconds: suite.execution_policy.budget.max_milliseconds
      },
      {
        maxTokens: suite.execution_policy.budget.max_tokens,
        maxMilliseconds: suite.execution_policy.budget.max_milliseconds
      }
    ]
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
  assert.deepEqual(
    result.arms.flatMap((arm) => arm.checks.map((check) => check.name)),
    [...suite.source_evidence.required_checks, ...suite.source_evidence.required_checks]
  );
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

test('enforces maxMilliseconds, aborts, and finalizes timed-out executors', async () => {
  const timedSuite: BenchmarkSuiteManifest = {
    ...suite,
    execution_policy: {
      budget: { ...suite.execution_policy.budget, max_milliseconds: 10 }
    }
  };
  const fixture = baseInput(timedSuite);
  let observedSignal: AbortSignal | undefined;
  fixture.input.executorFactory = {
    async create({ arm }) {
      return {
        execute(request) {
          observedSignal = request.signal;
          return new Promise((_resolve, reject) => {
            request.signal.addEventListener('abort', () => reject(request.signal.reason), {
              once: true
            });
          });
        },
        async finalize() {
          fixture.finalized.push(arm);
        }
      };
    }
  };
  await assert.rejects(
    () => executeBenchmarkPair(fixture.input),
    /unguided exceeded maxMilliseconds \(10\)/
  );
  assert.equal(observedSignal?.aborted, true);
  assert.deepEqual(fixture.finalized, ['unguided']);
  assert.equal(fixture.released.length, 2);
});

test('rejects token overage and still finalizes the arm executor', async () => {
  const limitedSuite: BenchmarkSuiteManifest = {
    ...suite,
    execution_policy: { budget: { ...suite.execution_policy.budget, max_tokens: 5 } }
  };
  const fixture = baseInput(limitedSuite);
  fixture.input.executorFactory = {
    async create({ arm }) {
      return {
        async execute() {
          return { tokenUsage: 6 };
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
    }
  };
  await assert.rejects(
    () => executeBenchmarkPair(sharedWorkspace.input),
    /distinct workspace root and backend/
  );

  const sharedExecutor = baseInput();
  const executor: ArmExecutor<MemoryWorkspace> = {
    async execute() {
      return { tokenUsage: 1 };
    },
    async finalize() {}
  };
  sharedExecutor.input.executorFactory = {
    async create() {
      return executor;
    }
  };
  await assert.rejects(() => executeBenchmarkPair(sharedExecutor.input), /fresh executor instance/);
});

test('suite policy is authoritative and cannot omit mandatory checks or weaken budgets', async () => {
  const fixture = baseInput();
  const weakenedCallerInput = {
    ...fixture.input,
    budget: { maxTokens: 1, maxMilliseconds: 1 },
    requiredChecks: []
  };
  const result = await executeBenchmarkPair(weakenedCallerInput);
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

test('portable path canonicalization rejects roots/traversal and catches aliases', async () => {
  for (const path of [
    'C:relative.ts',
    'C:\\absolute.ts',
    '\\\\server\\share.ts',
    '/absolute.ts',
    '../escape.ts'
  ])
    assert.throws(() => canonicalizeRunnerPath(path), /portable|traverse/);
  assert.equal(canonicalizeRunnerPath('src//components/./App.tsx'), 'src/components/App.tsx');
  assert.throws(() => canonicalizeRunnerPath('./'), /empty alias/);

  const fixture = baseInput();
  fixture.input.starterFiles = [
    { path: 'src//App.tsx', content: 'one' },
    { path: 'src/./App.tsx', content: 'two' }
  ];
  await assert.rejects(
    () => executeBenchmarkPair(fixture.input),
    /Duplicate runner file path after canonicalization/
  );
});
