import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const PERMANENT_BENCHMARK_VERSION = '2.0.0' as const;
export const PERMANENT_CATEGORIES = [
  'luxury-product',
  'editorial-publication',
  'technical-developer-tool',
  'playful-consumer-brand',
  'data-heavy-dashboard',
  'multi-page-cultural-archive',
  'minimal-portfolio',
  'mobile-first-product'
] as const;
export const PERMANENT_CRITERIA = [
  'visual-originality',
  'design-plan-v2-fidelity',
  'responsive-behavior',
  'route-content-completeness',
  'accessibility',
  'repository-organization',
  'build-success',
  'runtime-policy-compliance'
] as const;

export type PermanentBenchmarkCategory = (typeof PERMANENT_CATEGORIES)[number];
export type PermanentBenchmarkCriterion = (typeof PERMANENT_CRITERIA)[number];
export type PermanentEvidenceKind = 'deterministic' | 'subjective';

export interface PermanentBenchmarkBrief {
  id: string;
  version: '1.0.0';
  category: PermanentBenchmarkCategory;
  title: string;
  prompt: string;
  approvedRoutes: readonly string[];
  requirements: readonly string[];
  constraints: readonly string[];
  mobileFirst: boolean;
}

export interface PermanentBenchmarkSuite {
  id: 'universal-design-benchmark';
  version: typeof PERMANENT_BENCHMARK_VERSION;
  contentRevision: number;
  briefPaths: readonly string[];
  criteria: readonly {
    id: PermanentBenchmarkCriterion;
    evidenceKind: PermanentEvidenceKind;
    weight: number;
  }[];
  baselinePath: string;
}

export interface PermanentBenchmarkDefinition {
  suite: PermanentBenchmarkSuite;
  briefs: readonly PermanentBenchmarkBrief[];
  inputDigest: string;
}

export interface PermanentCriterionResult {
  criterion: PermanentBenchmarkCriterion;
  evidenceKind: PermanentEvidenceKind;
  status: 'passed' | 'failed' | 'not-evaluated';
  score: number | null;
  evidence: readonly string[];
  rationale: string;
}

export interface PermanentCaseResult {
  briefId: string;
  arm: string;
  revisionId: string;
  criteria: readonly PermanentCriterionResult[];
  aggregateScore?: number | null | undefined;
}

export interface PermanentBenchmarkReport {
  format: 'universal.design-benchmark.report';
  formatVersion: '2';
  suiteVersion: typeof PERMANENT_BENCHMARK_VERSION;
  inputDigest: string;
  createdAt: string;
  results: readonly PermanentCaseResult[];
  summary: {
    caseCount: number;
    deterministicFailures: number;
    subjectivePending: number;
    meanScore: number | null;
  };
}

export interface PermanentRegressionReport {
  format: 'universal.design-benchmark.regression';
  formatVersion: '2';
  suiteVersion: typeof PERMANENT_BENCHMARK_VERSION;
  entries: readonly {
    briefId: string;
    arm: string;
    baselineScore: number | null;
    currentScore: number | null;
    delta: number | null;
    status: 'improved' | 'unchanged' | 'regressed' | 'not-comparable';
  }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

async function safeRead(root: string, relative: string): Promise<string> {
  if (
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  )
    throw new Error(`Benchmark path is not canonical: ${relative}`);
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error(`Benchmark inputs cannot contain symlinks: ${relative}`);
  }
  const resolved = await realpath(current);
  const containment = path.relative(root, resolved);
  if (containment.startsWith('..') || path.isAbsolute(containment))
    throw new Error(`Benchmark path escaped the corpus: ${relative}`);
  return readFile(resolved, 'utf8');
}

function assertSuite(value: unknown): asserts value is PermanentBenchmarkSuite {
  if (
    !record(value) ||
    value.id !== 'universal-design-benchmark' ||
    value.version !== PERMANENT_BENCHMARK_VERSION ||
    !Number.isSafeInteger(value.contentRevision) ||
    !Array.isArray(value.briefPaths) ||
    value.briefPaths.length !== PERMANENT_CATEGORIES.length ||
    new Set(value.briefPaths).size !== value.briefPaths.length ||
    !Array.isArray(value.criteria) ||
    value.criteria.length !== PERMANENT_CRITERIA.length ||
    typeof value.baselinePath !== 'string'
  )
    throw new TypeError('Permanent benchmark suite manifest is invalid.');
  const criteria = value.criteria.filter(record);
  for (const criterion of PERMANENT_CRITERIA) {
    const item = criteria.find((candidate) => candidate.id === criterion);
    if (
      !item ||
      !['deterministic', 'subjective'].includes(String(item.evidenceKind)) ||
      typeof item.weight !== 'number' ||
      item.weight <= 0
    )
      throw new TypeError(`Permanent benchmark criterion is invalid: ${criterion}`);
  }
}

function assertBrief(value: unknown): asserts value is PermanentBenchmarkBrief {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    value.version !== '1.0.0' ||
    !PERMANENT_CATEGORIES.includes(value.category as PermanentBenchmarkCategory) ||
    typeof value.title !== 'string' ||
    typeof value.prompt !== 'string' ||
    !Array.isArray(value.approvedRoutes) ||
    value.approvedRoutes.length === 0 ||
    !value.approvedRoutes.every(
      (route) => typeof route === 'string' && route.startsWith('/') && !route.includes('..')
    ) ||
    !Array.isArray(value.requirements) ||
    value.requirements.length < 3 ||
    !Array.isArray(value.constraints) ||
    value.constraints.length < 2 ||
    typeof value.mobileFirst !== 'boolean'
  )
    throw new TypeError('Permanent benchmark brief is invalid.');
}

