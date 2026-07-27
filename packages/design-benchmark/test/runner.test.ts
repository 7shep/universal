import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeBenchmarkPair,
  UNIVERSAL_GUIDED_TOOLS,
  type ArmExecutionContext,
  type BenchmarkWorkspace,
  type RunnerFile
} from '../src/index.ts';

interface MemoryWorkspace extends BenchmarkWorkspace {
  readonly files: readonly RunnerFile[];
}

const baseInput = () => {
  const created: MemoryWorkspace[] = [];
  const contexts: ArmExecutionContext<MemoryWorkspace>[] = [];
  const checks: string[] = [];
  return {
    created,
    contexts,
    checks,
    input: {
      briefId: 'dq-v1-01-fintech',
      briefBytes: '{"task":"Build the supplied interface"}\n',
      starterFiles: [
        { path: 'package.json', content: '{"scripts":{"build":"tsc"}}\n' },
        { path: 'src/App.tsx', content: 'export const App = () => null;\n' }
      ],
      budget: { maxTokens: 12_000, maxMilliseconds: 300_000 },
      sharedInstructions: ['Implement the verbatim brief using the supplied starter.'],
      requiredChecks: ['build', 'static_contract'],
      workspaceFactory: {
        async create({ id, files }: { id: string; files: readonly RunnerFile[] }) {
          const workspace = { id, files: files.map((file) => ({ ...file })) };
          created.push(workspace);
          return workspace;
        }
      },
      armExecutor: {
        async execute(context: ArmExecutionContext<MemoryWorkspace>) {
          contexts.push(context);
        }
      },
      checkAdapters: ['build', 'static_contract'].map((name) => ({
        name,
        async execute(context: ArmExecutionContext<MemoryWorkspace>) {
          checks.push(`${context.arm}:${name}`);
          return { exitStatus: 0, stdout: `${name} passed\r\n`, stderr: '' };
        }
      }))
    }
  };
};

test('executes isolated arms with identical bytes, digests, budgets, and required checks', async () => {
  const fixture = baseInput();
  const result = await executeBenchmarkPair(fixture.input);
  assert.equal(fixture.created.length, 2);
  assert.notStrictEqual(fixture.created[0], fixture.created[1]);
  assert.deepEqual(fixture.created[0]?.files, fixture.created[1]?.files);
  assert.deepEqual(
    result.arms.map((arm) => arm.inputDigest),
    [result.arms[0]?.inputDigest, result.arms[0]?.inputDigest]
  );
  assert.deepEqual(
    result.arms.map((arm) => arm.starterDigest),
    [result.arms[0]?.starterDigest, result.arms[0]?.starterDigest]
  );
  assert.deepEqual(
    result.arms.map((arm) => arm.briefDigest),
    [result.arms[0]?.briefDigest, result.arms[0]?.briefDigest]
  );
  assert.deepEqual(
    result.arms.map((arm) => arm.budget),
    [fixture.input.budget, fixture.input.budget]
  );
  assert.deepEqual(fixture.checks, [
    'unguided:build',
    'unguided:static_contract',
    'universal_guided:build',
    'universal_guided:static_contract'
  ]);
  assert.ok(
    result.arms.every((arm) =>
      arm.checks.every((check) => /^[a-f0-9]{64}$/.test(check.outputDigest))
    )
  );
});

test('keeps AGENTS and Universal tooling out of unguided while explicitly enabling guided tools', async () => {
  const fixture = baseInput();
  const result = await executeBenchmarkPair(fixture.input);
  const unguided = result.arms.find((arm) => arm.arm === 'unguided')!;
  const guided = result.arms.find((arm) => arm.arm === 'universal_guided')!;
  assert.deepEqual(unguided.instructions, fixture.input.sharedInstructions);
  assert.deepEqual(unguided.availableTools, []);
  assert.doesNotMatch(
    JSON.stringify(unguided),
    /AGENTS\.md|create_design_plan|get_design_rules|review_implementation/
  );
  assert.deepEqual(guided.availableTools, UNIVERSAL_GUIDED_TOOLS);
  assert.match(guided.instructions.join(' '), /Universal design workflow/);

  await assert.rejects(
    () =>
      executeBenchmarkPair({
        ...baseInput().input,
        starterFiles: [{ path: 'AGENTS.md', content: 'contaminated' }]
      }),
    /must not expose repository AGENTS\.md/
  );
});

test('requires injected adapters and aborts on non-zero required checks', async () => {
  const missing = baseInput();
  await assert.rejects(
    () =>
      executeBenchmarkPair({
        ...missing.input,
        checkAdapters: missing.input.checkAdapters.slice(0, 1)
      }),
    /No injected adapter exists.*static_contract/
  );
  const failing = baseInput();
  await assert.rejects(
    () =>
      executeBenchmarkPair({
        ...failing.input,
        checkAdapters: failing.input.checkAdapters.map((adapter) =>
          adapter.name === 'build'
            ? {
                ...adapter,
                async execute() {
                  return { exitStatus: 2, stdout: '', stderr: 'failed' };
                }
              }
            : adapter
        )
      }),
    /Required runner check failed \(2\): build/
  );
});
