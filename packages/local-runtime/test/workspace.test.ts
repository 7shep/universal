import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { GeneratedProject } from '@universal/generation';
import { materializeProject, normalizeManifestPath, RuntimeFailure } from '../src/index.ts';

const project = (files: GeneratedProject['files']): GeneratedProject => ({
  contractVersion: '1.0.0',
  projectId: 'project:p',
  revisionId: 'revision:p:1',
  requestDigest: 'a'.repeat(64),
  framework: 'react-vite',
  entrypoint: 'src/main.tsx',
  files,
  assets: [],
  diagnostics: []
});
const file = (
  filePath: string,
  content = 'export default function App(){return <main />}'
): GeneratedProject['files'][number] => ({
  path: filePath,
  content,
  kind: 'react',
  digest: 'a'.repeat(64)
});
test('normalizes supported separators and rejects POSIX, Windows, UNC, and traversal forms', () => {
  assert.equal(normalizeManifestPath('src\\components\\Hero.tsx'), 'src/components/Hero.tsx');
  for (const candidate of [
    '/etc/passwd',
    'C:\\Windows\\file',
    'C:file',
    '\\\\server\\share\\file',
    '../escape',
    'src/..\\escape',
    'src//App.tsx',
    './src/App.tsx'
  ])
    assert.throws(() => normalizeManifestPath(candidate), RuntimeFailure, candidate);
});
test('materializes into an immutable runtime-owned revision with a checked-in template', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-workspace-')),
    repository = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-'));
  const record = await materializeProject({
    workspaceRoot: root,
    repositoryRoot: repository,
    project: project([
      file('src/App.tsx'),
      { ...file('src/styles.css', 'body{}'), kind: 'stylesheet' }
    ])
  });
  assert.match(
    await readFile(path.join(record.root, 'package.json'), 'utf8'),
    /universal-generated-react-project/
  );
  assert.match(
    await readFile(path.join(record.root, '.universal-manifest.json'), 'utf8'),
    /manifestDigest/
  );
  await assert.rejects(
    () =>
      materializeProject({
        workspaceRoot: root,
        repositoryRoot: repository,
        project: project([
          file('src/App.tsx'),
          { ...file('src/styles.css', 'body{}'), kind: 'stylesheet' }
        ])
      }),
    /immutable/
  );
});
test('rejects case-folding collisions independently of the host filesystem', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-workspace-')),
    repository = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-'));
  await assert.rejects(
    () =>
      materializeProject({
        workspaceRoot: root,
        repositoryRoot: repository,
        project: project([file('src/App.tsx'), file('src/app.tsx')])
      }),
    /case folding/
  );
});
test('rejects a symlink or junction escape in the project ancestry', async (context) => {
  if (process.platform === 'win32')
    context.skip(
      'Windows junction creation requires privileges not guaranteed in CI; ancestor logic is platform-independent and path forms are covered above.'
    );
  const root = await mkdtemp(path.join(os.tmpdir(), 'universal-workspace-')),
    external = await mkdtemp(path.join(os.tmpdir(), 'universal-external-')),
    repository = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-'));
  await mkdir(path.join(root, 'projects'), { recursive: true });
  await symlink(external, path.join(root, 'projects', 'project_p'), 'dir');
  await assert.rejects(
    () =>
      materializeProject({
        workspaceRoot: root,
        repositoryRoot: repository,
        project: project([file('src/App.tsx')])
      }),
    /Symlink|reparse/
  );
});

test('enforces workspace manifest file-count, per-file, and total-size quotas before writing', async () => {
  const attempt = async (files: GeneratedProject['files']) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'universal-workspace-quota-')),
      repository = await mkdtemp(path.join(os.tmpdir(), 'universal-repo-quota-'));
    return materializeProject({
      workspaceRoot: root,
      repositoryRoot: repository,
      project: project(files)
    });
  };
  const excessive = Array.from({ length: 97 }, (_, index) => file(`src/File${index}.tsx`));
  await assert.rejects(() => attempt(excessive), /too many files/);
  await assert.rejects(
    () => attempt([file('src/App.tsx', 'x'.repeat(512 * 1024 + 1))]),
    /too large/
  );
  const total = Array.from({ length: 9 }, (_, index) =>
    file(`src/Chunk${index}.tsx`, 'x'.repeat(500 * 1024))
  );
  await assert.rejects(() => attempt(total), /total byte quota/);
});
