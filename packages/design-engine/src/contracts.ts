import type {
  CompositionContract,
  CompositionSignature,
  HeroArchetype,
  NavigationDefinition,
  VisualPreset
} from '@universal/composition-library';
import {
  validateCompositionContract,
  validateCompositionSignature,
  validateHeroArchetype,
  validateNavigationDefinition
} from '@universal/composition-library';
import type { TasteCategory, TasteDirection } from '@universal/design-taste';
import {
  failure,
  success,
  type DesignBrief,
  type ProjectFile,
  type Result
} from '@universal/shared';

export type { TasteDecision, TasteDirection } from '@universal/design-taste';
export type {
  DesignBrief,
  DesignReference,
  GeneratedProject,
  ProjectFile,
  ReviewFinding,
  ReviewResult
} from '@universal/shared';

export type PresetName = VisualPreset;

export interface PageSection {
  id: string;
  pattern: string;
  description: string;
}

export interface DesignTokens {
  colors: Record<'background' | 'surface' | 'text' | 'muted' | 'accent', string>;
  typography: { displayStyle: string; bodyStyle: string; displayScale: readonly string[] };
  spacing: { sectionPadding: string; contentGap: string };
  shape: { smallRadius: string; largeRadius: string };
}

export interface MotionDirection {
  signature: string;
  trigger: 'scroll-driven';
  technique: string;
  layers: readonly string[];
  behavior: readonly string[];
  performance: readonly string[];
  reducedMotion: string;
}

/** Canonical cross-package output of Universal's design planning flow. */
export interface DesignPlan {
  preset: PresetName;
  concept: string;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: readonly PageSection[];
  heroComposition: HeroArchetype;
  navigation: NavigationDefinition;
  composition: CompositionContract;
  compositionSeed: number;
  compositionSignature: CompositionSignature;
  noveltyScore: number;
  implementationPrompt: string;
  prohibitedPatterns: readonly string[];
  designTokens: DesignTokens;
  preferredVisualTreatments: readonly string[];
  tasteDirection: TasteDirection;
  motionDirection?: MotionDirection | undefined;
  implementationNotes: readonly string[];
  avoid: readonly string[];
}

/** Serializable brief accepted by the public plan orchestration API. */
export interface DesignPlanBrief extends DesignBrief {
  websiteType?: string | undefined;
  preferences?: readonly string[] | undefined;
  avoid?: readonly string[] | undefined;
  compositionSeed?: number | undefined;
}

/** Legacy flat input retained as an MCP compatibility shape. */
export interface CreateDesignPlanInput extends DesignPlanBrief {
  recentSignatures?: readonly CompositionSignature[] | undefined;
}

/** A Studio-facing candidate that wraps, rather than changes, the canonical plan. */
export interface DesignDirection {
  id: string;
  label: string;
  status: 'candidate' | 'selected' | 'rejected' | 'superseded';
  plan: DesignPlan;
}

/** Portable input consumed by a project generator after direction selection. */
export interface ProjectGenerationRequest {
  direction: DesignDirection;
  content: string;
  accessibilityRequirements: readonly string[];
}

export interface ReviewScreenshotEvidence {
  viewport: string;
  location?: string | undefined;
  notes?: string | undefined;
}

export interface ReviewVisualObservation {
  viewport: string;
  observation: string;
  ruleIds?: readonly string[] | undefined;
}

export interface ReviewVisualEvidence {
  screenshots: readonly ReviewScreenshotEvidence[];
  checkedForEmptySpace: boolean;
  checkedForMissingMedia: boolean;
  visualObservations?: readonly ReviewVisualObservation[] | undefined;
}

/** Complete, JSON-safe input for implementation review outside MCP. */
export interface DesignReviewContext {
  plan: DesignPlan;
  files: readonly ProjectFile[];
  recentSignatures: readonly CompositionSignature[];
  visualEvidence?: ReviewVisualEvidence | undefined;
}

export interface ContractValidationError {
  message: string;
  path: string;
}

export type DesignPlanValidationError = ContractValidationError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);
const isNonEmptyStringArray = (value: unknown): value is string[] =>
  isStringArray(value) && value.length > 0;
const invalid = (path: string, message: string): Result<never, ContractValidationError> =>
  failure({ path, message });

const tasteCategories = new Set<TasteCategory>([
  'typography',
  'color',
  'composition',
  'navigation',
  'imagery',
  'copy',
  'motion',
  'controls'
]);

