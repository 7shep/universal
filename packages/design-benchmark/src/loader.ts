import { readFile } from 'node:fs/promises';
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

/** Load and validate a checked-in benchmark corpus without network or preview access. */
export async function loadBenchmarkDefinition(
  rootDirectory: string
): Promise<LoadedBenchmarkDefinition> {
  const suiteValue = await readJson(resolve(rootDirectory, 'suite.json'));
  const rubricValue = await readJson(resolve(rootDirectory, 'rubric.json'));
  assertBenchmarkSuiteManifest(suiteValue);
  assertBenchmarkRubricManifest(rubricValue);
  const briefPaths = [...suiteValue.briefs].sort();
  const briefs: BenchmarkBriefDefinition[] = [];
  for (const relativePath of briefPaths) {
    const candidate = resolve(rootDirectory, relativePath);
    const relativePathFromRoot = relative(resolve(rootDirectory), candidate);
    if (relativePathFromRoot.startsWith('..') || isAbsolute(relativePathFromRoot))
      throw new Error(`Brief path escapes benchmark root: ${relativePath}`);
    briefs.push((await readJson(candidate)) as BenchmarkBriefDefinition);
  }
  const definition = { suite: suiteValue, rubric: rubricValue, briefs };
  assertBenchmarkDefinition(definition);
  return definition;
}
