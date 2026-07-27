import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_EVIDENCE_VERSION, collectSourceEvidence } from '../src/evidence.ts';
import {
  renderedEvidenceReferences,
  representativeSourceFiles,
  sourceOnlyEvidenceInput
} from '../fixtures/evidence-fixture.ts';

test('collects stable source facts without rendered or network dependencies', () => {
  const first = collectSourceEvidence(sourceOnlyEvidenceInput);
  const second = collectSourceEvidence({
    files: [...representativeSourceFiles].reverse().map((file) => ({
      path: `./${file.path.replaceAll('/', '\\')}`,
      content: file.content
    }))
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
    renderedEvidence: [...renderedEvidenceReferences].reverse()
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
    )
  });

  assert.notEqual(changed.sourceDigest, baseline.sourceDigest);
  assert.equal(
    collectSourceEvidence({ files: [...representativeSourceFiles].reverse() }).sourceDigest,
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
        ]
      }),
    /Duplicate evidence source path/
  );
  assert.throws(
    () => collectSourceEvidence({ files: [{ path: '../outside.ts', content: '' }] }),
    /cannot traverse/
  );
  assert.throws(
    () => collectSourceEvidence({ files: [{ path: 'C:\\outside.ts', content: '' }] }),
    /project-relative/
  );
});
