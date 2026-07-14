import type {
  Composition,
  CompositionContract,
  CompositionSignature,
  HeroArchetype,
  NavigationDefinition,
  VisualPreset
} from '@universal/composition-library';
import type { DesignFinding } from '@universal/design-linter';
import type { TasteCategory, TasteDirection } from '@universal/design-taste';
import { failure, success, type DesignBrief, type Result } from '@universal/shared';

export type { TasteDecision, TasteDirection } from '@universal/design-taste';

export type {
  DesignBrief,
  DesignReference,
  GeneratedProject,
  ProjectFile,
  ReviewFinding,
  ReviewResult
} from '@universal/shared';

/** Named visual preset used to select a plan's tokens and composition. */
export type PresetName = VisualPreset;

/** A semantic page section selected by a design preset. */
export interface PageSection {
  id: string;
  pattern: string;
  description: string;
}

/** The visual tokens a generator receives from a design plan. */
export interface DesignTokens {
  colors: Record<'background' | 'surface' | 'text' | 'muted' | 'accent', string>;
  typography: { displayStyle: string; bodyStyle: string; displayScale: readonly string[] };
  spacing: { sectionPadding: string; contentGap: string };
  shape: { smallRadius: string; largeRadius: string };
}

/** Optional, accessible signature-motion guidance for an implementation. */
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
  /** Versioned taste rationale shared by generators and implementation review. */
  tasteDirection: TasteDirection;
  motionDirection?: MotionDirection | undefined;
  implementationNotes: readonly string[];
  avoid: readonly string[];
}

/** Input accepted by the deterministic planning implementation. */
export interface CreateDesignPlanInput extends DesignBrief {
  websiteType?: string | undefined;
  preferences?: readonly string[] | undefined;
  avoid?: readonly string[] | undefined;
  compositionSeed?: number | undefined;
  recentSignatures?: readonly CompositionSignature[] | undefined;
}

/** Typed reason why an untrusted plan could not be accepted. */
export interface DesignPlanValidationError {
  message: string;
  path: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function validateTasteDirection(value: unknown): DesignPlanValidationError | undefined {
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
  if (value.signatureInteraction !== undefined) {
    if (
      !isRecord(value.signatureInteraction) ||
      !isNonEmptyString(value.signatureInteraction.concept) ||
      !isNonEmptyString(value.signatureInteraction.purpose)
    )
      return {
        path: 'tasteDirection.signatureInteraction',
        message: 'A signature interaction needs both a concept and explicit purpose.'
      };
  }
  return undefined;
}

/** Validate the plan boundary before a generator or other consumer trusts it. */
export const validateDesignPlan = (
  value: unknown
): Result<DesignPlan, DesignPlanValidationError> => {
  if (!isRecord(value)) return failure({ path: '$', message: 'Design plan must be an object.' });
  if (typeof value.preset !== 'string')
    return failure({ path: 'preset', message: 'Design plan preset must be a string.' });
  if (typeof value.concept !== 'string')
    return failure({ path: 'concept', message: 'Design plan concept must be a string.' });
  if (!isRecord(value.heroComposition) || typeof value.heroComposition.id !== 'string')
    return failure({
      path: 'heroComposition',
      message: 'Design plan needs a hero composition with an id.'
    });
  if (!isRecord(value.navigation) || typeof value.navigation.id !== 'string')
    return failure({
      path: 'navigation',
      message: 'Design plan needs a navigation definition with an id.'
    });
  if (
    !isRecord(value.compositionSignature) ||
    typeof value.compositionSignature.heroArchetype !== 'string'
  )
    return failure({
      path: 'compositionSignature',
      message: 'Design plan needs a composition signature.'
    });
  if (!Array.isArray(value.pageStructure))
    return failure({
      path: 'pageStructure',
      message: 'Design plan page structure must be an array.'
    });
  if (!Array.isArray(value.prohibitedPatterns))
    return failure({
      path: 'prohibitedPatterns',
      message: 'Design plan prohibited patterns must be an array.'
    });
  const tasteError = validateTasteDirection(value.tasteDirection);
  if (tasteError) return failure(tasteError);
  return success(value as unknown as DesignPlan);
};

/** @deprecated Use DesignPlan as the canonical planning contract. */
export interface DesignSpecification {
  direction: string;
  composition: Composition;
  rationale: readonly string[];
}

/** @deprecated Use DesignPlan as the canonical planning contract. */
export interface DesignDirection {
  specification: DesignSpecification;
  findings: readonly DesignFinding[];
}

export interface DesignEngine {
  develop(brief: DesignBrief): Promise<DesignPlan>;
}

/** TODO: Compose prompt, model adapter, composition selector, and linter here. */
export const createDesignEngine = (): DesignEngine => ({
  async develop(): Promise<DesignPlan> {
    throw new Error('Design Engine is not implemented yet.');
  }
});
