import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStructuralSignature, reviewImplementation } from '@universal/design-linter';

test('detects default split heroes and horizontal navigation', () => {
  const files = [
    { path: 'page.tsx', content: '<nav><div className="brand"/><div className="nav-links"/><a className="cta"/></nav><section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>' },
    { path: 'styles.css', content: '.hero{display:grid;grid-template-columns:1.2fr .8fr}.nav{display:flex}.nav-links{margin-left:auto}' }
  ];

  const signature = extractStructuralSignature(files);
  const review = reviewImplementation(files);
  assert.equal(signature.heroArchetype, 'split-screen');
  assert.equal(signature.navigationMode, 'standard-horizontal');
  assert.ok(review.findings.some((finding) => finding.rule === 'default-split-hero'));
  assert.ok(review.findings.some((finding) => finding.rule === 'default-horizontal-navigation'));
});

test('enforces visual evidence and composition contracts', () => {
  const files = [
    { path: 'page.tsx', content: '<section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>' },
    { path: 'styles.css', content: '.hero{display:grid;grid-template-columns:1fr 1fr}' }
  ];
  const expected = { heroArchetype: 'poster', navigationMode: 'perimeter' as const, sectionSequence: ['poster', 'story'], preset: 'editorial' as const };
  const review = reviewImplementation(files, { screenshots: [{ viewport: 'desktop' }], checkedForEmptySpace: true, checkedForMissingMedia: true }, { expectedSignature: expected, recentSignatures: [expected] });

  assert.ok(review.findings.some((finding) => finding.rule === 'visual-evidence-required'));
  assert.ok(review.findings.some((finding) => finding.rule === 'composition-contract-hero-mismatch'));
  assert.ok(review.findings.some((finding) => finding.rule === 'cross-run-structural-repetition'));
});

test('flags visually empty large regions even when screenshot evidence is supplied', () => {
  const review = reviewImplementation(
    [{ path: 'styles.css', content: '.hero-diagram { min-height: 440px; }' }],
    { screenshots: [{ viewport: 'desktop' }, { viewport: 'mobile' }], checkedForEmptySpace: true, checkedForMissingMedia: true }
  );

  assert.ok(review.findings.some((finding) => finding.rule === 'likely-empty-visual-region'));
});
