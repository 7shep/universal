import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  buildDesignDirectionPrompt,
  buildImplementationCritiquePrompt,
  buildReactGenerationPrompt,
  buildSectionRevisionPrompt,
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

for (const purpose of ['direction', 'generation', 'critique', 'revision'] as const) {
  test(`${purpose} prompt matches its readable golden fixture`, () => {
    assert.equal(rendered[purpose].text, golden(purpose));
    assert.equal(rendered[purpose].purpose, purpose);
    assert.ok(rendered[purpose].outputExpectation.length > 40);
  });
}

test('registers all four purposes by stable ID and semantic version', () => {
  assert.deepEqual(
    promptTemplates.map(({ id, version, purpose }) => ({ id, version, purpose })),
    [
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
