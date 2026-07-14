import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStructuralSignature, reviewImplementation } from '@universal/design-linter';
import type { TasteDirection } from '@universal/design-taste';

const tasteDirection = (overrides: Partial<TasteDirection> = {}): TasteDirection => ({
  profileId: 'anti-slop-craft-v1',
  profileVersion: '1.0.0',
  designThesis:
    'A precise product narrative uses typography and evidence to make one technical advantage immediately legible.',
  decisions: [
    {
      category: 'typography',
      choice: 'serif display with sans body',
      rationale: 'Display type carries identity while sans copy supports sustained reading.',
      source: 'selected-direction',
      confidence: 0.9
    },
    {
      category: 'color',
      choice: 'restrained neutral palette',
      rationale: 'Color marks hierarchy rather than decorating the category.',
      source: 'selected-direction',
      confidence: 0.9
    },
    {
      category: 'navigation',
      choice: 'embedded index',
      rationale: 'The index joins wayfinding to the content hierarchy.',
      source: 'selected-direction',
      confidence: 0.9
    }
  ],
  typographyRationale:
    'A distinctive display face contrasts with a neutral body face through family, scale, and rhythm.',
  colorRationale:
    'One accent communicates state and hierarchy against restrained neutral surfaces.',
  visualTreatmentRationale: 'Product diagrams and evidence use one precise annotated treatment.',
  navigationRationale:
    'Navigation is embedded in the reading order rather than detached from the composition.',
  motionRationale:
    'No signature motion is selected because the static hierarchy communicates the narrative clearly.',
  reducedMotionBehavior: 'No content depends on motion.',
  rejectedDefaultPatterns: ['vague copy', 'decorative gradients', 'equal cards'],
  exceptions: [],
  ...overrides
});

const completeEvidence = {
  screenshots: [{ viewport: 'desktop' }, { viewport: 'mobile' }],
  checkedForEmptySpace: true,
  checkedForMissingMedia: true
} as const;

test('detects default split heroes and horizontal navigation', () => {
  const files = [
    {
      path: 'page.tsx',
      content:
        '<nav><div className="brand"/><div className="nav-links"/><a className="cta"/></nav><section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>'
    },
    {
      path: 'styles.css',
      content:
        '.hero{display:grid;grid-template-columns:1.2fr .8fr}.nav{display:flex}.nav-links{margin-left:auto}'
    }
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
    {
      path: 'page.tsx',
      content:
        '<section className="hero"><div className="hero-copy"/><div className="hero-media"/></section>'
    },
    { path: 'styles.css', content: '.hero{display:grid;grid-template-columns:1fr 1fr}' }
  ];
  const expected = {
    heroArchetype: 'poster',
    navigationMode: 'perimeter' as const,
    sectionSequence: ['poster', 'story'],
    preset: 'editorial' as const
  };
  const review = reviewImplementation(
    files,
    {
      screenshots: [{ viewport: 'desktop' }],
      checkedForEmptySpace: true,
      checkedForMissingMedia: true
    },
    { expectedSignature: expected, recentSignatures: [expected] }
  );

  assert.ok(review.findings.some((finding) => finding.rule === 'visual-evidence-required'));
  assert.ok(
    review.findings.some((finding) => finding.rule === 'composition-contract-hero-mismatch')
  );
  assert.ok(review.findings.some((finding) => finding.rule === 'cross-run-structural-repetition'));
});

test('flags visually empty large regions even when screenshot evidence is supplied', () => {
  const review = reviewImplementation(
    [{ path: 'styles.css', content: '.hero-diagram { min-height: 440px; }' }],
    {
      screenshots: [{ viewport: 'desktop' }, { viewport: 'mobile' }],
      checkedForEmptySpace: true,
      checkedForMissingMedia: true
    }
  );

  assert.ok(review.findings.some((finding) => finding.rule === 'likely-empty-visual-region'));
});

test('generic cyber tech sample receives actionable taste warnings', () => {
  const review = reviewImplementation(
    [
      {
        path: 'page.tsx',
        content:
          '<nav><span className="brand">Cyber</span><div className="nav-links">Links</div><button className="cta">Start</button></nav><main><section className="hero"><h1>Build the Future</h1><div className="card"><div className="card">Nested</div></div><div className="card"/><div className="card"/></section></main>'
      },
      {
        path: 'styles.css',
        content:
          '.hero{background:linear-gradient(90deg,#8b5cf6,#2563eb);font-family:Inter,sans-serif}.glow-a{box-shadow:0 0 40px #8b5cf6}.glow-b{box-shadow:0 0 30px #2563eb}.cards{display:grid;grid-template-columns:repeat(3,1fr)}.card .card{border:1px solid}.fade-up{animation:fade-up 1s}.nav{display:flex}.nav-links{margin-left:auto}'
      }
    ],
    completeEvidence,
    { tasteDirection: tasteDirection() }
  );

  for (const rule of [
    'generic-vague-hero-copy',
    'unjustified-purple-blue-gradient',
    'decorative-glow-overuse',
    'repeated-card-pattern',
    'nested-card-pattern',
    'generic-horizontal-navbar',
    'generic-hover-or-motion-pattern',
    'control-spacing-review-required'
  ])
    assert.ok(
      review.findings.some((item) => item.rule === rule),
      `missing ${rule}`
    );
  assert.equal(review.status, 'revision_recommended');
  assert.ok(review.findings.every((item) => item.rationale && item.actionableFix));
  assert.ok(!review.passedPrinciples.includes('specific-copy'));
  assert.ok(!review.passedPrinciples.includes('brand-specific-color'));
});

