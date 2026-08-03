import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderError, ReactGenerator } from './generator.ts';
import type {
  ProjectGenerationRequest,
  ProviderFailureCode,
  ReactGenerationProvider
} from './contracts.ts';

const provider = (thrown: unknown): ReactGenerationProvider => ({
  capabilities: {
    providerId: 'test.provider',
    contractVersions: ['1.0.0'],
    structuredOutput: true,
    deterministic: false,
    requiresCredentials: false
  },
  generate: async () => {
    throw thrown;
  }
});

// Request validation runs before the provider is ever called, so these tests need
// a genuinely valid request or they would assert on the wrong failure path.
const validRequest = async (): Promise<ProjectGenerationRequest> => {
  const { compileDesignPlanV2 } = await import('@universal/design-engine');
  const fixtures = await import('@universal/design-engine/fixtures');
  const { createProjectGenerationRequest } = await import('./request.ts');
  return createProjectGenerationRequest({
    projectId: 'project:provider-error',
    revisionId: 'revision:provider-error:1',
    designPlan: compileDesignPlanV2({
      brief: fixtures.fixtureCreativeBrief,
      evaluation: fixtures.fixtureSelectedDirectionEvaluation,
      providerOutput: fixtures.serializedFixtureDesignPlanV2Draft,
      now: '2026-07-28T12:10:00.000Z'
    })
  });
};

test('a ProviderError keeps its code, and retryability follows from it', async () => {
  const request = await validRequest();
  const expected: readonly [ProviderFailureCode, boolean][] = [
    ['authentication', false],
    ['rate-limit', true],
    ['timeout', true],
    ['unavailable', true],
    ['malformed-output', false],
    ['internal', true]
  ];
  for (const [code, retryable] of expected) {
    const result = await new ReactGenerator(
      provider(new ProviderError(code, `stub ${code}`))
    ).generate(request);
    assert.ok(!result.ok);
    assert.equal(result.failure.code, code, code);
    assert.equal(result.failure.retryable, retryable, `${code} retryable`);
    assert.match(result.failure.message, new RegExp(`stub ${code}`));
  }
});

test('a plain error still collapses to internal, and a secret in it is redacted', async () => {
  const request = await validRequest();
  const result = await new ReactGenerator(
    provider(new Error('failed with api_key: sk-live-abcdefghijkl')),
    ['sk-live-abcdefghijkl']
  ).generate(request);
  assert.ok(!result.ok);
  assert.equal(result.failure.code, 'internal');
  assert.ok(!result.failure.message.includes('sk-live-abcdefghijkl'));
});

test('an aborted signal outranks the code the provider reported', async () => {
  const request = await validRequest();
  const controller = new AbortController();
  controller.abort();
  const result = await new ReactGenerator(
    provider(new ProviderError('rate-limit', 'stub'))
  ).generate(request, controller.signal);
  assert.ok(!result.ok);
  assert.equal(result.failure.code, 'cancelled');
  assert.equal(result.failure.retryable, false);
});
