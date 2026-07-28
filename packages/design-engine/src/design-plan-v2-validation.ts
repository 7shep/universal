import { failure, success, type Result } from '@universal/shared';
import { validatePageMap } from './discovery-validation.ts';
import {
  DESIGN_PLAN_V2_VERSION,
  DIRECTION_EVALUATION_VERSION,
  type DesignPlanV2,
  type DesignPlanV2Draft,
  type DesignPlanV2ValidationError,
  type PlanDecisionProvenance,
  type ResponsiveTarget,
  type SelectedDirectionEvaluation,
  type TraceableDecision
} from './design-plan-v2-contracts.ts';
import { digestDesignPlanV2, digestDirectionEvaluation } from './design-plan-v2-digests.ts';

type Validation<T> = Result<T, DesignPlanV2ValidationError>;
type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);
const invalid = (path: string, message: string): Validation<never> => failure({ path, message });

function exactKeys(
  value: RecordValue,
  expected: readonly string[],
  path: string
): DesignPlanV2ValidationError | undefined {
  const expectedSet = new Set(expected);
  const unknown = Object.keys(value).find((key) => !expectedSet.has(key));
  if (unknown) return { path: `${path}.${unknown}`, message: 'Unknown field is not allowed.' };
  const missing = expected.find((key) => !(key in value));
  if (missing) return { path: `${path}.${missing}`, message: 'Required field is missing.' };
  return undefined;
}

function validateStringRecord(
  value: unknown,
  fields: readonly string[],
  path: string
): DesignPlanV2ValidationError | undefined {
  if (!isRecord(value)) return { path, message: 'Must be an object.' };
  const keys = exactKeys(value, fields, path);
  if (keys) return keys;
  const missing = fields.find((field) => !nonEmpty(value[field]));
  return missing
    ? { path: `${path}.${missing}`, message: 'Must be a non-empty string.' }
    : undefined;
}

function validateTraceable(
  value: unknown,
  path: string,
  validateValue: (value: unknown, path: string) => DesignPlanV2ValidationError | undefined
): DesignPlanV2ValidationError | undefined {
  if (!isRecord(value)) return { path, message: 'Decision must be an object.' };
  const keys = exactKeys(value, ['value', 'rationale', 'provenanceIds'], path);
  if (keys) return keys;
  if (!nonEmpty(value.rationale))
    return { path: `${path}.rationale`, message: 'A concrete rationale is required.' };
  if (!stringArray(value.provenanceIds) || value.provenanceIds.length === 0)
    return {
      path: `${path}.provenanceIds`,
      message: 'At least one provenance reference is required.'
    };
  return validateValue(value.value, `${path}.value`);
}

const stringValue = (value: unknown, path: string) =>
  nonEmpty(value) ? undefined : { path, message: 'Must be a non-empty string.' };

function validatePageNarrative(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length === 0)
    return { path, message: 'Page narrative must contain at least one page.' };
  for (const [index, page] of value.entries()) {
    const error = validateStringRecord(
      page,
      ['pageId', 'role', 'entryState', 'exitState'],
      `${path}.${index}`
    );
    if (error) return error;
  }
  return undefined;
}

function validateNavigation(value: unknown, path: string) {
  return validateStringRecord(
    value,
    ['mode', 'hierarchy', 'desktopBehavior', 'mobileBehavior', 'relationshipToHero'],
    path
  );
}

function validateComposition(value: unknown, path: string) {
  if (!isRecord(value)) return { path, message: 'Composition signature must be an object.' };
  const keys = exactKeys(
    value,
    ['layoutFamily', 'heroStrategy', 'gridStrategy', 'rhythm', 'sectionSequence'],
    path
  );
  if (keys) return keys;
  for (const field of ['layoutFamily', 'heroStrategy', 'gridStrategy', 'rhythm'])
    if (!nonEmpty(value[field]))
      return { path: `${path}.${field}`, message: 'Must be a non-empty string.' };
  if (!stringArray(value.sectionSequence) || value.sectionSequence.length === 0)
    return {
      path: `${path}.sectionSequence`,
      message: 'Composition requires a non-empty section sequence.'
    };
  return undefined;
}