function validateTasteDirection(value: unknown): ContractValidationError | undefined {
  if (!isRecord(value))
    return { path: 'tasteDirection', message: 'Design plan needs a tasteDirection object.' };
  const requiredStrings = [
    'profileId',
    'profileVersion',
    'designThesis',
    'typographyRationale',
    'colorRationale',
    'visualTreatmentRationale',
    'navigationRationale',
    'motionRationale',
    'reducedMotionBehavior'
  ] as const;
  for (const field of requiredStrings) {
    if (!isNonEmptyString(value[field]))
      return {
        path: `tasteDirection.${field}`,
        message: `tasteDirection.${field} must be a non-empty string with an actionable rationale.`
      };
  }
  if (!Array.isArray(value.decisions) || value.decisions.length < 3 || value.decisions.length > 5)
    return {
      path: 'tasteDirection.decisions',
      message: 'tasteDirection.decisions must contain three to five declared decisions.'
    };
  for (const [index, decision] of value.decisions.entries()) {
    if (!isRecord(decision))
      return {
        path: `tasteDirection.decisions.${index}`,
        message: 'Each taste decision must be an object.'
      };
    if (
      typeof decision.category !== 'string' ||
      !tasteCategories.has(decision.category as TasteCategory)
    )
      return {
        path: `tasteDirection.decisions.${index}.category`,
        message: 'Taste decision category is invalid.'
      };
    if (!isNonEmptyString(decision.choice) || !isNonEmptyString(decision.rationale))
      return {
        path: `tasteDirection.decisions.${index}`,
        message: 'Taste decisions need a concrete choice and rationale.'
      };
    if (!['brief', 'selected-direction', 'taste-policy'].includes(String(decision.source)))
      return {
        path: `tasteDirection.decisions.${index}.source`,
        message: 'Taste decision source is invalid.'
      };
    if (
      typeof decision.confidence !== 'number' ||
      decision.confidence < 0 ||
      decision.confidence > 1
    )
      return {
        path: `tasteDirection.decisions.${index}.confidence`,
        message: 'Taste decision confidence must be between 0 and 1.'
      };
  }
  const decisionCategories = new Set(
    value.decisions.map((decision) => (isRecord(decision) ? decision.category : undefined))
  );
  for (const category of ['typography', 'color', 'navigation', 'imagery']) {
    if (!decisionCategories.has(category))
      return {
        path: 'tasteDirection.decisions',
        message: `tasteDirection.decisions must include a ${category} strategy.`
      };
  }
  if (!Array.isArray(value.rejectedDefaultPatterns))
    return {
      path: 'tasteDirection.rejectedDefaultPatterns',
      message: 'tasteDirection.rejectedDefaultPatterns must be an array.'
    };
  if (!Array.isArray(value.exceptions))
    return {
      path: 'tasteDirection.exceptions',
      message: 'tasteDirection.exceptions must be an array.'
    };
  for (const [index, exception] of value.exceptions.entries()) {
    if (
      !isRecord(exception) ||
      !isNonEmptyString(exception.pattern) ||
      !isNonEmptyString(exception.rationale)
    )
      return {
        path: `tasteDirection.exceptions.${index}`,
        message: 'Taste exceptions need a pattern and credible rationale.'
      };
  }
  if (
    value.signatureInteraction !== undefined &&
    (!isRecord(value.signatureInteraction) ||
      !isNonEmptyString(value.signatureInteraction.concept) ||
      !isNonEmptyString(value.signatureInteraction.purpose))
  )
    return {
      path: 'tasteDirection.signatureInteraction',
      message: 'A signature interaction needs both a concept and explicit purpose.'
    };
  return undefined;
}

