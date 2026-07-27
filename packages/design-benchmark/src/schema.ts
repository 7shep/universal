export const BENCHMARK_DEFINITION_VERSION = '1.0.0' as const;
export const BENCHMARK_ARMS = ['unguided', 'universal_guided'] as const;

export type CorpusBenchmarkArm = (typeof BENCHMARK_ARMS)[number];
export type CorpusEvidenceKind = 'source' | 'rendered';

export interface BenchmarkSuiteManifest {
  readonly suite_id: string;
  readonly suite_version: string;
  readonly rubric_version: string;
  readonly content_revision: number;
  readonly execution_mode: 'offline_source_only';
  readonly briefs: readonly string[];
  readonly arms: readonly {
    readonly id: CorpusBenchmarkArm;
    readonly label: string;
    readonly brief_input: 'verbatim';
    readonly workflow: string;
    readonly universal_tools: string;
  }[];
  readonly pairing: { readonly required_arm_ids: readonly CorpusBenchmarkArm[] };
  readonly source_evidence: {
    readonly required: true;
    readonly network: 'disabled';
    readonly live_preview: 'disabled';
    readonly path_order: 'lexicographic';
    readonly digest: 'sha256';
  };
  readonly rendered_evidence: {
    readonly available: boolean;
    readonly missing_status: 'not_evaluable';
    readonly missing_score: null;
    readonly forbid_source_inference: true;
  };
}

export interface BenchmarkRubricDimension {
  readonly id: string;
  readonly title: string;
  readonly weight: number;
  readonly future_weight?: number;
  readonly evidence_kind: CorpusEvidenceKind;
  readonly question: string;
  readonly when_rendered_evidence_missing?: 'not_evaluable';
}

export interface BenchmarkRubricManifest {
  readonly rubric_id: string;
  readonly rubric_version: string;
  readonly statuses: readonly ['evaluable', 'not_evaluable'];
  readonly dimensions: readonly BenchmarkRubricDimension[];
  readonly aggregation: {
    readonly method: 'weighted_mean';
    readonly source_weight_sum: number;
    readonly exclude_statuses: readonly ['not_evaluable'];
  };
}

export interface BenchmarkBriefDefinition {
  readonly brief_id: string;
  readonly brief_version: string;
  readonly title: string;
  readonly surface: string;
  readonly audience: string;
  readonly scenario: string;
  readonly task: string;
  readonly content: {
    readonly brand: string;
    readonly primary_heading: string;
    readonly sections: readonly unknown[];
  };
  readonly requirements: readonly string[];
  readonly constraints: readonly string[];
  readonly evaluation_focus: readonly string[];
}

