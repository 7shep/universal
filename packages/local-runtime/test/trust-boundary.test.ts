import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileDesignPlanV2 } from '@universal/design-engine';
import {
  fixtureCreativeBrief,
  fixtureSelectedDirectionEvaluation,
  serializedFixtureDesignPlanV2Draft
} from '@universal/design-engine/fixtures';
import {
  createProjectGenerationRequest,
  ReactGenerator,
  validateProviderProject,
  type GeneratedProject,
  type ReactGenerationProvider
} from '@universal/generation';
import {
  materializeProject,
  normalizeManifestPath,
  reviewGeneratedImplementation,
  RuntimeFailure
} from '../src/index.ts';

const plan = compileDesignPlanV2({
  brief: fixtureCreativeBrief,
  evaluation: fixtureSelectedDirectionEvaluation,
  providerOutput: serializedFixtureDesignPlanV2Draft,
  now: '2026-07-28T00:00:00.000Z'
});
const request = createProjectGenerationRequest({
  projectId: 'project:trust-boundary',
  revisionId: 'revision:trust-boundary:1',
  designPlan: plan
});
const source = (pathName: string, content: string, kind: 'react' | 'stylesheet' = 'react') => ({
  path: pathName,
  content,
  kind
});
const validRaw = {
  files: [
    source(
      'src/App.tsx',
      `export default function App(){return <><nav><a href="/">Home</a></nav><main><h1>Archive</h1></main></>}`
    ),
    source(
      'src/styles.css',
      ':focus-visible{outline:2px solid}@media(prefers-reduced-motion:reduce){*{animation:none}}',
      'stylesheet' as const
    )
  ]
};

test('provider boundary rejects runtime-owned files, collisions, quotas, and credential-shaped content', async () => {
  const owned = validateProviderProject(
    { ...validRaw, files: [...validRaw.files, source('package.json', '{}')] },
    request
  );
  assert.equal(owned.ok, false);
  if (!owned.ok) assert.equal(owned.error.code, 'forbidden_file');

  const collision = validateProviderProject(
    {
      ...validRaw,
      files: [...validRaw.files, source('src/app.tsx', 'export const duplicate = true')]
    },
    request
  );
  assert.equal(collision.ok, false);
  if (!collision.ok) assert.match(collision.error.message, /case folding/i);

  const perFile = validateProviderProject(
    {
      files: [source('src/App.tsx', 'x'.repeat(256 * 1024 + 1)), validRaw.files[1]]
    },
    request
  );
  assert.equal(perFile.ok, false);
  if (!perFile.ok) assert.equal(perFile.error.code, 'quota_exceeded');

  const total = validateProviderProject(
    {
      files: [
        ...validRaw.files,
        ...Array.from({ length: 9 }, (_, index) =>
          source(`src/Chunk${index}.tsx`, 'x'.repeat(240 * 1024))
        )
      ]
    },
    request
  );
  assert.equal(total.ok, false);
  if (!total.ok) assert.equal(total.error.code, 'quota_exceeded');

  const provider: ReactGenerationProvider = {
    capabilities: {
      providerId: 'credential-fixture',
      contractVersions: ['1.0.0'],
      structuredOutput: true,
      deterministic: true,
      requiresCredentials: false
    },
    async generate() {
      return {
        ...validRaw,
        files: [
          source(
            'src/App.tsx',
            `const token = "sk-${'a'.repeat(40)}"; export default function App(){return <main>{token}</main>}`
          ),
          validRaw.files[1]
        ]
      };
    }
  };
  const secret = await new ReactGenerator(provider).generate(request);
  assert.equal(secret.ok, false);
  if (!secret.ok) assert.match(secret.failure.message, /credential-shaped/i);
});

test('network access and omitted approved routes return actionable structured review findings', () => {
  const checked = validateProviderProject(
    {
      ...validRaw,
      files: [
        source(
          'src/App.tsx',
          `export default function App(){fetch("https://evil.test");return <><nav/><main><h1>Only home</h1></main></>}`
        ),
        validRaw.files[1]
      ]
    },
    request
  );
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  const homePage = request.context.pageMap.pages[0]!;
  const requestWithOmittedRoute = {
    ...request,
    context: {
      ...request.context,
      pageMap: {
        kind: 'multi-page' as const,
        pages: [
          homePage,
          {
            ...homePage,
            id: 'omitted-route',
            route: '/omitted-route',
            name: 'Omitted route',
            uniqueResponsibility: 'Exercise route coverage'
          }
        ]
      }
    }
  };
  const review = reviewGeneratedImplementation(
    checked.value,
    requestWithOmittedRoute,
    '2026-07-28T00:00:00Z'
  );
  assert.equal(review.status, 'revision_recommended');
  assert.equal(review.checks.find((item) => item.id === 'network-denial')?.status, 'fail');
  assert.equal(review.checks.find((item) => item.id === 'page-map-coverage')?.status, 'fail');
});

test('absolute and traversal paths fail before any workspace mutation', async () => {
  for (const candidate of ['/etc/passwd', 'C:\\Windows\\file', '../escape', 'src/../escape'])
    assert.throws(() => normalizeManifestPath(candidate), RuntimeFailure);
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'universal-rejected-workspace-'));
  const repository = await mkdtemp(path.join(os.tmpdir(), 'universal-rejected-repository-'));
  const project: GeneratedProject = {
    contractVersion: '1.0.0',
    projectId: 'project:trust',
    revisionId: 'revision:trust:1',
    requestDigest: 'a'.repeat(64),
    framework: 'react-vite',
    entrypoint: 'src/main.tsx',
    files: [
      {
        path: '../escape',
        content: 'escape',
        kind: 'text',
        digest: 'b'.repeat(64)
      }
    ],
    assets: [],
    diagnostics: []
  };
  await assert.rejects(
    () => materializeProject({ workspaceRoot: workspace, repositoryRoot: repository, project }),
    RuntimeFailure
  );
  assert.deepEqual(await readdir(workspace), []);
});