function validateTypography(value: unknown, path: string) {
  if (!isRecord(value)) return { path, message: 'Typography system must be an object.' };
  const keys = exactKeys(value, ['display', 'body', 'roles', 'scaleStrategy'], path);
  if (keys) return keys;
  for (const field of ['display', 'body', 'scaleStrategy'])
    if (!nonEmpty(value[field]))
      return { path: `${path}.${field}`, message: 'Must be a non-empty string.' };
  if (!stringArray(value.roles) || value.roles.length === 0)
    return { path: `${path}.roles`, message: 'Typography roles are required.' };
  return undefined;
}

function validateColor(value: unknown, path: string) {
  if (!isRecord(value)) return { path, message: 'Color system must be an object.' };
  const keys = exactKeys(value, ['roles', 'contrastStrategy'], path);
  if (keys) return keys;
  if (!nonEmpty(value.contrastStrategy))
    return { path: `${path}.contrastStrategy`, message: 'Contrast strategy is required.' };
  if (!Array.isArray(value.roles) || value.roles.length < 3)
    return { path: `${path}.roles`, message: 'At least three color roles are required.' };
  for (const [index, role] of value.roles.entries()) {
    const error = validateStringRecord(role, ['role', 'value', 'usage'], `${path}.roles.${index}`);
    if (error) return error;
  }
  return undefined;
}

function validateResponsive(value: unknown, path: string) {
  if (!Array.isArray(value))
    return { path, message: 'Responsive transformations must be an array.' };
  const targets = new Set<ResponsiveTarget>();
  const supported = new Set<ResponsiveTarget>([
    'navigation',
    'hero',
    'sections',
    'typography',
    'imagery'
  ]);
  for (const [index, transformation] of value.entries()) {
    if (!isRecord(transformation))
      return { path: `${path}.${index}`, message: 'Transformation must be an object.' };
    const keys = exactKeys(
      transformation,
      ['target', 'desktop', 'mobile', 'preserve'],
      `${path}.${index}`
    );
    if (keys) return keys;
    if (!supported.has(transformation.target as ResponsiveTarget))
      return { path: `${path}.${index}.target`, message: 'Responsive target is invalid.' };
    if (targets.has(transformation.target as ResponsiveTarget))
      return { path: `${path}.${index}.target`, message: 'Responsive targets must be unique.' };
    targets.add(transformation.target as ResponsiveTarget);
    for (const field of ['desktop', 'mobile', 'preserve'])
      if (!nonEmpty(transformation[field]))
        return { path: `${path}.${index}.${field}`, message: 'Must be a non-empty string.' };
  }
  for (const target of supported)
    if (!targets.has(target))
      return { path, message: `Responsive transformation for ${target} is required.` };
  return undefined;
}

function validateMotion(value: unknown, path: string) {
  if (!isRecord(value)) return { path, message: 'Motion strategy must be an object.' };
  const keys = exactKeys(value, ['principles', 'reducedMotion'], path);
  if (keys) return keys;
  if (!stringArray(value.principles) || value.principles.length === 0)
    return { path: `${path}.principles`, message: 'Motion principles are required.' };
  if (!nonEmpty(value.reducedMotion))
    return { path: `${path}.reducedMotion`, message: 'Reduced-motion behavior is required.' };
  return undefined;
}

