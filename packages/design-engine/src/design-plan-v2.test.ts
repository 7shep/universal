import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreativeBrief } from './discovery-contracts.ts';
import { compileDesignPlanV2, DesignPlanV2CompilerError } from './design-plan-v2-compiler.ts';
import type { DesignPlanV2Draft } from './design-plan-v2-contracts.ts';
import {
  fixtureDesignPlanV2Draft,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from './design-plan-v2-fixtures.ts';
import { parseDesignPlanV2, parseDesignPlanV2Draft } from './design-plan-v2-validation.ts';
import { fixtureCreativeBrief } from './fixtures.ts';

const compile = (
  brief: CreativeBrief = fixtureCreativeBrief,
  draft: DesignPlanV2Draft = fixtureDesignPlanV2Draft
) =>
  compileDesignPlanV2({
    brief,
    evaluation: fixtureSelectedDirectionEvaluation,
    providerOutput: `${JSON.stringify(draft)}\n`,
    now: '2026-07-27T12:06:00.000Z'
  });

function expectCompilerError(
  action: () => unknown,
  code: DesignPlanV2CompilerError['code'],
  path?: string
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof DesignPlanV2CompilerError);
    assert.equal(error.code, code);
    if (path) assert.equal(error.path, path);
    return true;
  });
}

test('successfully compiles a complete, deterministic Design Plan v2', () => {
  const first = compile();
  const second = compile();
  assert.deepEqual(first, second);
  assert.equal(first.contractVersion, '2.0.0');
  assert.equal(first.source.approvedDigest, fixtureCreativeBrief.digest);
  assert.deepEqual(first.pageMap, fixtureCreativeBrief.content.pageMap);
  assert.equal(parseDesignPlanV2(`${JSON.stringify(first)}\n`).ok, true);
});

test('rejects an unapproved or revised brief', () => {
  const revised: CreativeBrief = {
    ...fixtureCreativeBrief,
    approval: { status: 'revision-requested', revisionReason: 'Change the page scope.' }
  };
  expectCompilerError(() => compile(revised), 'unapproved-brief', 'approval.status');
});

test('rejects stale approval', () => {
  const stale: CreativeBrief = {
    ...fixtureCreativeBrief,
    approval: { ...fixtureCreativeBrief.approval, approvedDigest: 'discovery-v1-stale' }
  };
  expectCompilerError(() => compile(stale), 'stale-approval', 'approval.approvedDigest');
});

test('rejects changed brief content even when its stored digest was not updated', () => {
  const changed: CreativeBrief = {
    ...fixtureCreativeBrief,
    content: {
      ...fixtureCreativeBrief.content,
      purpose: { summary: 'A silently changed purpose.' }
    }
  };
  expectCompilerError(() => compile(changed), 'stale-approval', 'digest');
});

test('strict provider validation rejects a missing rationale and unknown fields', () => {
  const missingRationale = structuredClone(fixtureDesignPlanV2Draft);
  missingRationale.typographySystem.rationale = '';
  expectCompilerError(
    () => compile(fixtureCreativeBrief, missingRationale),
    'invalid-provider-output',
    'typographySystem.rationale'
  );

  const withUnknown = { ...fixtureDesignPlanV2Draft, inventedBrand: 'Acme' };
  const parsed = parseDesignPlanV2Draft(JSON.stringify(withUnknown));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error.path, '$.inventedBrand');
});

test('rejects invalid decision provenance at the trust boundary', () => {
  const draft = structuredClone(fixtureDesignPlanV2Draft);
  const direction = draft.decisionProvenance.find((item) => item.id === 'prov:direction')!;
  direction.sourceId = 'invented-direction';
  expectCompilerError(() => compile(fixtureCreativeBrief, draft), 'invalid-provenance');
});

test('rejects missing page requirements', () => {
  const draft = structuredClone(fixtureDesignPlanV2Draft);
  draft.sectionIntentions = draft.sectionIntentions.filter(
    (item) => item.requiredSection !== 'subscribe'
  );
  expectCompilerError(() => compile(fixtureCreativeBrief, draft), 'invalid-plan');
});

test('rejects incomplete responsive transformations', () => {
  const draft = structuredClone(fixtureDesignPlanV2Draft);
  draft.responsiveTransformations.value = draft.responsiveTransformations.value.filter(
    (item) => item.target !== 'imagery'
  );
  expectCompilerError(
    () => compile(fixtureCreativeBrief, draft),
    'invalid-provider-output',
    'responsiveTransformations.value'
  );
});

test('rejects incomplete protected invariants', () => {
  const draft = structuredClone(fixtureDesignPlanV2Draft);
  draft.protectedInvariants = draft.protectedInvariants.filter((item) => item.area !== 'brand');
  expectCompilerError(
    () => compile(fixtureCreativeBrief, draft),
    'invalid-provider-output',
    'protectedInvariants'
  );
});

test('rejects a stale or tampered selected-direction evaluation', () => {
  expectCompilerError(
    () =>
      compileDesignPlanV2({
        brief: fixtureCreativeBrief,
        evaluation: { ...fixtureSelectedDirectionEvaluation, score: 0.1 },
        providerOutput: serializedFixtureDesignPlanV2Draft,
        now: '2026-07-27T12:06:00.000Z'
      }),
    'invalid-evaluation',
    'digest'
  );
});
