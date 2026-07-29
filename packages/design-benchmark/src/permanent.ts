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
export type PermanentCriterionStatus = 'passed' | 'failed' | 'not-evaluated';
export type PermanentOutcome = PermanentCriterionStatus;

const CRITERION_EVIDENCE_KINDS: Readonly<
  Record<PermanentBenchmarkCriterion, PermanentEvidenceKind>
> = {
  'visual-originality': 'subjective',
  'design-plan-v2-fidelity': 'deterministic',
  'responsive-behavior': 'deterministic',
  'route-content-completeness': 'deterministic',
  accessibility: 'deterministic',
  'repository-organization': 'deterministic',
  'build-success': 'deterministic',
  'runtime-policy-compliance': 'deterministic'
};

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
  status: PermanentCriterionStatus;
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
  /** Deterministic checks only. Subjective scores are intentionally excluded. */
  deterministicScore?: number | null | undefined;
  /** Human review evidence only; this is never used to declare a regression. */
  subjectiveScore?: number | null | undefined;
}
export interface PermanentCount {
  passed: number;
  failed: number;
  notEvaluated: number;
}
export interface PermanentBriefSummary extends PermanentCount {
  briefId: string;
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
    byCriterion: Readonly<Record<PermanentBenchmarkCriterion, PermanentCount>>;
    byOutcome: PermanentCount;
    byBrief: readonly PermanentBriefSummary[];
  };
}
export interface PermanentRegressionEntry {
  briefId: string;
  arm: string;
  baselineScore: number | null;
  currentScore: number | null;
  delta: number | null;
  status: 'improved' | 'unchanged' | 'regressed' | 'not-comparable';
  evidence: { baseline: readonly string[]; current: readonly string[] };
}
export interface PermanentRegressionReport {
  format: 'universal.design-benchmark.regression';
  formatVersion: '2';
  suiteVersion: typeof PERMANENT_BENCHMARK_VERSION;
  entries: readonly PermanentRegressionEntry[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const emptyCount = (): PermanentCount => ({ passed: 0, failed: 0, notEvaluated: 0 });
const countStatus = (count: PermanentCount, status: PermanentCriterionStatus): void => {
  if (status === 'not-evaluated') count.notEvaluated += 1;
  else count[status] += 1;
};
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort(compareText);
const nonEmptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const canonicalEvidencePath = (value: unknown): value is string =>
  nonEmptyText(value) &&
  !path.isAbsolute(value) &&
  !value.includes('\\') &&
  !value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');

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
    typeof value.contentRevision !== 'number' ||
    !Number.isSafeInteger(value.contentRevision) ||
    value.contentRevision < 1 ||
    !Array.isArray(value.briefPaths) ||
    value.briefPaths.length !== PERMANENT_CATEGORIES.length ||
    new Set(value.briefPaths).size !== value.briefPaths.length ||
    !value.briefPaths.every(canonicalEvidencePath) ||
    !Array.isArray(value.criteria) ||
    value.criteria.length !== PERMANENT_CRITERIA.length ||
    !canonicalEvidencePath(value.baselinePath)
  )
    throw new TypeError('Permanent benchmark suite manifest is invalid.');
  const criteria = value.criteria.filter(record);
  if (criteria.length !== value.criteria.length)
    throw new TypeError('Permanent benchmark criteria are invalid.');
  let totalWeight = 0;
  for (const criterion of PERMANENT_CRITERIA) {
    const item = criteria.find((candidate) => candidate.id === criterion);
    if (
      !item ||
      item.evidenceKind !== CRITERION_EVIDENCE_KINDS[criterion] ||
      typeof item.weight !== 'number' ||
      !Number.isFinite(item.weight) ||
      item.weight <= 0
    )
      throw new TypeError(`Permanent benchmark criterion is invalid: ${criterion}`);
    totalWeight += item.weight;
  }
  if (Math.abs(totalWeight - 1) > Number.EPSILON)
    throw new TypeError('Permanent benchmark criterion weights must total exactly 1.');
}
function assertBrief(value: unknown): asserts value is PermanentBenchmarkBrief {
  if (
    !record(value) ||
    !nonEmptyText(value.id) ||
    value.version !== '1.0.0' ||
    !PERMANENT_CATEGORIES.includes(value.category as PermanentBenchmarkCategory) ||
    !nonEmptyText(value.title) ||
    !nonEmptyText(value.prompt) ||
    !Array.isArray(value.approvedRoutes) ||
    value.approvedRoutes.length === 0 ||
    !value.approvedRoutes.every(
      (route) =>
        nonEmptyText(route) &&
        route.startsWith('/') &&
        !route.includes('..') &&
        !route.includes('\\') &&
        !route.includes('//')
    ) ||
    !Array.isArray(value.requirements) ||
    value.requirements.length < 3 ||
    !value.requirements.every(nonEmptyText) ||
    !Array.isArray(value.constraints) ||
    value.constraints.length < 2 ||
    !value.constraints.every(nonEmptyText) ||
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
  if (
    new Set(briefs.map((brief) => brief.id)).size !== briefs.length ||
    PERMANENT_CATEGORIES.some((category) => !categories.has(category))
  )
    throw new TypeError('Permanent benchmark must contain every required brief category.');
  const baselineText = await safeRead(root, suiteValue.baselinePath);
  const baseline: unknown = JSON.parse(baselineText);
  if (
    !record(baseline) ||
    baseline.format !== 'universal.design-benchmark.baseline' ||
    baseline.formatVersion !== '2' ||
    baseline.suiteVersion !== PERMANENT_BENCHMARK_VERSION ||
    !Array.isArray(baseline.results)
  )
    throw new TypeError('Permanent benchmark baseline manifest is invalid.');
  if (
    !nonEmptyText(baseline.status) ||
    !nonEmptyText(baseline.intent) ||
    baseline.results.length === 0
  )
    throw new TypeError('Permanent benchmark baseline manifest is incomplete.');
  const baselineBriefIds = new Set<string>();
  for (const result of baseline.results) {
    if (
      !record(result) ||
      !nonEmptyText(result.briefId) ||
      !briefs.some((brief) => brief.id === result.briefId) ||
      baselineBriefIds.has(result.briefId) ||
      (result.outcome !== 'successful' && result.outcome !== 'failed') ||
      !Array.isArray(result.evidence) ||
      result.evidence.length === 0 ||
      !result.evidence.every(canonicalEvidencePath) ||
      !nonEmptyText(result.rationale)
    )
      throw new TypeError('Permanent benchmark baseline evidence is invalid.');
    baselineBriefIds.add(result.briefId);
    for (const evidencePath of result.evidence) await safeRead(root, evidencePath);
  }
  return { suite: suiteValue, briefs, inputDigest: sha256(digestParts.join('\0')) };
}
function score(result: PermanentCaseResult, evidenceKind: PermanentEvidenceKind): number | null {
  const supplied =
    evidenceKind === 'deterministic' ? result.deterministicScore : result.subjectiveScore;
  if (supplied !== undefined) return supplied;
  const evaluated = result.criteria.filter(
    (item) => item.evidenceKind === evidenceKind && item.score !== null
  );
  return evaluated.length === 0
    ? null
    : evaluated.reduce((sum, item) => sum + (item.score ?? 0), 0) / evaluated.length;
}
function outcome(criteria: readonly PermanentCriterionResult[]): PermanentOutcome {
  if (criteria.some((item) => item.status === 'failed')) return 'failed';
  return criteria.some((item) => item.status === 'not-evaluated') ? 'not-evaluated' : 'passed';
}
function assertResult(
  result: PermanentCaseResult,
  known: ReadonlySet<string>,
  keys: Set<string>
): void {
  if (!known.has(result.briefId)) throw new Error(`Unknown benchmark brief: ${result.briefId}`);
  if (!nonEmptyText(result.arm) || !nonEmptyText(result.revisionId))
    throw new Error(`Benchmark result needs a non-empty arm and revision ID: ${result.briefId}`);
  for (const suppliedScore of [result.deterministicScore, result.subjectiveScore]) {
    if (
      suppliedScore !== undefined &&
      suppliedScore !== null &&
      (!Number.isFinite(suppliedScore) || suppliedScore < 1 || suppliedScore > 5)
    )
      throw new Error(
        `Benchmark result has an invalid aggregate score: ${result.briefId}/${result.arm}`
      );
  }
  const key = `${result.briefId}\0${result.arm}`;
  if (keys.has(key)) throw new Error(`Duplicate benchmark result: ${result.briefId}/${result.arm}`);
  keys.add(key);
  if (result.criteria.length !== PERMANENT_CRITERIA.length)
    throw new Error(
      `Benchmark result is incomplete: ${result.briefId}/${result.arm}; expected every criterion exactly once.`
    );
  const seen = new Set<PermanentBenchmarkCriterion>();
  for (const item of result.criteria) {
    if (!PERMANENT_CRITERIA.includes(item.criterion) || seen.has(item.criterion))
      throw new Error(
        `Benchmark criterion is unknown or duplicated: ${result.briefId}/${result.arm}/${item.criterion}`
      );
    seen.add(item.criterion);
    const expectedKind: PermanentEvidenceKind = CRITERION_EVIDENCE_KINDS[item.criterion];
    if (item.evidenceKind !== expectedKind)
      throw new Error(
        `Benchmark criterion evidence kind is invalid: ${result.briefId}/${result.arm}/${item.criterion}`
      );
    if (!['passed', 'failed', 'not-evaluated'].includes(item.status))
      throw new Error(
        `Benchmark criterion status is invalid: ${result.briefId}/${result.arm}/${item.criterion}`
      );
    if (item.status === 'not-evaluated' && item.score !== null)
      throw new Error(
        `Not-evaluated criterion must not have a score: ${result.briefId}/${result.arm}/${item.criterion}`
      );
    if (
      item.status !== 'not-evaluated' &&
      (!Number.isInteger(item.score) || item.score === null || item.score < 1 || item.score > 5)
    )
      throw new Error(
        `Evaluated criterion needs an integer score from 1 through 5: ${result.briefId}/${result.arm}/${item.criterion}`
      );
    if (
      !Array.isArray(item.evidence) ||
      item.evidence.some((evidencePath) => !canonicalEvidencePath(evidencePath)) ||
      !nonEmptyText(item.rationale)
    )
      throw new Error(
        `Benchmark criterion evidence and rationale are required: ${result.briefId}/${result.arm}/${item.criterion}`
      );
  }
}
function reportSummary(
  results: readonly PermanentCaseResult[]
): PermanentBenchmarkReport['summary'] {
  const byCriterion = Object.fromEntries(
    PERMANENT_CRITERIA.map((criterion) => [criterion, emptyCount()])
  ) as Record<PermanentBenchmarkCriterion, PermanentCount>;
  const byOutcome = emptyCount();
  const briefs = new Map<string, PermanentBriefSummary>();
  for (const result of results) {
    for (const item of result.criteria) countStatus(byCriterion[item.criterion], item.status);
    const resultOutcome = outcome(result.criteria);
    countStatus(byOutcome, resultOutcome);
    const brief = briefs.get(result.briefId) ?? { briefId: result.briefId, ...emptyCount() };
    countStatus(brief, resultOutcome);
    briefs.set(result.briefId, brief);
  }
  const scores = results
    .map((result) => score(result, 'deterministic'))
    .filter((value): value is number => value !== null);
  return {
    caseCount: results.length,
    deterministicFailures: results
      .flatMap((item) => item.criteria)
      .filter((item) => item.evidenceKind === 'deterministic' && item.status === 'failed').length,
    subjectivePending: results
      .flatMap((item) => item.criteria)
      .filter((item) => item.evidenceKind === 'subjective' && item.status === 'not-evaluated')
      .length,
    meanScore:
      scores.length === 0
        ? null
        : Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100,
    byCriterion,
    byOutcome,
    byBrief: [...briefs.values()].sort((left, right) => compareText(left.briefId, right.briefId))
  };
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
  for (const result of input.results) assertResult(result, known, keys);
  const results = input.results
    .map((result) => {
      const evaluated = result.criteria.filter(
        (criterion) => criterion.evidenceKind === 'deterministic' && criterion.score !== null
      );
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
      return {
        ...result,
        criteria: [...result.criteria].sort((left, right) =>
          compareText(left.criterion, right.criterion)
        ),
        aggregateScore,
        deterministicScore: aggregateScore,
        subjectiveScore: score(result, 'subjective')
      };
    })
    .sort((left, right) =>
      compareText(`${left.briefId}\0${left.arm}`, `${right.briefId}\0${right.arm}`)
    );
  return {
    format: 'universal.design-benchmark.report',
    formatVersion: '2',
    suiteVersion: PERMANENT_BENCHMARK_VERSION,
    inputDigest: input.definition.inputDigest,
    createdAt: input.createdAt,
    results,
    summary: reportSummary(results)
  };
}
function assertComparableReport(report: PermanentBenchmarkReport, label: string): void {
  if (
    !record(report) ||
    report.format !== 'universal.design-benchmark.report' ||
    report.formatVersion !== '2' ||
    report.suiteVersion !== PERMANENT_BENCHMARK_VERSION ||
    typeof report.inputDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(report.inputDigest) ||
    !Array.isArray(report.results)
  )
    throw new TypeError(
      `${label} report is malformed; expected a permanent benchmark report with format version 2 and a SHA-256 input digest.`
    );
  const keys = new Set<string>();
  const known = new Set<string>(report.results.map((item) => item.briefId));
  for (const result of report.results) assertResult(result, known, keys);
}
function assertCount(value: unknown, label: string): asserts value is PermanentCount {
  if (!record(value))
    throw new TypeError(
      `${label} is malformed; expected non-negative pass, fail, and not-evaluated counts.`
    );
  const { passed, failed, notEvaluated } = value;
  if (
    typeof passed !== 'number' ||
    typeof failed !== 'number' ||
    typeof notEvaluated !== 'number' ||
    !Number.isSafeInteger(passed) ||
    !Number.isSafeInteger(failed) ||
    !Number.isSafeInteger(notEvaluated) ||
    passed < 0 ||
    failed < 0 ||
    notEvaluated < 0
  )
    throw new TypeError(
      `${label} is malformed; expected non-negative pass, fail, and not-evaluated counts.`
    );
}
function sameCount(left: PermanentCount, right: PermanentCount): boolean {
  return (
    left.passed === right.passed &&
    left.failed === right.failed &&
    left.notEvaluated === right.notEvaluated
  );
}
function validatedSummary(report: PermanentBenchmarkReport): PermanentBenchmarkReport['summary'] {
  if (!record(report.summary))
    throw new TypeError('Benchmark summary is malformed; expected a summary object.');
  const expected = reportSummary(report.results);
  const summary = report.summary;
  if (
    summary.caseCount !== expected.caseCount ||
    summary.deterministicFailures !== expected.deterministicFailures ||
    summary.subjectivePending !== expected.subjectivePending ||
    summary.meanScore !== expected.meanScore
  )
    throw new TypeError('Benchmark summary is inconsistent with its criterion results.');
  const hasAdditiveTotals =
    summary.byCriterion !== undefined ||
    summary.byOutcome !== undefined ||
    summary.byBrief !== undefined;
  if (!hasAdditiveTotals) return expected;
  if (!record(summary.byCriterion) || !Array.isArray(summary.byBrief))
    throw new TypeError('Benchmark summary totals are malformed or incomplete.');
  assertCount(summary.byOutcome, 'Benchmark summary outcome totals');
  if (!sameCount(summary.byOutcome, expected.byOutcome))
    throw new TypeError('Benchmark summary outcome totals are inconsistent.');
  for (const criterion of PERMANENT_CRITERIA) {
    const actual = summary.byCriterion[criterion];
    assertCount(actual, `Benchmark summary criterion totals for ${criterion}`);
    if (!sameCount(actual, expected.byCriterion[criterion]))
      throw new TypeError(`Benchmark summary criterion totals are inconsistent: ${criterion}.`);
  }
  if (summary.byBrief.length !== expected.byBrief.length)
    throw new TypeError('Benchmark summary brief totals are incomplete.');
  for (let index = 0; index < expected.byBrief.length; index += 1) {
    const actual = summary.byBrief[index];
    const wanted = expected.byBrief[index]!;
    if (!actual || actual.briefId !== wanted.briefId)
      throw new TypeError('Benchmark summary brief totals are not in canonical order.');
    assertCount(actual, `Benchmark summary brief totals for ${wanted.briefId}`);
    if (!sameCount(actual, wanted))
      throw new TypeError(`Benchmark summary brief totals are inconsistent: ${wanted.briefId}.`);
  }
  return expected;
}
function changedEvidence(
  previous: PermanentCaseResult | undefined,
  current: PermanentCaseResult
): { baseline: readonly string[]; current: readonly string[] } {
  const prior = new Map(previous?.criteria.map((item) => [item.criterion, item]) ?? []);
  const changed = current.criteria.filter((item) => {
    const baseline = prior.get(item.criterion);
    return !baseline || baseline.score !== item.score || baseline.status !== item.status;
  });
  return {
    baseline: sortedUnique(changed.flatMap((item) => prior.get(item.criterion)?.evidence ?? [])),
    current: sortedUnique(changed.flatMap((item) => item.evidence))
  };
}
export function comparePermanentBenchmarkReports(
  baseline: PermanentBenchmarkReport,
  current: PermanentBenchmarkReport,
  regressionThreshold = 0.25
): PermanentRegressionReport {
  if (!Number.isFinite(regressionThreshold) || regressionThreshold < 0)
    throw new RangeError('Regression threshold must be a non-negative finite number.');
  assertComparableReport(baseline, 'Baseline');
  assertComparableReport(current, 'Current');
  if (
    baseline.suiteVersion !== current.suiteVersion ||
    baseline.inputDigest !== current.inputDigest
  )
    throw new Error(
      `Historical comparison is not comparable: suite versions and input digests must match (baseline ${baseline.suiteVersion}/${baseline.inputDigest}, current ${current.suiteVersion}/${current.inputDigest}).`
    );
  const baselineByKey = new Map(
    baseline.results.map((item) => [`${item.briefId}\0${item.arm}`, item] as const)
  );
  const currentByKey = new Map(
    current.results.map((item) => [`${item.briefId}\0${item.arm}`, item] as const)
  );
  const entries = [...new Set([...baselineByKey.keys(), ...currentByKey.keys()])]
    .sort(compareText)
    .map((key) => {
      const previous = baselineByKey.get(key);
      const item = currentByKey.get(key);
      const [briefId, arm] = key.split('\0');
      const baselineScore = previous ? score(previous, 'deterministic') : null;
      const currentScore = item ? score(item, 'deterministic') : null;
      const delta =
        baselineScore === null || currentScore === null
          ? null
          : Math.round((currentScore - baselineScore) * 100) / 100;
      return {
        briefId: briefId!,
        arm: arm!,
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
                : ('unchanged' as const),
        evidence: item
          ? changedEvidence(previous, item)
          : {
              baseline: sortedUnique(
                previous?.criteria.flatMap((criterion) => criterion.evidence) ?? []
              ),
              current: []
            }
      };
    });
  return {
    format: 'universal.design-benchmark.regression',
    formatVersion: '2',
    suiteVersion: PERMANENT_BENCHMARK_VERSION,
    entries
  };
}
const textCount = (count: PermanentCount): string =>
  `pass ${count.passed}, fail ${count.failed}, not-evaluated ${count.notEvaluated}`;
export function summarizePermanentBenchmarkReport(report: PermanentBenchmarkReport): string {
  assertComparableReport(report, 'Benchmark');
  const summary = validatedSummary(report);
  const lines = [
    `Permanent benchmark report (${report.suiteVersion})`,
    `Cases: ${summary.caseCount}; mean deterministic score: ${summary.meanScore ?? 'not-evaluated'}`,
    `Outcomes: ${textCount(summary.byOutcome)}`,
    'Criteria:'
  ];
  for (const criterion of PERMANENT_CRITERIA)
    lines.push(`- ${criterion}: ${textCount(summary.byCriterion[criterion])}`);
  lines.push('Briefs:');
  for (const brief of summary.byBrief) lines.push(`- ${brief.briefId}: ${textCount(brief)}`);
  return lines.join('\n');
}
export function summarizePermanentRegressionReport(report: PermanentRegressionReport): string {
  if (
    !record(report) ||
    report.format !== 'universal.design-benchmark.regression' ||
    report.formatVersion !== '2' ||
    !Array.isArray(report.entries)
  )
    throw new TypeError(
      'Regression report is malformed; expected permanent regression format version 2.'
    );
  const regressions = report.entries.filter((entry) => entry.status === 'regressed');
  const lines = [
    `Permanent regression report (${report.suiteVersion})`,
    `Regressions: ${regressions.length}`
  ];
  for (const entry of regressions)
    lines.push(
      `- ${entry.briefId}/${entry.arm}: ${entry.baselineScore} -> ${entry.currentScore} (${entry.delta}); baseline evidence: ${entry.evidence.baseline.join(', ') || 'none'}; current evidence: ${entry.evidence.current.join(', ') || 'none'}`
    );
  return lines.join('\n');
}