function validateDraftArrays(value: RecordValue): DesignPlanV2ValidationError | undefined {
  if (!Array.isArray(value.sectionIntentions) || value.sectionIntentions.length === 0)
    return { path: 'sectionIntentions', message: 'Section intentions are required.' };
  for (const [index, section] of value.sectionIntentions.entries()) {
    if (!isRecord(section))
      return { path: `sectionIntentions.${index}`, message: 'Must be an object.' };
    const keys = exactKeys(
      section,
      [
        'id',
        'pageId',
        'requiredSection',
        'intention',
        'contentRequirements',
        'rationale',
        'provenanceIds'
      ],
      `sectionIntentions.${index}`
    );
    if (keys) return keys;
    for (const field of ['id', 'pageId', 'requiredSection', 'intention', 'rationale'])
      if (!nonEmpty(section[field]))
        return { path: `sectionIntentions.${index}.${field}`, message: 'Required.' };
    for (const field of ['contentRequirements', 'provenanceIds'])
      if (!stringArray(section[field]) || section[field].length === 0)
        return {
          path: `sectionIntentions.${index}.${field}`,
          message: 'Must contain non-empty strings.'
        };
  }

  if (!Array.isArray(value.protectedInvariants) || value.protectedInvariants.length === 0)
    return { path: 'protectedInvariants', message: 'Protected invariants are required.' };
  const areas = new Set<string>();
  for (const [index, invariant] of value.protectedInvariants.entries()) {
    if (!isRecord(invariant))
      return { path: `protectedInvariants.${index}`, message: 'Must be an object.' };
    const keys = exactKeys(
      invariant,
      ['id', 'area', 'statement', 'rationale', 'provenanceIds'],
      `protectedInvariants.${index}`
    );
    if (keys) return keys;
    if (!['page', 'navigation', 'hero', 'brand', 'content'].includes(String(invariant.area)))
      return { path: `protectedInvariants.${index}.area`, message: 'Invariant area is invalid.' };
    areas.add(String(invariant.area));
    for (const field of ['id', 'statement', 'rationale'])
      if (!nonEmpty(invariant[field]))
        return { path: `protectedInvariants.${index}.${field}`, message: 'Required.' };
    if (!stringArray(invariant.provenanceIds) || invariant.provenanceIds.length === 0)
      return {
        path: `protectedInvariants.${index}.provenanceIds`,
        message: 'Invariant provenance is required.'
      };
  }
  for (const area of ['page', 'navigation', 'hero', 'brand', 'content'])
    if (!areas.has(area))
      return {
        path: 'protectedInvariants',
        message: `A protected invariant for ${area} is required.`
      };

  for (const [field, keys] of [
    ['assumptions', ['id', 'statement', 'impact', 'provenanceIds']],
    ['delegatedDecisions', ['id', 'scope', 'guardrails', 'provenanceIds']]
  ] as const) {
    if (!Array.isArray(value[field])) return { path: field, message: 'Must be an array.' };
    for (const [index, item] of value[field].entries()) {
      if (!isRecord(item)) return { path: `${field}.${index}`, message: 'Must be an object.' };
      const keyError = exactKeys(item, keys, `${field}.${index}`);
      if (keyError) return keyError;
      if (!nonEmpty(item.id))
        return { path: `${field}.${index}.id`, message: 'Identifier is required.' };
      if (!stringArray(item.provenanceIds) || item.provenanceIds.length === 0)
        return { path: `${field}.${index}.provenanceIds`, message: 'Provenance is required.' };
      if (field === 'assumptions') {
        if (!nonEmpty(item.statement))
          return { path: `${field}.${index}.statement`, message: 'Statement is required.' };
        if (!['low', 'medium', 'high'].includes(String(item.impact)))
          return { path: `${field}.${index}.impact`, message: 'Impact is invalid.' };
      } else {
        if (!nonEmpty(item.scope))
          return { path: `${field}.${index}.scope`, message: 'Scope is required.' };
        if (!stringArray(item.guardrails) || item.guardrails.length === 0)
          return { path: `${field}.${index}.guardrails`, message: 'Guardrails are required.' };
      }
    }
  }
  return undefined;
}

