export * from './contracts.ts';
export * from './orchestration.ts';
export {
  DESIGN_RULE_CATEGORIES,
  getDesignRules,
  selectPreset,
  type DesignRuleCategory,
  type DesignRules
} from './planning.ts';
export { presetList, presets, type DesignPreset } from './presets.ts';

export type {
  CompositionContract,
  CompositionSignature,
  HeroArchetype,
  NavigationDefinition
} from '@universal/composition-library';
export type {
  ReviewCompositionContext,
  ReviewFinding as ImplementationReviewFinding,
  ReviewResult as ImplementationReviewResult,
  VisualEvidence
} from '@universal/design-linter';
export {
  buildDesignDirectionPrompt,
  buildImplementationCritiquePrompt,
  buildReactGenerationPrompt,
  buildSectionRevisionPrompt,
  type RenderedPrompt
} from '@universal/prompts';