export function validateDesignPlan(value: unknown): Result<DesignPlan, DesignPlanValidationError> {
  if (!isRecord(value)) return invalid('$', 'Design plan must be an object.');
  if (
    !['editorial', 'industrial', 'minimal', 'playful', 'technical', 'luxury'].includes(
      String(value.preset)
    )
  )
    return invalid('preset', 'Design plan preset is invalid.');
  for (const field of ['concept', 'artDirection', 'layoutFamily', 'implementationPrompt'] as const)
    if (!isNonEmptyString(value[field])) return invalid(field, `${field} is required.`);
  for (const field of [
    'brandAttributes',
    'prohibitedPatterns',
    'preferredVisualTreatments',
    'implementationNotes',
    'avoid'
  ] as const)
    if (!isNonEmptyStringArray(value[field]))
      return invalid(field, `${field} must contain non-empty strings.`);
  if (
    !Array.isArray(value.pageStructure) ||
    value.pageStructure.length === 0 ||
    !value.pageStructure.every(
      (section) =>
        isRecord(section) &&
        isNonEmptyString(section.id) &&
        isNonEmptyString(section.pattern) &&
        isNonEmptyString(section.description)
    )
  )
    return invalid('pageStructure', 'pageStructure must contain complete sections.');
  if (!Number.isSafeInteger(value.compositionSeed) || Number(value.compositionSeed) < 0)
    return invalid('compositionSeed', 'compositionSeed must be a non-negative safe integer.');
  if (typeof value.noveltyScore !== 'number' || value.noveltyScore < 0 || value.noveltyScore > 1)
    return invalid('noveltyScore', 'noveltyScore must be between 0 and 1.');

  const hero = validateHeroArchetype(value.heroComposition, 'heroComposition');
  if (!hero.ok) return failure(hero.errors[0]!);
  const navigation = validateNavigationDefinition(value.navigation, 'navigation');
  if (!navigation.ok) return failure(navigation.errors[0]!);
  const composition = validateCompositionContract(value.composition, 'composition');
  if (!composition.ok) return failure(composition.errors[0]!);
  const signature = validateCompositionSignature(
    value.compositionSignature,
    'compositionSignature'
  );
  if (!signature.ok) return failure(signature.errors[0]!);
  if (
    hero.value.id !== composition.value.hero.id ||
    navigation.value.id !== composition.value.navigation.id
  )
    return invalid('composition', 'Composition hero and navigation must match the selected plan.');
  const compositionSignature = composition.value.signature;
  if (
    signature.value.heroArchetype !== compositionSignature.heroArchetype ||
    signature.value.navigationMode !== compositionSignature.navigationMode ||
    signature.value.preset !== compositionSignature.preset ||
    signature.value.sectionSequence.length !== compositionSignature.sectionSequence.length ||
    signature.value.sectionSequence.some(
      (section, index) => section !== compositionSignature.sectionSequence[index]
    )
  )
    return invalid('compositionSignature', 'Composition signatures must match.');
  if (signature.value.preset !== value.preset)
    return invalid('compositionSignature.preset', 'Composition signature preset must match plan.');

  if (!isRecord(value.designTokens))
    return invalid('designTokens', 'designTokens must be an object.');
  const tokens = value.designTokens;
  if (!isRecord(tokens.colors))
    return invalid('designTokens.colors', 'Design token colors are incomplete.');
  const colors = tokens.colors;
  if (
    !['background', 'surface', 'text', 'muted', 'accent'].every((key) =>
      isNonEmptyString(colors[key])
    )
  )
    return invalid('designTokens.colors', 'Design token colors are incomplete.');
  if (
    !isRecord(tokens.typography) ||
    !isNonEmptyString(tokens.typography.displayStyle) ||
    !isNonEmptyString(tokens.typography.bodyStyle) ||
    !isNonEmptyStringArray(tokens.typography.displayScale)
  )
    return invalid('designTokens.typography', 'Typography tokens are incomplete.');
  if (
    !isRecord(tokens.spacing) ||
    !isNonEmptyString(tokens.spacing.sectionPadding) ||
    !isNonEmptyString(tokens.spacing.contentGap)
  )
    return invalid('designTokens.spacing', 'Spacing tokens are incomplete.');
  if (
    !isRecord(tokens.shape) ||
    !isNonEmptyString(tokens.shape.smallRadius) ||
    !isNonEmptyString(tokens.shape.largeRadius)
  )
    return invalid('designTokens.shape', 'Shape tokens are incomplete.');
  const tasteError = validateTasteDirection(value.tasteDirection);
  if (tasteError) return failure(tasteError);
  if (value.motionDirection !== undefined) {
    const motion = value.motionDirection;
    if (
      !isRecord(motion) ||
      motion.trigger !== 'scroll-driven' ||
      !isNonEmptyString(motion.signature) ||
      !isNonEmptyString(motion.technique) ||
      !isNonEmptyString(motion.reducedMotion) ||
      !isNonEmptyStringArray(motion.layers) ||
      !isNonEmptyStringArray(motion.behavior) ||
      !isNonEmptyStringArray(motion.performance)
    )
      return invalid('motionDirection', 'Motion direction is incomplete or invalid.');
  }
  return success(value as unknown as DesignPlan);
}