function validateProvenance(value: RecordValue): DesignPlanV2ValidationError | undefined {
  if (!Array.isArray(value.decisionProvenance) || value.decisionProvenance.length === 0)
    return { path: 'decisionProvenance', message: 'Decision provenance is required.' };
  const provenance = new Map<string, PlanDecisionProvenance>();
  for (const [index, item] of value.decisionProvenance.entries()) {
    if (!isRecord(item))
      return { path: `decisionProvenance.${index}`, message: 'Must be an object.' };
    const keys = exactKeys(
      item,
      ['id', 'sourceKind', 'sourceId', 'evidence', 'approved'],
      `decisionProvenance.${index}`
    );
    if (keys) return keys;
    if (!nonEmpty(item.id) || !nonEmpty(item.sourceId) || !nonEmpty(item.evidence))
      return { path: `decisionProvenance.${index}`, message: 'Provenance is incomplete.' };
    if (
      ![
        'user-decision',
        'supplied-evidence',
        'approved-assumption',
        'universal-recommendation'
      ].includes(String(item.sourceKind))
    )
      return { path: `decisionProvenance.${index}.sourceKind`, message: 'Source kind is invalid.' };
    if (item.approved !== true)
      return {
        path: `decisionProvenance.${index}.approved`,
        message: 'Unapproved provenance cannot cross the compiler trust boundary.'
      };
    if (provenance.has(item.id as string))
      return { path: `decisionProvenance.${index}.id`, message: 'Provenance ids must be unique.' };
    provenance.set(item.id as string, item as unknown as PlanDecisionProvenance);
  }

  const references: { path: string; ids: readonly string[] }[] = [];
  for (const field of [
    'conceptSpine',
    'emotionalObjective',
    'pageNarrative',
    'navigationSignature',
    'compositionSignature',
    'typographySystem',
    'colorSystem',
    'imageryDirection',
    'iconographyDirection',
    'responsiveTransformations',
    'motionStrategy',
    'prohibitedPatterns'
  ]) {
    const decision = value[field] as TraceableDecision<unknown>;
    references.push({ path: `${field}.provenanceIds`, ids: decision.provenanceIds });
  }
  for (const field of [
    'sectionIntentions',
    'protectedInvariants',
    'assumptions',
    'delegatedDecisions'
  ])
    for (const [index, item] of (value[field] as { provenanceIds: readonly string[] }[]).entries())
      references.push({ path: `${field}.${index}.provenanceIds`, ids: item.provenanceIds });

  for (const reference of references)
    for (const id of reference.ids)
      if (!provenance.has(id))
        return { path: reference.path, message: `Unknown provenance id: ${id}.` };

  for (const [index, assumption] of (
    value.assumptions as { provenanceIds: readonly string[] }[]
  ).entries())
    if (
      !assumption.provenanceIds.every(
        (id) => provenance.get(id)?.sourceKind === 'approved-assumption'
      )
    )
      return {
        path: `assumptions.${index}.provenanceIds`,
        message: 'Assumptions must trace only to approved assumptions.'
      };
  return undefined;
}

export function validateDesignPlanV2Draft(value: unknown): Validation<DesignPlanV2Draft> {
  if (!isRecord(value)) return invalid('$', 'Design Plan v2 draft must be an object.');
  const expected = [
    'conceptSpine',
    'emotionalObjective',
    'pageNarrative',
    'navigationSignature',
    'compositionSignature',
    'sectionIntentions',
    'typographySystem',
    'colorSystem',
    'imageryDirection',
    'iconographyDirection',
    'responsiveTransformations',
    'motionStrategy',
    'protectedInvariants',
    'prohibitedPatterns',
    'assumptions',
    'delegatedDecisions',
    'decisionProvenance'
  ];
  const keys = exactKeys(value, expected, '$');
  if (keys) return failure(keys);
  for (const [field, validator] of [
    ['conceptSpine', stringValue],
    ['emotionalObjective', stringValue],
    ['pageNarrative', validatePageNarrative],
    ['navigationSignature', validateNavigation],
    ['compositionSignature', validateComposition],
    ['typographySystem', validateTypography],
    ['colorSystem', validateColor],
    [
      'imageryDirection',
      (item: unknown, path: string) =>
        validateStringRecord(item, ['subject', 'treatment', 'sourcing', 'accessibility'], path)
    ],
    [
      'iconographyDirection',
      (item: unknown, path: string) =>
        validateStringRecord(item, ['style', 'usage', 'accessibility'], path)
    ],
    ['responsiveTransformations', validateResponsive],
    ['motionStrategy', validateMotion],
    [
      'prohibitedPatterns',
      (item: unknown, path: string) =>
        stringArray(item) && item.length > 0
          ? undefined
          : { path, message: 'Prohibited patterns are required.' }
    ]
  ] as const) {
    const error = validateTraceable(value[field], field, validator);
    if (error) return failure(error);
  }
  const arrayError = validateDraftArrays(value);
  if (arrayError) return failure(arrayError);
  const provenanceError = validateProvenance(value);
  if (provenanceError) return failure(provenanceError);
  return success(value as unknown as DesignPlanV2Draft);
}

