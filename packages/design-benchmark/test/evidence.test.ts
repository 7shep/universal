import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_EVIDENCE_VERSION, collectSourceEvidence } from '../src/evidence.ts';
import { recordExecutedCheck } from '../src/checks.ts';
import {
  executedEvidenceChecks,
  renderedEvidenceReferences,
  representativeSourceFiles,
  sourceEvidencePolicy,
  sourceOnlyEvidenceInput
} from '../fixtures/evidence-fixture.ts';

test('collects stable source facts without rendered or network dependencies', () => {
  const first = collectSourceEvidence(sourceOnlyEvidenceInput);
  const second = collectSourceEvidence({
    files: [...representativeSourceFiles].reverse().map((file) => ({
      path: `./${file.path.replaceAll('/', '\\')}`,
      content: file.content.replaceAll('\n', '\r\n')
    })),
    policy: sourceEvidencePolicy,
    executedChecks: executedEvidenceChecks
  });

  assert.deepEqual(second, first);
  assert.equal(first.version, SOURCE_EVIDENCE_VERSION);
  assert.match(first.sourceDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    first.files.map((file) => file.path),
    ['src/App.tsx', 'src/styles.css']
  );
  assert.deepEqual(
    first.files.map((file) => file.language),
    ['typescript', 'css']
  );
  assert.equal(first.signals.headings.h1, 1);
  assert.equal(first.signals.landmarks.main, 1);
  assert.equal(first.signals.landmarks.nav, 1);
  assert.equal(first.signals.controls.button, 1);
  assert.equal(first.signals.media.img, 1);
  assert.equal(first.signals.imagesWithAltAttribute, 1);
  assert.equal(first.signals.imagesWithoutAltAttribute, 0);
  assert.equal(first.signals.mediaQueries, 1);
  assert.equal(first.signals.reducedMotionQueries, 1);
  assert.equal(first.signals.cssCustomPropertyDeclarations, 2);
  assert.deepEqual(
    first.checks.map((check) => check.name),
    ['build', 'static_contract']
  );
});

test('marks every visual-only criterion not evaluable without rendered evidence', () => {
  const evidence = collectSourceEvidence(sourceOnlyEvidenceInput);

  assert.equal(evidence.renderedEvidence.length, 0);
  assert.ok(evidence.visualOnly.length > 0);
  assert.ok(evidence.visualOnly.every((item) => item.status === 'not_evaluable'));
  assert.ok(evidence.visualOnly.every((item) => /not been supplied/i.test(item.reason)));
});

test('records rendered references without producing visual conclusions', () => {
  const evidence = collectSourceEvidence({
    files: representativeSourceFiles,
    renderedEvidence: [...renderedEvidenceReferences].reverse(),
    policy: sourceEvidencePolicy,
    executedChecks: executedEvidenceChecks
  });

  assert.deepEqual(
    evidence.renderedEvidence.map((item) => item.path),
    ['renders/desktop.png', 'renders/mobile.png']
  );
  assert.equal(evidence.renderedEvidence[0]?.sha256, 'a'.repeat(64));
  assert.ok(evidence.visualOnly.every((item) => item.status === 'awaiting_blind_review'));
  assert.ok(evidence.visualOnly.every((item) => !('score' in item)));
});

test('source digest changes with content but ignores caller ordering', () => {
  const baseline = collectSourceEvidence(sourceOnlyEvidenceInput);
  const changed = collectSourceEvidence({
    files: representativeSourceFiles.map((file) =>
      file.path === 'src/styles.css' ? { ...file, content: `${file.content}\nfooter {}` } : file
    ),
    policy: sourceEvidencePolicy,
    executedChecks: executedEvidenceChecks
  });

  assert.notEqual(changed.sourceDigest, baseline.sourceDigest);
  assert.equal(
    collectSourceEvidence({
      files: [...representativeSourceFiles].reverse(),
      policy: sourceEvidencePolicy,
      executedChecks: executedEvidenceChecks
    }).sourceDigest,
    baseline.sourceDigest
  );
});

test('rejects ambiguous, absolute, and escaping source paths', () => {
  assert.throws(
    () =>
      collectSourceEvidence({
        files: [
          { path: 'src/App.tsx', content: 'one' },
          { path: './src\\App.tsx', content: 'two' }
        ],
        policy: sourceEvidencePolicy,
        executedChecks: executedEvidenceChecks
      }),
    /Duplicate evidence source path/
  );
  assert.throws(
    () =>
      collectSourceEvidence({
        files: [{ path: '../outside.ts', content: '' }],
        policy: sourceEvidencePolicy,
        executedChecks: executedEvidenceChecks
      }),
    /cannot traverse/
  );
  assert.throws(
    () =>
      collectSourceEvidence({
        files: [{ path: 'C:\\outside.ts', content: '' }],
        policy: sourceEvidencePolicy,
        executedChecks: executedEvidenceChecks
      }),
    /project-relative/
  );
});

test('enforces include, ignore, and required-check policy', () => {
  assert.throws(
    () =>
      collectSourceEvidence({
        files: [{ path: 'README.md', content: 'not included' }],
        policy: sourceEvidencePolicy,
        executedChecks: executedEvidenceChecks
      }),
    /not included by policy/
  );
  assert.throws(
    () =>
      collectSourceEvidence({
        files: [{ path: 'src/debug.log', content: 'ignored' }],
        policy: { ...sourceEvidencePolicy, include: ['src/**'] },
        executedChecks: executedEvidenceChecks
      }),
    /ignored by policy/
  );
  assert.throws(
    () =>
      collectSourceEvidence({
        files: representativeSourceFiles,
        policy: sourceEvidencePolicy,
        executedChecks: [executedEvidenceChecks[0]!]
      }),
    /static_contract/
  );
});

test('rejects failed or tampered required check records', () => {
  const failed = recordExecutedCheck('build', { exitStatus: 1, stdout: '', stderr: 'failed' });
  assert.throws(
    () =>
      collectSourceEvidence({
        files: representativeSourceFiles,
        policy: sourceEvidencePolicy,
        executedChecks: [failed, executedEvidenceChecks[1]!]
      }),
    /Required evidence check failed \(1\): build/
  );
  assert.throws(
    () =>
      collectSourceEvidence({
        files: representativeSourceFiles,
        policy: sourceEvidencePolicy,
        executedChecks: [
          { ...executedEvidenceChecks[0]!, stdout: 'forged' },
          executedEvidenceChecks[1]!
        ]
      }),
    /invalid output digest/
  );
});