test('deliberate dark technical direction is not penalized for its aesthetic', () => {
  const direction = tasteDirection({
    designThesis:
      'A dark systems map uses a single cyan status accent and a vertical rail to make infrastructure relationships inspectable.',
    colorRationale:
      'Near-black surfaces reduce diagram glare while cyan is reserved for live system status and focus.',
    navigationRationale:
      'A vertical rail keeps the system index visible without competing with the diagram.',
    signatureInteraction: {
      concept: 'Spatial cursor inspection',
      purpose: 'Reveal metadata for the currently inspected system node.'
    },
    motionRationale:
      'The cursor response communicates which system node owns the visible metadata and no other decorative motion is used.',
    reducedMotionBehavior:
      'Keyboard focus and a static selected state expose the same metadata without pointer-linked motion.'
  });
  const review = reviewImplementation(
    [
      {
        path: 'page.tsx',
        content:
          '<aside className="vertical-rail">System index</aside><main><h1>Trace every deployment dependency</h1><svg aria-label="Dependency graph"/><div className="custom-cursor"/></main>'
      },
      {
        path: 'styles.css',
        content:
          ':root{background:#10151b;color:#eaf0f5}.vertical-rail{color:#22d3ee}.display{font-family:Georgia,serif}.body{font-family:Inter,sans-serif}'
      }
    ],
    completeEvidence,
    { tasteDirection: direction }
  );
  assert.equal(review.status, 'pass');
});

test('static editorial minimal direction can pass', () => {
  const review = reviewImplementation(
    [
      {
        path: 'page.tsx',
        content:
          '<main><header className="masthead"><h1>Field notes from the northern watershed</h1></header><article>Observed species and seasonal changes.</article></main>'
      },
      {
        path: 'styles.css',
        content:
          '.masthead{display:grid;grid-template-columns:2fr 1fr}.masthead h1{font-family:Georgia,serif;font-size:clamp(4rem,9vw,9rem)}article{font-family:Arial,sans-serif;max-width:62ch;color:#24231f}'
      }
    ],
    completeEvidence,
    { tasteDirection: tasteDirection() }
  );
  assert.equal(review.status, 'pass');
});

test('credible exceptions suppress matching gradient, card, and navbar warnings', () => {
  const source = [
    {
      path: 'page.tsx',
      content:
        '<nav><span className="brand">Spectrum</span><div className="nav-links">Products</div><button className="primary">Compare</button></nav><section className="cards"><div className="card"/><div className="card"/><div className="card"/><div className="card"/></section>'
    },
    {
      path: 'styles.css',
      content:
        '.nav{display:flex}.nav-links{margin-left:auto}.cards{display:grid;grid-template-columns:repeat(3,1fr);background:linear-gradient(90deg,#8b5cf6,#2563eb)}.body{font-family:Inter,sans-serif}'
    }
  ];
  const evidence = {
    ...completeEvidence,
    visualObservations: [
      {
        viewport: 'desktop',
        observation: 'Primary control label is centered with balanced horizontal padding.',
        ruleIds: ['control-spacing-review-required']
      },
      {
        viewport: 'mobile',
        observation: 'Primary control retains balanced padding and a consistent 44px height.',
        ruleIds: ['control-spacing-review-required']
      }
    ]
  };
  const without = reviewImplementation(source, evidence, { tasteDirection: tasteDirection() });
  const withExceptions = reviewImplementation(source, evidence, {
    tasteDirection: tasteDirection({
      exceptions: [
        {
          pattern: 'gradient',
          rationale:
            'The spectrum encodes progression through three measurable product maturity stages.'
        },
        {
          pattern: 'card group',
          rationale:
            'The four plans are peer-level comparison options with identical fields for rapid scanning.'
        },
        {
          pattern: 'navbar',
          rationale:
            'Returning enterprise users prioritize familiar access to a dense product catalog.'
        }
      ]
    })
  });
  assert.ok(without.findings.some((item) => item.rule === 'unjustified-purple-blue-gradient'));
  assert.ok(without.findings.some((item) => item.rule === 'repeated-card-pattern'));
  assert.ok(without.findings.some((item) => item.rule === 'generic-horizontal-navbar'));
  assert.equal(withExceptions.status, 'pass');
});