export async function loadPermanentBenchmark(
  rootDirectory: string
): Promise<PermanentBenchmarkDefinition> {
  const root = await realpath(path.resolve(rootDirectory));
  const suiteText = await safeRead(root, 'suite.json');
  const suiteValue: unknown = JSON.parse(suiteText);
  assertSuite(suiteValue);
  const briefs: PermanentBenchmarkBrief[] = [];
  const digestParts = [`suite.json\0${suiteText}`];
  for (const briefPath of suiteValue.briefPaths) {
    const text = await safeRead(root, briefPath);
    const value: unknown = JSON.parse(text);
    assertBrief(value);
    briefs.push(value);
    digestParts.push(`${briefPath}\0${text}`);
  }
  const categories = new Set(briefs.map((brief) => brief.category));
  if (PERMANENT_CATEGORIES.some((category) => !categories.has(category)))
    throw new TypeError('Permanent benchmark must contain every required brief category.');
  await safeRead(root, suiteValue.baselinePath);
  return {
    suite: suiteValue,
    briefs,
    inputDigest: sha256(digestParts.join('\0'))
  };
}

function score(result: PermanentCaseResult): number | null {
  if (result.aggregateScore !== undefined) return result.aggregateScore;
  const evaluated = result.criteria.filter((item) => item.score !== null);
  if (evaluated.length === 0) return null;
  return evaluated.reduce((sum, item) => sum + (item.score ?? 0), 0) / evaluated.length;
}

export function createPermanentBenchmarkReport(input: {
  definition: PermanentBenchmarkDefinition;
  results: readonly PermanentCaseResult[];
  createdAt: string;
}): PermanentBenchmarkReport {
  const known = new Set(input.definition.briefs.map((brief) => brief.id));
  const weights = new Map(
    input.definition.suite.criteria.map((criterion) => [criterion.id, criterion.weight] as const)
  );
  const keys = new Set<string>();
  for (const result of input.results) {
    if (!known.has(result.briefId)) throw new Error(`Unknown benchmark brief: ${result.briefId}`);
    const key = `${result.briefId}\0${result.arm}`;
    if (keys.has(key))
      throw new Error(`Duplicate benchmark result: ${result.briefId}/${result.arm}`);
    keys.add(key);
    const criteria = new Set(result.criteria.map((item) => item.criterion));
    if (PERMANENT_CRITERIA.some((criterion) => !criteria.has(criterion)))
      throw new Error(`Benchmark result is incomplete: ${result.briefId}/${result.arm}`);
    for (const criterion of result.criteria)
      if (
        criterion.score !== null &&
        (!Number.isInteger(criterion.score) || criterion.score < 1 || criterion.score > 5)
      )
        throw new Error(`Benchmark criterion score must be an integer from 1 through 5.`);
  }
  const scoredResults = input.results.map((result) => {
    const evaluated = result.criteria.filter((criterion) => criterion.score !== null);
    const evaluatedWeight = evaluated.reduce(
      (sum, criterion) => sum + (weights.get(criterion.criterion) ?? 0),
      0
    );
    const aggregateScore =
      evaluatedWeight === 0
        ? null
        : Math.round(
            (evaluated.reduce(
              (sum, criterion) =>
                sum + (criterion.score ?? 0) * (weights.get(criterion.criterion) ?? 0),
              0
            ) /
              evaluatedWeight) *
              100
          ) / 100;
    return { ...result, aggregateScore };
  });
  const scores = scoredResults.map(score).filter((value): value is number => value !== null);
  return {
    format: 'universal.design-benchmark.report',
    formatVersion: '2',
    suiteVersion: PERMANENT_BENCHMARK_VERSION,
    inputDigest: input.definition.inputDigest,
    createdAt: input.createdAt,
    results: scoredResults.sort((left, right) =>
      `${left.briefId}/${left.arm}`.localeCompare(`${right.briefId}/${right.arm}`)
    ),
    summary: {
      caseCount: input.results.length,
      deterministicFailures: input.results
        .flatMap((item) => item.criteria)
        .filter((item) => item.evidenceKind === 'deterministic' && item.status === 'failed').length,
      subjectivePending: input.results
        .flatMap((item) => item.criteria)
        .filter((item) => item.evidenceKind === 'subjective' && item.status === 'not-evaluated')
        .length,
      meanScore:
        scores.length === 0
          ? null
          : Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100
    }
  };
}

export function comparePermanentBenchmarkReports(
  baseline: PermanentBenchmarkReport,
  current: PermanentBenchmarkReport,
  regressionThreshold = 0.25
): PermanentRegressionReport {
  if (
    baseline.suiteVersion !== current.suiteVersion ||
    baseline.inputDigest !== current.inputDigest
  )
    throw new Error('Historical comparison requires identical versioned benchmark inputs.');
  const baselineByKey = new Map(
    baseline.results.map((item) => [`${item.briefId}\0${item.arm}`, item] as const)
  );
  return {
    format: 'universal.design-benchmark.regression',
    formatVersion: '2',
    suiteVersion: PERMANENT_BENCHMARK_VERSION,
    entries: current.results.map((item) => {
      const previous = baselineByKey.get(`${item.briefId}\0${item.arm}`);
      const baselineScore = previous ? score(previous) : null;
      const currentScore = score(item);
      const delta =
        baselineScore === null || currentScore === null
          ? null
          : Math.round((currentScore - baselineScore) * 100) / 100;
      return {
        briefId: item.briefId,
        arm: item.arm,
        baselineScore,
        currentScore,
        delta,
        status:
          delta === null
            ? ('not-comparable' as const)
            : delta < -regressionThreshold
              ? ('regressed' as const)
              : delta > regressionThreshold
                ? ('improved' as const)
                : ('unchanged' as const)
      };
    })
  };
}
