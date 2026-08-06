import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getActiveTasteProfile,
  hasCredibleTasteException,
  type TasteDirection
} from '@universal/design-taste';

test('exposes the versioned default profile', () => {
  const profile = getActiveTasteProfile();
  assert.equal(profile.id, 'anti-slop-craft-v1');
  assert.ok(profile.principles.length >= 8);
  assert.ok(profile.antiPatterns.every((pattern) => pattern.allowWhen.length > 0));
});

test('includes the expanded AI-slop taxonomy', () => {
  const ids = new Set(getActiveTasteProfile().antiPatterns.map((pattern) => pattern.id));
  for (const id of [
    'gradient-text-treatment',
    'default-dark-purple-theme',
    'low-contrast-dark-theme-text',
    'glassmorphism-orb-decoration',
    'colored-card-edge',
    'template-pattern-cluster',
    'shadcn-default-fingerprint',
    'cluttered-primary-actions',
    'lazy-impact-statement',
    'redundant-interface-copy',
    'generic-font-monoculture',
    'stock-font-pairing',
    'centered-generic-sans-hero',
    'decorative-grid-background',
    'hero-eyebrow-chip',
    'meaningless-status-motion',
    'generic-marketing-cadence',
    'shape-assembled-illustration'
  ])
    assert.ok(ids.has(id), 'missing anti-pattern ' + id);
});

test('requires a matching and credible exception', () => {
  const direction = {
    exceptions: [
      {
        pattern: 'gradient',
        rationale: 'The spectrum encodes the product lifecycle from input to verified output.'
      }
    ]
  } as unknown as TasteDirection;
  assert.equal(
    hasCredibleTasteException(direction, 'unjustified-purple-blue-gradient', ['gradient']),
    true
  );
  assert.equal(
    hasCredibleTasteException(direction, 'generic-horizontal-navbar', ['navbar']),
    false
  );
});
