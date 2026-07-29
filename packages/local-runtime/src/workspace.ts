import { createHash, randomUUID } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeneratedProject } from '@universal/generation';
import { optimizeAssetManifest } from './asset-optimizer.ts';
import { RuntimeFailure } from './errors.ts';

const MAX_FILES = 96,
  MAX_FILE_BYTES = 512 * 1024,
  MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const templateRoot = fileURLToPath(new URL('../template/', import.meta.url));
export interface MaterializedFile {
  path: string;
  digest: string;
  bytes: number;
  owner: 'runtime' | 'provider';
}
export interface MaterializationRecord {
  projectId: string;
  revisionId: string;
  root: string;
  files: readonly MaterializedFile[];
  manifestDigest: string;
}
const sha256 = (content: string | Uint8Array): string =>
  createHash('sha256').update(content).digest('hex');
export function normalizeManifestPath(input: string): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0'))
    throw new RuntimeFailure('MATERIALIZATION_FAILURE', 'Manifest path must be non-empty text.', {
      path: 'path'
    });
  if (
    input.startsWith('/') ||
    input.startsWith('\\') ||
    input.startsWith('//') ||
    /^[a-zA-Z]:/.test(input) ||
    path.win32.isAbsolute(input) ||
    path.posix.isAbsolute(input)
  )
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      `Absolute, drive-qualified, and UNC paths are forbidden: ${input}`,
      { path: 'path' }
    );
  const normalized = input.replaceAll('\\', '/'),
    segments = normalized.split('/');
  if (segments.some((segment) => segment === '..'))
    throw new RuntimeFailure('MATERIALIZATION_FAILURE', `Path traversal is forbidden: ${input}`, {
      path: 'path'
    });
  if (segments.some((segment) => segment.length === 0 || segment === '.'))
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      `Path contains an ambiguous segment: ${input}`,
      { path: 'path' }
    );
  return segments.join('/');
}
function contained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}
async function rejectLinkAncestors(root: string, target: string): Promise<void> {
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new RuntimeFailure(
          'MATERIALIZATION_FAILURE',
          `Symlink, junction, or reparse ancestor is forbidden: ${current}`
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
async function listTemplateFiles(root: string, relative = ''): Promise<string[]> {
  const { readdir } = await import('node:fs/promises'),
    entries = await readdir(path.join(root, relative), { withFileTypes: true }),
    files: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new RuntimeFailure(
        'MATERIALIZATION_FAILURE',
        'Runtime template may not contain links.'
      );
    if (entry.isDirectory()) files.push(...(await listTemplateFiles(root, child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}
async function atomicWrite(
  root: string,
  relative: string,
  content: string | Uint8Array
): Promise<void> {
  const target = path.resolve(root, ...relative.split('/'));
  if (!contained(root, target))
    throw new RuntimeFailure('MATERIALIZATION_FAILURE', `Write escaped workspace: ${relative}`);
  await rejectLinkAncestors(root, target);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${randomUUID()}`;
  if (typeof content === 'string') {
    const handle = await open(temporary, 'wx');
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  } else await writeFile(temporary, content, { flag: 'wx' });
  await rename(temporary, target);
}
export async function materializeProject(input: {
  workspaceRoot: string;
  repositoryRoot: string;
  project: GeneratedProject;
}): Promise<MaterializationRecord> {
  const workspace = path.resolve(input.workspaceRoot),
    repository = path.resolve(input.repositoryRoot);
  if (workspace === repository || contained(repository, workspace))
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'Runtime workspace must be outside the repository checkout.'
    );
  await mkdir(workspace, { recursive: true });
  const workspaceReal = await realpath(workspace);
  const projectSegment = normalizeManifestPath(input.project.projectId).replaceAll(':', '_'),
    revisionSegment = normalizeManifestPath(input.project.revisionId).replaceAll(':', '_');
  if (projectSegment.includes('/') || revisionSegment.includes('/'))
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'Project and revision ids may not contain path separators.'
    );
  const parent = path.join(workspaceReal, 'projects', projectSegment, 'revisions'),
    destination = path.join(parent, revisionSegment),
    staging = path.join(parent, `.staging-${revisionSegment}-${randomUUID()}`);
  try {
    await stat(destination);
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'Revision directories are immutable and already exist.'
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const checkedAssets = await optimizeAssetManifest(input.project.assets);
  if (!checkedAssets.ok) {
    const first = checkedAssets.findings[0]!;
    throw new RuntimeFailure(
      first.code.includes('SIZE') || first.code.includes('COUNT')
        ? 'QUOTA_EXCEEDED'
        : 'MATERIALIZATION_FAILURE',
      first.message,
      { path: first.path }
    );
  }
  const providerPaths = [
      ...input.project.files.map((file) => normalizeManifestPath(file.path)),
      ...checkedAssets.assets.map((asset) => normalizeManifestPath(asset.path))
    ],
    folded = providerPaths.map((item) => item.toLocaleLowerCase('en-US'));
  if (new Set(folded).size !== folded.length)
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'Manifest contains path collisions after case folding.'
    );
  if (providerPaths.length > MAX_FILES)
    throw new RuntimeFailure('QUOTA_EXCEEDED', 'Manifest contains too many files.');
  let total = 0;
  for (const file of input.project.files) {
    const bytes = Buffer.byteLength(file.content);
    if (bytes > MAX_FILE_BYTES)
      throw new RuntimeFailure('QUOTA_EXCEEDED', `File is too large: ${file.path}`);
    total += bytes;
  }
  for (const asset of checkedAssets.assets) {
    const bytes = Buffer.from(asset.content, 'base64').byteLength;
    if (bytes > MAX_FILE_BYTES)
      throw new RuntimeFailure('QUOTA_EXCEEDED', `Asset is too large: ${asset.path}`);
    total += bytes;
  }
  if (total > MAX_TOTAL_BYTES)
    throw new RuntimeFailure('QUOTA_EXCEEDED', 'Manifest exceeds the total byte quota.');
  await rejectLinkAncestors(workspaceReal, path.join(parent, 'sentinel'));
  await mkdir(parent, { recursive: true });
  const parentReal = await realpath(parent);
  if (!contained(workspaceReal, parentReal))
    throw new RuntimeFailure(
      'MATERIALIZATION_FAILURE',
      'Project workspace escaped through a link or reparse point.'
    );
  await mkdir(staging);
  const files: MaterializedFile[] = [];
  try {
    await cp(templateRoot, staging, { recursive: true, dereference: false, errorOnExist: true });
    for (const relative of await listTemplateFiles(templateRoot)) {
      const content = await readFile(path.join(templateRoot, relative));
      files.push({
        path: relative.replaceAll('\\', '/'),
        digest: sha256(content),
        bytes: content.byteLength,
        owner: 'runtime'
      });
    }
    for (const file of input.project.files) {
      const relative = normalizeManifestPath(file.path);
      await atomicWrite(staging, relative, file.content);
      files.push({
        path: relative,
        digest: sha256(file.content),
        bytes: Buffer.byteLength(file.content),
        owner: 'provider'
      });
    }
    for (const asset of checkedAssets.assets) {
      const relative = normalizeManifestPath(asset.path),
        content = Buffer.from(asset.content, 'base64');
      await atomicWrite(staging, relative, content);
      files.push({
        path: relative,
        digest: sha256(content),
        bytes: content.byteLength,
        owner: 'provider'
      });
    }
    await atomicWrite(
      staging,
      '.universal-assets.json',
      `${JSON.stringify(checkedAssets.manifest, null, 2)}\n`
    );
    const record = {
        projectId: input.project.projectId,
        revisionId: input.project.revisionId,
        files: files.sort((a, b) => a.path.localeCompare(b.path))
      },
      manifestDigest = sha256(JSON.stringify(record));
    await atomicWrite(
      staging,
      '.universal-manifest.json',
      `${JSON.stringify({ ...record, manifestDigest }, null, 2)}\n`
    );
    await rename(staging, destination);
    return { ...record, root: destination, manifestDigest };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
export async function cleanAbandonedStaging(
  workspaceRoot: string,
  activePaths: readonly string[] = []
): Promise<number> {
  const { readdir } = await import('node:fs/promises'),
    root = path.resolve(workspaceRoot),
    active = new Set(activePaths.map((item) => path.resolve(item)));
  let removed = 0;
  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.staging-') && !active.has(target)) {
        await rm(target, { recursive: true, force: true });
        removed += 1;
      } else await walk(target);
    }
  }
  await walk(root);
  return removed;
}
