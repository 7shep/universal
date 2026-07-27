import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  assertBenchmarkDefinition,
  assertBenchmarkRubricManifest,
  assertBenchmarkSuiteManifest,
  type BenchmarkBriefDefinition,
  type LoadedBenchmarkDefinition
} from './schema.ts';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function resolveContainedFile(root: string, relativePath: string): Promise<string> {
  if (relativePath.includes('\\') || relativePath.startsWith('./'))
    throw new Error(
      `Benchmark paths must use canonical forward-slash relative paths: ${relativePath}`
    );
  const candidate = resolve(root, relativePath);
  const relativePathFromRoot = relative(root, candidate);
  if (relativePathFromRoot.startsWith('..') || isAbsolute(relativePathFromRoot))
    throw new Error(`Benchmark path escapes benchmark root: ${relativePath}`);
  let current = root;
  for (const segment of relativePath.split('/')) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error(`Benchmark paths cannot contain symlinks: ${relativePath}`);
  }
  const metadata = await lstat(candidate);
  if (!metadata.isFile()) throw new Error(`Benchmark path must be a regular file: ${relativePath}`);
  const resolvedCandidate = await realpath(candidate);
  const realRelative = relative(root, resolvedCandidate);
  if (realRelative.startsWith('..') || isAbsolute(realRelative))
    throw new Error(`Benchmark real path escapes benchmark root: ${relativePath}`);
  return resolvedCandidate;
}

/** Load and validate a checked-in benchmark corpus without network or preview access. */
export async function loadBenchmarkDefinition(
  rootDirectory: string
): Promise<LoadedBenchmarkDefinition> {
  const root = await realpath(resolve(rootDirectory));
  const suitePath = await resolveContainedFile(root, 'suite.json');
  const rubricPath = await resolveContainedFile(root, 'rubric.json');
  const suiteValue = await readJson(suitePath);
  const rubricValue = await readJson(rubricPath);
  assertBenchmarkSuiteManifest(suiteValue);
  assertBenchmarkRubricManifest(rubricValue);
  const briefPaths = [...suiteValue.briefs].sort();
  const briefs: BenchmarkBriefDefinition[] = [];
  for (const relativePath of briefPaths) {
    const candidate = await resolveContainedFile(root, relativePath);
    briefs.push((await readJson(candidate)) as BenchmarkBriefDefinition);
  }
  const definition = { suite: suiteValue, rubric: rubricValue, briefs };
  assertBenchmarkDefinition(definition);
  return definition;
}