export function validateDesignPlanBrief(
  value: unknown
): Result<DesignPlanBrief, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Design brief must be an object.');
  if (!isNonEmptyString(value.prompt)) return invalid('prompt', 'Design brief prompt is required.');
  for (const field of ['constraints', 'preferences', 'avoid'] as const)
    if (value[field] !== undefined && !isStringArray(value[field]))
      return invalid(field, `${field} must contain non-empty strings.`);
  if (
    value.references !== undefined &&
    (!Array.isArray(value.references) ||
      !value.references.every(
        (reference) =>
          isRecord(reference) &&
          isNonEmptyString(reference.description) &&
          ['inspiration', 'anti-reference'].includes(String(reference.role))
      ))
  )
    return invalid('references', 'References must include a description and supported role.');
  if (
    value.compositionSeed !== undefined &&
    (!Number.isSafeInteger(value.compositionSeed) || Number(value.compositionSeed) < 0)
  )
    return invalid('compositionSeed', 'compositionSeed must be a non-negative safe integer.');
  return success(value as unknown as DesignPlanBrief);
}

export function validateDesignDirection(
  value: unknown
): Result<DesignDirection, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Design direction must be an object.');
  if (!isNonEmptyString(value.id)) return invalid('id', 'Design direction id is required.');
  if (!isNonEmptyString(value.label))
    return invalid('label', 'Design direction label is required.');
  if (!['candidate', 'selected', 'rejected', 'superseded'].includes(String(value.status)))
    return invalid('status', 'Design direction status is invalid.');
  const plan = validateDesignPlan(value.plan);
  if (!plan.ok) return invalid(`plan.${plan.error.path}`, plan.error.message);
  return success(value as unknown as DesignDirection);
}

export function validateProjectGenerationRequest(
  value: unknown
): Result<ProjectGenerationRequest, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Project generation request must be an object.');
  const direction = validateDesignDirection(value.direction);
  if (!direction.ok) return invalid(`direction.${direction.error.path}`, direction.error.message);
  if (direction.value.status !== 'selected')
    return invalid('direction.status', 'Project generation requires a selected direction.');
  if (!isNonEmptyString(value.content)) return invalid('content', 'Project content is required.');
  if (!isNonEmptyStringArray(value.accessibilityRequirements))
    return invalid(
      'accessibilityRequirements',
      'Accessibility requirements must be non-empty strings.'
    );
  return success(value as unknown as ProjectGenerationRequest);
}

export function validateDesignReviewContext(
  value: unknown
): Result<DesignReviewContext, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Design review context must be an object.');
  const plan = validateDesignPlan(value.plan);
  if (!plan.ok) return invalid(`plan.${plan.error.path}`, plan.error.message);
  if (
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    !value.files.every(
      (file) => isRecord(file) && isNonEmptyString(file.path) && typeof file.content === 'string'
    )
  )
    return invalid('files', 'Review context needs at least one source file.');
  if (!Array.isArray(value.recentSignatures))
    return invalid('recentSignatures', 'Review context recentSignatures must be an array.');
  for (const [index, signature] of value.recentSignatures.entries()) {
    const validation = validateCompositionSignature(signature, `recentSignatures.${index}`);
    if (!validation.ok) return failure(validation.errors[0]!);
  }
  if (value.visualEvidence !== undefined) {
    if (!isRecord(value.visualEvidence))
      return invalid('visualEvidence', 'visualEvidence must be an object.');
    if (
      !Array.isArray(value.visualEvidence.screenshots) ||
      value.visualEvidence.screenshots.length === 0 ||
      !value.visualEvidence.screenshots.every(
        (shot) => isRecord(shot) && isNonEmptyString(shot.viewport)
      )
    )
      return invalid('visualEvidence.screenshots', 'Screenshots need viewport labels.');
    if (
      typeof value.visualEvidence.checkedForEmptySpace !== 'boolean' ||
      typeof value.visualEvidence.checkedForMissingMedia !== 'boolean'
    )
      return invalid('visualEvidence', 'Visual coverage checks must be boolean values.');
  }
  return success(value as unknown as DesignReviewContext);
}

export interface SerializedContractMap {
  brief: DesignPlanBrief;
  plan: DesignPlan;
  direction: DesignDirection;
  'project-request': ProjectGenerationRequest;
  'review-context': DesignReviewContext;
}

export type SerializedContractKind = keyof SerializedContractMap;

const contractValidators: {
  [Kind in SerializedContractKind]: (
    value: unknown
  ) => Result<SerializedContractMap[Kind], ContractValidationError>;
} = {
  brief: validateDesignPlanBrief,
  plan: validateDesignPlan,
  direction: validateDesignDirection,
  'project-request': validateProjectGenerationRequest,
  'review-context': validateDesignReviewContext
};

export function serializeContract<T>(value: T): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseContract<Kind extends SerializedContractKind>(
  kind: Kind,
  serialized: string
): Result<SerializedContractMap[Kind], ContractValidationError> {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    return invalid('$', `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return contractValidators[kind](value);
}