export function parseDesignPlanV2Draft(serialized: string): Validation<DesignPlanV2Draft> {
  try {
    return validateDesignPlanV2Draft(JSON.parse(serialized));
  } catch (error) {
    return invalid('$', `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateSelectedDirectionEvaluation(
  value: unknown
): Validation<SelectedDirectionEvaluation> {
  if (!isRecord(value)) return invalid('$', 'Direction evaluation must be an object.');
  const keys = exactKeys(
    value,
    [
      'contractVersion',
      'id',
      'status',
      'briefId',
      'briefVersion',
      'briefDigest',
      'selectedDirection',
      'rationale',
      'score',
      'unresolvedDependencies',
      'evaluatedAt',
      'digest'
    ],
    '$'
  );
  if (keys) return failure(keys);
  if (value.contractVersion !== DIRECTION_EVALUATION_VERSION)
    return invalid('contractVersion', 'Unsupported direction evaluation version.');
  if (value.status !== 'selected') return invalid('status', 'Direction must be selected.');
  for (const field of ['id', 'briefId', 'briefDigest', 'rationale', 'evaluatedAt', 'digest'])
    if (!nonEmpty(value[field])) return invalid(field, `${field} is required.`);
  if (!Number.isSafeInteger(value.briefVersion) || Number(value.briefVersion) < 1)
    return invalid('briefVersion', 'Brief version must be a positive integer.');
  if (typeof value.score !== 'number' || value.score < 0 || value.score > 1)
    return invalid('score', 'Evaluation score must be between zero and one.');
  if (!Array.isArray(value.unresolvedDependencies) || !stringArray(value.unresolvedDependencies))
    return invalid('unresolvedDependencies', 'Unresolved dependencies must be a string array.');
  if (value.unresolvedDependencies.length > 0)
    return invalid(
      'unresolvedDependencies',
      'A selected direction cannot have unresolved dependencies.'
    );
  const directionError = validateStringRecord(
    value.selectedDirection,
    ['id', 'label', 'conceptSpine', 'emotionalObjective', 'recommendation'],
    'selectedDirection'
  );
  if (directionError) return failure(directionError);
  const { digest, ...unsigned } = value;
  if (
    digestDirectionEvaluation(
      unsigned as unknown as Omit<SelectedDirectionEvaluation, 'digest'>
    ) !== digest
  )
    return invalid('digest', 'Direction evaluation digest does not match its content.');
  return success(value as unknown as SelectedDirectionEvaluation);
}

function validatePageCoverage(plan: DesignPlanV2): DesignPlanV2ValidationError | undefined {
  const narratives = new Set(plan.pageNarrative.value.map((item) => item.pageId));
  const intentions = new Map<string, Set<string>>();
  for (const section of plan.sectionIntentions) {
    const page = plan.pageMap.pages.find((item) => item.id === section.pageId);
    if (!page)
      return {
        path: 'sectionIntentions',
        message: `Section intention references unknown page ${section.pageId}.`
      };
    const sections = intentions.get(section.pageId) ?? new Set<string>();
    if (sections.has(section.requiredSection))
      return {
        path: 'sectionIntentions',
        message: `Duplicate section intention for ${section.pageId}/${section.requiredSection}.`
      };
    sections.add(section.requiredSection);
    intentions.set(section.pageId, sections);
  }
  for (const page of plan.pageMap.pages) {
    if (!narratives.has(page.id))
      return { path: 'pageNarrative', message: `Narrative for page ${page.id} is required.` };
    const sections = intentions.get(page.id) ?? new Set<string>();
    for (const required of page.requiredSections)
      if (!sections.has(required))
        return {
          path: 'sectionIntentions',
          message: `Required section ${page.id}/${required} is missing.`
        };
    const suppliedContent = plan.sectionIntentions
      .filter((item) => item.pageId === page.id)
      .flatMap((item) => item.contentRequirements);
    for (const required of page.requiredContent)
      if (!suppliedContent.includes(required))
        return {
          path: 'sectionIntentions',
          message: `Required content ${page.id}/${required} is missing.`
        };
  }
  if (narratives.size !== plan.pageMap.pages.length)
    return {
      path: 'pageNarrative',
      message: 'Page narrative contains an unknown or duplicate page.'
    };
  return undefined;
}

export function validateDesignPlanV2(value: unknown): Validation<DesignPlanV2> {
  if (!isRecord(value)) return invalid('$', 'Design Plan v2 must be an object.');
  const keys = exactKeys(
    value,
    [
      'contractVersion',
      'id',
      'compiledAt',
      'source',
      'pageMap',
      'digest',
      'conceptSpine',
      'emotionalObjective',
      'pageNarrative',
      'navigationSignature',
      'compositionSignature',
      'sectionIntentions',
      'typographySystem',
      'colorSystem',
      'imageryDirection',
      'iconographyDirection',
      'responsiveTransformations',
      'motionStrategy',
      'protectedInvariants',
      'prohibitedPatterns',
      'assumptions',
      'delegatedDecisions',
      'decisionProvenance'
    ],
    '$'
  );
  if (keys) return failure(keys);
  if (value.contractVersion !== DESIGN_PLAN_V2_VERSION)
    return invalid('contractVersion', 'Unsupported Design Plan version.');
  for (const field of ['id', 'compiledAt', 'digest'])
    if (!nonEmpty(value[field])) return invalid(field, `${field} is required.`);
  if (!isRecord(value.source)) return invalid('source', 'Source must be an object.');
  const sourceKeys = exactKeys(
    value.source,
    [
      'briefId',
      'briefVersion',
      'briefDigest',
      'approvedDigest',
      'evaluationId',
      'evaluationDigest',
      'directionId'
    ],
    'source'
  );
  if (sourceKeys) return failure(sourceKeys);
  for (const field of [
    'briefId',
    'briefDigest',
    'approvedDigest',
    'evaluationId',
    'evaluationDigest',
    'directionId'
  ])
    if (!nonEmpty(value.source[field])) return invalid(`source.${field}`, `${field} is required.`);
  if (!Number.isSafeInteger(value.source.briefVersion) || Number(value.source.briefVersion) < 1)
    return invalid('source.briefVersion', 'Brief version must be a positive integer.');
  const pageMap = validatePageMap(value.pageMap, 'pageMap');
  if (!pageMap.ok) return failure(pageMap.error);
  const metadataKeys = new Set([
    'contractVersion',
    'id',
    'compiledAt',
    'source',
    'pageMap',
    'digest'
  ]);
  const draft = Object.fromEntries(Object.entries(value).filter(([key]) => !metadataKeys.has(key)));
  const draftResult = validateDesignPlanV2Draft(draft);
  if (!draftResult.ok) return draftResult;
  const plan = value as unknown as DesignPlanV2;
  const coverage = validatePageCoverage(plan);
  if (coverage) return failure(coverage);
  const { digest, ...unsigned } = plan;
  if (digestDesignPlanV2(unsigned) !== digest)
    return invalid('digest', 'Design Plan digest does not match its content.');
  return success(plan);
}

export function parseDesignPlanV2(serialized: string): Validation<DesignPlanV2> {
  try {
    return validateDesignPlanV2(JSON.parse(serialized));
  } catch (error) {
    return invalid('$', `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
