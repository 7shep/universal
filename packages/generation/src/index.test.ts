import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import {
  createProjectGenerationRequest,
  DeterministicReactProvider,
  ReactGenerator,
  validateProjectGenerationRequest,
  validateProviderProject
} from './index.ts';

const fixturePlan = () =>
  compileDesignPlanV2({
    brief: fixtureCreativeBrief,
    evaluation: fixtureSelectedDirectionEvaluation,
    providerOutput: serializedFixtureDesignPlanV2Draft,
    now: '2026-07-28T12:10:00.000Z'
  });
test('generation request binds approved artifacts and rejects stale approval', () => {
  const request = createProjectGenerationRequest({
    projectId: 'project:folio',
    revisionId: 'revision:folio:1',
    designPlan: fixturePlan()
  });
  assert.equal(validateProjectGenerationRequest(request).ok, true);
  const checked = validateProjectGenerationRequest({
    ...request,
    brief: { ...request.brief, approvalDigest: '0'.repeat(64) }
  });
  assert.equal(checked.ok, false);
  if (!checked.ok) {
    assert.equal(checked.error.code, 'stale_artifact');
    assert.equal(checked.error.path, 'brief.approvalDigest');
  }
});
test('provider cannot replace runtime-owned files', async () => {
  const provider = new DeterministicReactProvider();
  const generator = new ReactGenerator({
    ...provider,
    generate: async () => ({
      files: [
        { path: 'package.json', content: '{}', kind: 'text' },
        { path: 'src/App.tsx', content: 'export default function App(){}', kind: 'react' },
        { path: 'src/styles.css', content: '', kind: 'stylesheet' }
      ]
    })
  });
  const result = await generator.generate(
    createProjectGenerationRequest({
      projectId: 'project:folio',
      revisionId: 'revision:folio:1',
      designPlan: fixturePlan()
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.diagnostics[0]?.code, 'forbidden_file');
});
test('deterministic generator emits complete semantic React source', async () => {
  const result = await new ReactGenerator(new DeterministicReactProvider()).generate(
    createProjectGenerationRequest({
      projectId: 'project:folio',
      revisionId: 'revision:folio:1',
      designPlan: fixturePlan()
    })
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.project.files.map((file) => file.path),
    ['src/App.tsx', 'src/styles.css']
  );
  const app = result.project.files[0]!.content;
  const css = result.project.files[1]!.content;
  assert.match(app, /<nav aria-label="Primary">/);
  assert.match(app, /\/keyboards\/monolith-75/);
  assert.match(css, /prefers-reduced-motion/);
});

test('provider failures redact credential-shaped values from messages', async () => {
  const secret = 'sk-test-super-secret-value';
  const provider = new DeterministicReactProvider();
  const generator = new ReactGenerator(
    {
      capabilities: provider.capabilities,
      generate: async () => {
        throw new Error(`Authorization: Bearer ${secret}`);
      }
    },
    [secret]
  );
  const result = await generator.generate(
    createProjectGenerationRequest({
      projectId: 'project:folio',
      revisionId: 'revision:folio:secret',
      designPlan: fixturePlan()
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.doesNotMatch(result.failure.message, /super-secret/);
    assert.match(result.failure.message, /REDACTED/);
  }
});

test('generation contract validator rejects malformed and forged bindings with stable paths', () => {
  const request = createProjectGenerationRequest({
    projectId: 'project:folio',
    revisionId: 'revision:folio:contract',
    designPlan: fixturePlan()
  });
  const cases: readonly [unknown, string][] = [
    [null, '$'],
    [{ ...request, contractVersion: '0.0.0' }, 'contractVersion'],
    [{ ...request, projectId: '' }, 'projectId'],
    [{ ...request, plan: { ...request.plan, digest: 'forged-plan-digest' } }, 'plan.digest'],
    [{ ...request, direction: { ...request.direction, id: 'direction:forged' } }, 'direction.id'],
    [{ ...request, context: { ...request.context, pageMap: { pages: [] } } }, 'context.pageMap']
  ];
  for (const [value, path] of cases) {
    const checked = validateProjectGenerationRequest(value);
    assert.equal(checked.ok, false, path);
    if (!checked.ok) assert.equal(checked.error.path, path);
  }
});

test('provider validation rejects schema violations, quotas, collisions, and unexpected binary payloads', () => {
  const request = createProjectGenerationRequest({
    projectId: 'project:folio',
    revisionId: 'revision:folio:provider-adversarial',
    designPlan: fixturePlan()
  });
  const app = {
    path: 'src/App.tsx',
    content: 'export default function App(){return <main/>}',
    kind: 'react'
  };
  const css = { path: 'src/styles.css', content: ':focus-visible{}', kind: 'stylesheet' };
  const cases: readonly [string, unknown, string][] = [
    ['missing files', {}, 'provider_schema_violation'],
    ['malformed file', { files: [{ ...app, content: 42 }, css] }, 'provider_schema_violation'],
    [
      'excessive files',
      {
        files: Array.from({ length: 65 }, (_, index) => ({ ...app, path: `src/File${index}.tsx` }))
      },
      'quota_exceeded'
    ],
    [
      'oversized file',
      { files: [{ ...app, content: 'x'.repeat(256 * 1024 + 1) }, css] },
      'quota_exceeded'
    ],
    ['case collision', { files: [app, { ...app, path: 'src/app.tsx' }, css] }, 'forbidden_file'],
    [
      'unexpected binary file',
      { files: [{ ...app, content: new Uint8Array([0, 1, 2]) }, css] },
      'provider_schema_violation'
    ],
    [
      'unexpected binary media type',
      {
        files: [app, css],
        assets: [
          {
            path: 'src/assets/payload.bin',
            mediaType: 'application/octet-stream',
            encoding: 'base64',
            content: 'AAEC'
          }
        ]
      },
      'provider_schema_violation'
    ],
    [
      'excessive assets',
      {
        files: [app, css],
        assets: Array.from({ length: 17 }, (_, index) => ({
          path: `src/assets/${index}.png`,
          mediaType: 'image/png',
          encoding: 'base64',
          content: 'AA=='
        }))
      },
      'quota_exceeded'
    ]
  ];
  for (const [label, value, code] of cases) {
    const checked = validateProviderProject(value, request);
    assert.equal(checked.ok, false, label);
    if (!checked.ok) assert.equal(checked.error.code, code, label);
  }
});
test('provider output is rejected when source or decoded assets contain secrets', async () => {
  const secret = 'sk-output-secret-123456789';
  const provider = new DeterministicReactProvider();
  const generator = new ReactGenerator(
    {
      capabilities: provider.capabilities,
      generate: async () => ({
        files: [
          {
            path: 'src/App.tsx',
            content: `export default function App(){return <main>${secret}</main>}`,
            kind: 'react'
          },
          { path: 'src/styles.css', content: ':focus-visible{}', kind: 'stylesheet' }
        ]
      })
    },
    [secret]
  );
  const result = await generator.generate(
    createProjectGenerationRequest({
      projectId: 'project:folio',
      revisionId: 'revision:folio:leak',
      designPlan: fixturePlan()
    })
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.diagnostics[0]?.code, 'SECRET_LEAK');
    assert.doesNotMatch(JSON.stringify(result), /output-secret/);
  }
});