export interface LoadedBenchmarkDefinition {
  readonly suite: BenchmarkSuiteManifest;
  readonly rubric: BenchmarkRubricManifest;
  readonly briefs: readonly BenchmarkBriefDefinition[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isTextArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isText);

export function assertBenchmarkSuiteManifest(
  value: unknown
): asserts value is BenchmarkSuiteManifest {
  if (!isRecord(value)) throw new TypeError('suite must be an object.');
  for (const field of ['suite_id', 'suite_version', 'rubric_version'] as const)
    if (!isText(value[field])) throw new TypeError(`suite.${field} must be a non-empty string.`);
  if (value.execution_mode !== 'offline_source_only')
    throw new TypeError('suite.execution_mode must be offline_source_only.');
  if (!Number.isInteger(value.content_revision) || Number(value.content_revision) < 1)
    throw new TypeError('suite.content_revision must be a positive integer.');
  if (!isTextArray(value.briefs) || value.briefs.length !== 12 || new Set(value.briefs).size !== 12)
    throw new TypeError('suite.briefs must contain twelve unique paths.');
  if (!Array.isArray(value.arms)) throw new TypeError('suite.arms must be an array.');
  const armIds = value.arms.map((arm) => (isRecord(arm) ? arm.id : undefined));
  if (BENCHMARK_ARMS.some((arm) => !armIds.includes(arm)) || armIds.length !== 2)
    throw new TypeError('suite.arms must define unguided and universal_guided exactly once.');
  const source = value.source_evidence;
  if (
    !isRecord(source) ||
    source.required !== true ||
    source.network !== 'disabled' ||
    source.live_preview !== 'disabled' ||
    source.path_order !== 'lexicographic' ||
    source.digest !== 'sha256'
  )
    throw new TypeError('suite.source_evidence must be deterministic, offline, and preview-free.');
  const rendered = value.rendered_evidence;
  if (
    !isRecord(rendered) ||
    rendered.missing_status !== 'not_evaluable' ||
    rendered.missing_score !== null ||
    rendered.forbid_source_inference !== true
  )
    throw new TypeError(
      'suite.rendered_evidence must forbid source inference when renders are missing.'
    );
}

export function assertBenchmarkRubricManifest(
  value: unknown
): asserts value is BenchmarkRubricManifest {
  if (!isRecord(value) || !isText(value.rubric_id) || !isText(value.rubric_version))
    throw new TypeError('rubric id and version are required.');
  if (!Array.isArray(value.dimensions) || value.dimensions.length === 0)
    throw new TypeError('rubric.dimensions must be a non-empty array.');
  const ids = new Set<string>();
  let sourceWeight = 0;
  for (const [index, dimension] of value.dimensions.entries()) {
    if (!isRecord(dimension) || !isText(dimension.id) || !isText(dimension.title))
      throw new TypeError(`rubric.dimensions[${index}] requires id and title.`);
    if (ids.has(dimension.id)) throw new TypeError(`Duplicate rubric dimension: ${dimension.id}.`);
    ids.add(dimension.id);
    if (dimension.evidence_kind !== 'source' && dimension.evidence_kind !== 'rendered')
      throw new TypeError(`rubric dimension ${dimension.id} has an invalid evidence_kind.`);
    if (typeof dimension.weight !== 'number' || dimension.weight < 0)
      throw new TypeError(`rubric dimension ${dimension.id} has an invalid weight.`);
    if (dimension.evidence_kind === 'source') sourceWeight += dimension.weight;
    else if (dimension.weight !== 0 || dimension.when_rendered_evidence_missing !== 'not_evaluable')
      throw new TypeError(
        `Rendered dimension ${dimension.id} must be weight zero and not_evaluable.`
      );
  }
  if (Math.abs(sourceWeight - 1) > Number.EPSILON * 10)
    throw new TypeError('Source rubric dimension weights must total 1.');
}

export function assertBenchmarkBriefDefinition(
  value: unknown,
  path = 'brief'
): asserts value is BenchmarkBriefDefinition {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object.`);
  for (const field of [
    'brief_id',
    'brief_version',
    'title',
    'surface',
    'audience',
    'scenario',
    'task'
  ] as const)
    if (!isText(value[field])) throw new TypeError(`${path}.${field} must be a non-empty string.`);
  if (
    !isRecord(value.content) ||
    !isText(value.content.brand) ||
    !isText(value.content.primary_heading)
  )
    throw new TypeError(`${path}.content requires brand and primary_heading.`);
  for (const field of ['requirements', 'constraints', 'evaluation_focus'] as const)
    if (!isTextArray(value[field])) throw new TypeError(`${path}.${field} must be a string array.`);
}

export function assertBenchmarkDefinition(
  value: unknown
): asserts value is LoadedBenchmarkDefinition {
  if (!isRecord(value)) throw new TypeError('benchmark definition must be an object.');
  assertBenchmarkSuiteManifest(value.suite);
  assertBenchmarkRubricManifest(value.rubric);
  if (!Array.isArray(value.briefs) || value.briefs.length !== value.suite.briefs.length)
    throw new TypeError('Loaded briefs must match suite.briefs.');
  const ids = new Set<string>();
  value.briefs.forEach((brief, index) => {
    assertBenchmarkBriefDefinition(brief, `briefs[${index}]`);
    if (ids.has(brief.brief_id)) throw new TypeError(`Duplicate brief id: ${brief.brief_id}.`);
    ids.add(brief.brief_id);
  });
  if (value.suite.rubric_version !== value.rubric.rubric_version)
    throw new TypeError('Suite and rubric versions must match.');
}
