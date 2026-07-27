export const BENCHMARK_DEFINITION_VERSION = '1.0.0' as const;
export const BENCHMARK_ARMS = ['unguided', 'universal_guided'] as const;

export type CorpusBenchmarkArm = (typeof BENCHMARK_ARMS)[number];
export type CorpusEvidenceKind = 'source' | 'rendered';
export type CorpusIsolationCapability =
  | 'filesystem_isolation'
  | 'process_isolation'
  | 'network_isolation'
  | 'host_isolation'
  | 'tool_isolation';

export interface BenchmarkSuiteManifest {
  readonly suite_id: string;
  readonly suite_version: string;
  readonly rubric_version: string;
  readonly content_revision: number;
  readonly execution_mode: 'offline_source_only';
  readonly execution_policy: {
    readonly budget: {
      readonly max_tokens: number;
      readonly max_milliseconds: number;
      readonly termination_grace_milliseconds: number;
    };
  };
  readonly isolation_policy: {
    readonly attestation_version: '1';
    readonly required_capabilities: readonly CorpusIsolationCapability[];
    readonly unverified_status: 'not_comparable';
  };
  readonly briefs: readonly string[];
  readonly arms: readonly {
    readonly id: CorpusBenchmarkArm;
    readonly label: string;
    readonly brief_input: 'verbatim';
    readonly workflow: string;
    readonly universal_tools: string;
  }[];
  readonly pairing: {
    readonly required_arm_ids: readonly CorpusBenchmarkArm[];
    readonly same_starter_fixture: true;
    readonly same_brief_bytes: true;
    readonly same_runtime_budget: true;
    readonly independent_workspaces: true;
  };
  readonly source_evidence: {
    readonly required: true;
    readonly network: 'disabled';
    readonly live_preview: 'disabled';
    readonly file_encoding: 'utf-8';
    readonly line_endings: 'lf';
    readonly path_order: 'lexicographic';
    readonly path_separator: '/';
    readonly ignore: readonly string[];
    readonly include: readonly string[];
    readonly digest: 'sha256';
    readonly required_checks: readonly string[];
    readonly timestamps: 'excluded';
  };
  readonly rendered_evidence: {
    readonly available: false;
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
    readonly minimum_evaluable_source_weight: number;
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
    readonly sections: readonly string[];
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
  if (value.suite_id !== 'design-quality' || !/^1\./.test(value.suite_version as string))
    throw new TypeError('suite id and version must identify design-quality v1.');
  if (value.execution_mode !== 'offline_source_only')
    throw new TypeError('suite.execution_mode must be offline_source_only.');
  const executionPolicy = value.execution_policy;
  if (
    !isRecord(executionPolicy) ||
    !isRecord(executionPolicy.budget) ||
    !Number.isInteger(executionPolicy.budget.max_tokens) ||
    Number(executionPolicy.budget.max_tokens) <= 0 ||
    !Number.isInteger(executionPolicy.budget.max_milliseconds) ||
    Number(executionPolicy.budget.max_milliseconds) <= 0 ||
    !Number.isInteger(executionPolicy.budget.termination_grace_milliseconds) ||
    Number(executionPolicy.budget.termination_grace_milliseconds) <= 0
  )
    throw new TypeError(
      'suite.execution_policy must define positive integer token and time budgets.'
    );
  const isolationPolicy = value.isolation_policy;
  const requiredIsolation = [
    'filesystem_isolation',
    'process_isolation',
    'network_isolation',
    'host_isolation',
    'tool_isolation'
  ];
  if (
    !isRecord(isolationPolicy) ||
    isolationPolicy.attestation_version !== '1' ||
    isolationPolicy.unverified_status !== 'not_comparable' ||
    !Array.isArray(isolationPolicy.required_capabilities) ||
    isolationPolicy.required_capabilities.length !== requiredIsolation.length ||
    !requiredIsolation.every((capability) =>
      (isolationPolicy.required_capabilities as unknown[]).includes(capability)
    )
  )
    throw new TypeError('suite.isolation_policy must require every v1 isolation capability.');
  if (!Number.isInteger(value.content_revision) || Number(value.content_revision) < 1)
    throw new TypeError('suite.content_revision must be a positive integer.');
  if (
    !isTextArray(value.briefs) ||
    value.briefs.length !== 12 ||
    new Set(value.briefs).size !== 12 ||
    value.briefs.some((brief) => !/^briefs\/.+\.json$/.test(brief))
  )
    throw new TypeError('suite.briefs must contain twelve unique canonical JSON paths.');
  if (!Array.isArray(value.arms)) throw new TypeError('suite.arms must be an array.');
  const armIds = value.arms.map((arm) => (isRecord(arm) ? arm.id : undefined));
  if (BENCHMARK_ARMS.some((arm) => !armIds.includes(arm)) || armIds.length !== 2)
    throw new TypeError('suite.arms must define unguided and universal_guided exactly once.');
  for (const [index, arm] of value.arms.entries()) {
    if (
      !isRecord(arm) ||
      !isText(arm.label) ||
      arm.brief_input !== 'verbatim' ||
      !isText(arm.workflow) ||
      !isText(arm.universal_tools)
    )
      throw new TypeError(`suite.arms[${index}] is incomplete.`);
  }
  const armById = new Map(value.arms.filter(isRecord).map((arm) => [arm.id, arm] as const));
  if (
    armById.get('unguided')?.workflow !== 'isolated_brief_only' ||
    armById.get('unguided')?.universal_tools !== 'not_provided' ||
    armById.get('universal_guided')?.workflow !== 'universal_design_workflow' ||
    armById.get('universal_guided')?.universal_tools !==
      'create_design_plan,get_design_rules,review_implementation'
  )
    throw new TypeError(
      'suite.arms must preserve isolated unguided and Universal-guided workflows.'
    );
  const pairing = value.pairing;
  if (
    !isRecord(pairing) ||
    !Array.isArray(pairing.required_arm_ids) ||
    pairing.required_arm_ids.length !== 2 ||
    !BENCHMARK_ARMS.every((arm) =>
      (pairing.required_arm_ids as readonly unknown[]).includes(arm)
    ) ||
    pairing.same_starter_fixture !== true ||
    pairing.same_brief_bytes !== true ||
    pairing.same_runtime_budget !== true ||
    pairing.independent_workspaces !== true
  )
    throw new TypeError('suite.pairing must require both benchmark arms.');
  const source = value.source_evidence;
  if (
    !isRecord(source) ||
    source.required !== true ||
    source.network !== 'disabled' ||
    source.live_preview !== 'disabled' ||
    source.file_encoding !== 'utf-8' ||
    source.line_endings !== 'lf' ||
    source.path_order !== 'lexicographic' ||
    source.path_separator !== '/' ||
    !isTextArray(source.include) ||
    !isTextArray(source.ignore) ||
    !isTextArray(source.required_checks) ||
    source.required_checks.length !== 3 ||
    source.required_checks[0] !== 'install_from_lockfile' ||
    source.required_checks[1] !== 'build' ||
    source.required_checks[2] !== 'static_contract' ||
    source.digest !== 'sha256' ||
    source.timestamps !== 'excluded'
  )
    throw new TypeError('suite.source_evidence must be deterministic, offline, and preview-free.');
  const blind = value.blind_scoring;
  if (
    !isRecord(blind) ||
    !Array.isArray(blind.artifact_labels) ||
    blind.artifact_labels.length !== 2 ||
    blind.artifact_labels[0] !== 'candidate_a' ||
    blind.artifact_labels[1] !== 'candidate_b' ||
    blind.assignment !== 'sha256(pair_id + scorer_seed) low-bit swap' ||
    blind.record_assignment_digest !== true ||
    blind.reveal_after_score_lock !== true
  )
    throw new TypeError('suite.blind_scoring must define deterministic hidden assignment.');
  const reports = value.reports;
  if (
    !isRecord(reports) ||
    !isRecord(reports.regression) ||
    reports.regression.compare_only_matching_versions !== true
  )
    throw new TypeError('suite.reports must require matching regression versions.');
  const rendered = value.rendered_evidence;
  if (
    !isRecord(rendered) ||
    rendered.available !== false ||
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
  if (value.rubric_id !== 'design-quality' || !/^1\./.test(value.rubric_version))
    throw new TypeError('rubric id and version must identify design-quality v1.');
  const scoreScale = value.score_scale;
  if (
    !isRecord(scoreScale) ||
    scoreScale.minimum !== 1 ||
    scoreScale.maximum !== 5 ||
    !isRecord(scoreScale.anchors) ||
    !['1', '2', '3', '4', '5'].every((anchor) =>
      isText((scoreScale.anchors as Record<string, unknown>)[anchor])
    )
  )
    throw new TypeError('rubric.score_scale must define the complete 1..5 scale.');
  if (
    !Array.isArray(value.statuses) ||
    value.statuses.length !== 2 ||
    value.statuses[0] !== 'evaluable' ||
    value.statuses[1] !== 'not_evaluable'
  )
    throw new TypeError('rubric.statuses must define evaluable and not_evaluable.');
  if (!Array.isArray(value.dimensions) || value.dimensions.length === 0)
    throw new TypeError('rubric.dimensions must be a non-empty array.');
  const ids = new Set<string>();
  let sourceWeight = 0;
  for (const [index, dimension] of value.dimensions.entries()) {
    if (
      !isRecord(dimension) ||
      !isText(dimension.id) ||
      !isText(dimension.title) ||
      !isText(dimension.question)
    )
      throw new TypeError(`rubric.dimensions[${index}] requires id and title.`);
    if (!/^[a-z][a-z0-9_]*$/.test(dimension.id))
      throw new TypeError(`Invalid rubric dimension id: ${dimension.id}.`);
    if (ids.has(dimension.id)) throw new TypeError(`Duplicate rubric dimension: ${dimension.id}.`);
    ids.add(dimension.id);
    if (dimension.evidence_kind !== 'source' && dimension.evidence_kind !== 'rendered')
      throw new TypeError(`rubric dimension ${dimension.id} has an invalid evidence_kind.`);
    if (
      typeof dimension.weight !== 'number' ||
      !Number.isFinite(dimension.weight) ||
      dimension.weight < 0 ||
      dimension.weight > 1
    )
      throw new TypeError(`rubric dimension ${dimension.id} has an invalid weight.`);
    if (dimension.evidence_kind === 'source') sourceWeight += dimension.weight;
    else if (dimension.weight !== 0 || dimension.when_rendered_evidence_missing !== 'not_evaluable')
      throw new TypeError(
        `Rendered dimension ${dimension.id} must be weight zero and not_evaluable.`
      );
  }
  if (Math.abs(sourceWeight - 1) > Number.EPSILON * 10)
    throw new TypeError('Source rubric dimension weights must total 1.');
  const aggregation = value.aggregation;
  if (
    !isRecord(aggregation) ||
    aggregation.method !== 'weighted_mean' ||
    aggregation.source_weight_sum !== 1 ||
    !Array.isArray(aggregation.exclude_statuses) ||
    aggregation.exclude_statuses.length !== 1 ||
    aggregation.exclude_statuses[0] !== 'not_evaluable' ||
    typeof aggregation.minimum_evaluable_source_weight !== 'number' ||
    aggregation.minimum_evaluable_source_weight < 0 ||
    aggregation.minimum_evaluable_source_weight > 1
  )
    throw new TypeError('rubric.aggregation is invalid.');
  if (!isRecord(value.blind_score_format))
    throw new TypeError('rubric.blind_score_format must be an object.');
}

export function assertBenchmarkBriefDefinition(
  value: unknown,
  path = 'brief'
): asserts value is BenchmarkBriefDefinition {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object.`);
  const allowedFields = new Set([
    '$schema',
    'brief_id',
    'brief_version',
    'title',
    'surface',
    'audience',
    'scenario',
    'task',
    'content',
    'requirements',
    'constraints',
    'evaluation_focus'
  ]);
  const unexpected = Object.keys(value).find((field) => !allowedFields.has(field));
  if (unexpected) throw new TypeError(`${path} contains unsupported property "${unexpected}".`);
  if (value.$schema !== undefined && typeof value.$schema !== 'string')
    throw new TypeError(`${path}.$schema must be a string.`);
  for (const field of ['title', 'audience', 'scenario', 'task'] as const)
    if (!isText(value[field])) throw new TypeError(`${path}.${field} must be a non-empty string.`);
  if (typeof value.brief_id !== 'string' || !/^dq-v1-[0-9]{2}-[a-z0-9-]+$/.test(value.brief_id))
    throw new TypeError(`${path}.brief_id does not match the v1 id format.`);
  if (value.brief_version !== '1.0.0')
    throw new TypeError(`${path}.brief_version must equal 1.0.0.`);
  if (
    typeof value.surface !== 'string' ||
    !['landing_page', 'portfolio', 'product_page', 'dashboard', 'application'].includes(
      value.surface
    )
  )
    throw new TypeError(`${path}.surface is not supported.`);
  if (
    !isRecord(value.content) ||
    typeof value.content.brand !== 'string' ||
    typeof value.content.primary_heading !== 'string' ||
    !Array.isArray(value.content.sections) ||
    value.content.sections.length < 3 ||
    !value.content.sections.every((section) => typeof section === 'string')
  )
    throw new TypeError(
      `${path}.content must include brand, heading, and at least three string sections.`
    );
  const arrays = [
    ['requirements', value.requirements, 4],
    ['constraints', value.constraints, 3],
    ['evaluation_focus', value.evaluation_focus, 2]
  ] as const;
  for (const [field, array, minimum] of arrays)
    if (
      !Array.isArray(array) ||
      array.length < minimum ||
      !array.every((item) => typeof item === 'string')
    )
      throw new TypeError(`${path}.${field} must contain at least ${minimum} strings.`);
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
