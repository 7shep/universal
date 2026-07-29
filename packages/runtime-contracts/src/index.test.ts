import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RUNTIME_CONTRACT_VERSION,
  validateBuildRecord,
  validatePreviewDescriptor,
  validateRuntimeOperation,
  validateRuntimeState
} from './index.ts';
test('preview descriptor rejects arbitrary and non-loopback URLs', () => {
  const base = {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    projectId: 'p',
    revisionId: 'r',
    buildId: 'b',
    url: 'http://127.0.0.1:4100/',
    origin: 'http://127.0.0.1:4100',
    issuedAt: '2026-07-28T12:00:00.000Z',
    csp: "default-src 'self'"
  };
  assert.equal(validatePreviewDescriptor(base).ok, true);
  assert.equal(
    validatePreviewDescriptor({
      ...base,
      url: 'https://example.com/',
      origin: 'https://example.com'
    }).ok,
    false
  );
});
test('operation validation reports stable property paths', () => {
  const checked = validateRuntimeOperation({ contractVersion: RUNTIME_CONTRACT_VERSION });
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.equal(checked.error.path, 'id');
});

test('runtime state validation reports the malformed revision path', () => {
  const checked = validateRuntimeState({
    contractVersion: RUNTIME_CONTRACT_VERSION,
    projects: [],
    operations: [],
    builds: [],
    revisions: [{}],
    events: []
  });
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.match(checked.error.path ?? '', /^revisions\.0\./);
});
test('architecture diagnostics preserve severity and evidence through validation', () => {
  const now = '2026-07-28T12:00:00.000Z';
  const checked = validateBuildRecord({
    contractVersion: RUNTIME_CONTRACT_VERSION,
    id: 'build:architecture',
    projectId: 'project:architecture',
    revisionId: 'revision:architecture',
    generatedProjectDigest: 'digest',
    status: 'failed',
    createdAt: now,
    updatedAt: now,
    diagnostics: [
      {
        code: 'ARCH_ROUTE_PAGE_COVERAGE',
        stage: 'review',
        severity: 'error',
        message: 'Route is unmapped.'
      }
    ],
    review: {
      status: 'revision_recommended',
      checkedAt: now,
      checks: [
        {
          id: 'ARCH_ROUTE_PAGE_COVERAGE',
          status: 'fail',
          severity: 'error',
          message: 'Route is unmapped.',
          evidence: { routeMappings: { '/field-notes': null } }
        }
      ]
    }
  });
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  assert.equal(checked.value.review?.checks[0]?.severity, 'error');
  assert.deepEqual(checked.value.review?.checks[0]?.evidence, {
    routeMappings: { '/field-notes': null }
  });
});
