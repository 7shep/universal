import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  buildConceptDevelopmentPrompt,
  buildCreativeBriefCompilationPrompt,
  buildDesignDirectionPrompt,
  buildDirectionEvaluationPrompt,
  buildInitialFactExtractionPrompt,
  buildImplementationCritiquePrompt,
  buildReactGenerationPrompt,
  buildSectionRevisionPrompt,
  buildUserRequestedCopyDraftingPrompt,
  getPrompt,
  interpolatePrompt,
  migratePromptReference,
  promptTemplates
} from './index.ts';
import { accessibilityRequirements, fixturePlan } from './fixtures.ts';

const golden = (name: string): string =>
  readFileSync(new URL(`../test-fixtures/${name}.golden.txt`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '');

const rendered = {
  'fact-extraction': buildInitialFactExtractionPrompt({
    request: 'Create a website for Northstar, a climate accounting product for manufacturers.',
    repositoryContext: 'The existing app has routes for /, /methodology, and /contact.',
    priorAnswers: ['Primary audience: operations leaders.', 'Use your judgment on imagery.']
  }),
  'copy-drafting': buildUserRequestedCopyDraftingPrompt({
    request: 'Draft the hero headline and supporting copy.',
    knownFacts: [
      'Northstar helps manufacturers understand operational carbon.',
      'The primary audience is operations leaders.'
    ],
    copyTargets: ['Hero headline', 'Hero supporting sentence'],
    constraints: ['Do not claim guaranteed emissions reductions.']
  }),
  'brief-compilation': buildCreativeBriefCompilationPrompt({
    initialRequest: 'Create a website for Northstar, a climate accounting product.',
    knownFacts: ['Audience: manufacturing operations leaders.', 'Required route: /methodology.'],
    discoveryAnswers: [
      'The first read should feel rigorous and calm.',
      'Primary action: Request an assessment.'
    ],
    draftedCopy: ['Proposed hero: See the carbon behind every operation.'],
    delegatedDecisions: ['Universal may propose the photography direction.'],
    unresolvedQuestions: ['Is customer proof approved for public use?']
  }),
  'concept-development': buildConceptDevelopmentPrompt({
    approvedBrief:
      'Northstar is a rigorous, calm climate accounting product for operations leaders.',
    conceptCount: 3,
    protectedConstraints: ['Keep /methodology in navigation.', 'Meet WCAG AA contrast.']
  }),
  'direction-evaluation': buildDirectionEvaluationPrompt({
    approvedBrief:
      'Northstar is a rigorous, calm climate accounting product for operations leaders.',
    concepts: [
      'Field Ledger: an evidence-first industrial record organized by measured layers.',
      'Carbon Atlas: a navigable territorial model of an operation.',
      'Quiet Instrument: a precise interface centered on one live material balance.'
    ]
  }),
  direction: buildDesignDirectionPrompt({
    brief: 'Create an independent architecture journal.',
    websiteType: 'Editorial archive',
    preferences: ['warm monochrome', 'large typography'],
    avoid: ['dashboard cards'],
    accessibilityRequirements,
    reducedMotionBehavior: 'Keep all content visible without entrance effects.'
  }),
  generation: buildReactGenerationPrompt({
    plan: fixturePlan,
    content: 'Issue 08 — Houses for changing climates.',
    accessibilityRequirements
  }),
  critique: buildImplementationCritiquePrompt({
    plan: fixturePlan,
    implementation: [
      { path: 'src/Hero.tsx', content: '<section id="hero"><h1>Issue 08</h1></section>' },
      {
        path: 'src/styles.css',
        content: '#hero { display: grid; grid-template-columns: repeat(12, 1fr); }'
      }
    ],
    visualEvidence: [
      '1440×900: headline crosses the center line; perimeter labels remain visible.'
    ],
    accessibilityRequirements
  }),
  revision: buildSectionRevisionPrompt({
    plan: fixturePlan,
    section: {
      id: 'index',
      purpose: 'Present the project reading index.',
      currentSource: '<section data-section-id="index">Old index</section>'
    },
    instruction: 'Make the index denser and more editorial.',
    protectedConstraints: ['Keep the perimeter navigation.', 'Do not change shared tokens.'],
    accessibilityRequirements
  })
};

for (const purpose of [
  'fact-extraction',
  'copy-drafting',
  'brief-compilation',
  'concept-development',
  'direction-evaluation',
  'direction',
  'generation',
  'critique',
  'revision'
] as const) {
  test(`${purpose} prompt matches its readable golden fixture`, () => {
    assert.equal(rendered[purpose].text, golden(purpose));
    assert.equal(rendered[purpose].purpose, purpose);
    assert.ok(rendered[purpose].outputExpectation.length > 40);
  });
}

test('registers every prompt by stable ID and semantic version', () => {
  assert.deepEqual(
    promptTemplates.map(({ id, version, purpose }) => ({ id, version, purpose })),
    [
      {
        id: 'universal.initial-fact-extraction',
        version: '1.0.0',
        purpose: 'fact-extraction'
      },
      {
        id: 'universal.user-requested-copy-drafting',
        version: '1.0.0',
        purpose: 'copy-drafting'
      },
      {
        id: 'universal.creative-brief-compilation',
        version: '1.0.0',
        purpose: 'brief-compilation'
      },
      {
        id: 'universal.concept-development',
        version: '1.0.0',
        purpose: 'concept-development'
      },
      {
        id: 'universal.direction-evaluation',
        version: '1.0.0',
        purpose: 'direction-evaluation'
      },
      { id: 'universal.design-direction', version: '1.0.0', purpose: 'direction' },
      { id: 'universal.react-generation', version: '1.0.0', purpose: 'generation' },
      { id: 'universal.implementation-critique', version: '1.0.0', purpose: 'critique' },
      { id: 'universal.section-revision', version: '1.0.0', purpose: 'revision' }
    ]
  );
  assert.equal(
    getPrompt({ id: 'universal.react-generation', version: '1.0.0' }).purpose,
    'generation'
  );
});

test('leaves high-impact question optionality to engine policy', () => {
  assert.match(
    rendered['fact-extraction'].text,
    /Never decide that a high-impact question is optional/
  );
  assert.match(rendered['brief-compilation'].text, /label any high-impact question optional/);
  assert.match(rendered['direction-evaluation'].text, /engine policy controls/);
});
test('fails explicitly for missing typed input and unresolved placeholders', () => {
  assert.throws(
    () => buildDesignDirectionPrompt({ ...renderedDirectionInput(), brief: '  ' }),
    /Missing required prompt input at brief/
  );
  assert.throws(
    () => interpolatePrompt('Hello {{name}} from {{place}}', { name: 'Ada' }),
    /missing required variable\(s\): place/
  );
  assert.throws(
    () => interpolatePrompt('Hello {{name}}', { name: '{{stillMissing}}' }),
    /unresolved placeholder\(s\): stillMissing/
  );
  assert.throws(
    () => buildReactGenerationPrompt({} as never),
    /Missing required prompt input at plan/
  );
});

test('migrates the legacy saved prompt reference and rejects unknown versions', () => {
  assert.deepEqual(migratePromptReference({ id: 'composition-contract', version: '1' }), {
    id: 'universal.react-generation',
    version: '1.0.0'
  });
  assert.throws(
    () => getPrompt({ id: 'universal.react-generation', version: '9.0.0' }),
    /Available version\(s\): 1.0.0/
  );
});

function renderedDirectionInput() {
  return {
    brief: 'Archive',
    accessibilityRequirements,
    reducedMotionBehavior: 'Keep content visible.'
  };
}
