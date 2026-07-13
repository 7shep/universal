import { presetList, type DesignPreset, type PresetName } from './presets.js';

export interface CreateDesignPlanInput {
  prompt: string;
  websiteType?: string | undefined;
  preferences?: string[] | undefined;
  avoid?: string[] | undefined;
}

export interface DesignPlan {
  preset: PresetName;
  concept: string;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: DesignPreset['pageStructure'];
  designTokens: DesignPreset['designTokens'];
  preferredVisualTreatments: readonly string[];
  implementationNotes: readonly string[];
  avoid: readonly string[];
}

const normalize = (value: string): string => value.toLowerCase();

export function selectPreset(input: CreateDesignPlanInput): DesignPreset {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  const scores = presetList.map((preset) => ({ preset, score: preset.keywords.reduce((score, keyword) => score + (terms.includes(keyword) ? 1 : 0), 0) }));
  const highest = scores.reduce((best, candidate) => (candidate.score > best.score ? candidate : best), scores[0]!);
  return highest.score > 0 ? highest.preset : presetList.find((preset) => preset.name === 'editorial')!;
}

export function createDesignPlan(input: CreateDesignPlanInput): DesignPlan {
  const preset = selectPreset(input);
  return {
    preset: preset.name,
    concept: `A ${preset.brandAttributes.slice(0, 2).join(', ')} expression of ${input.prompt.trim().replace(/[.?!]+$/, '')}`,
    artDirection: preset.artDirection,
    layoutFamily: preset.layoutFamily,
    brandAttributes: preset.brandAttributes,
    pageStructure: preset.pageStructure,
    designTokens: preset.designTokens,
    preferredVisualTreatments: preset.visualTreatments,
    implementationNotes: [
      'Use semantic React components and CSS Grid for the main compositions.',
      'Define the returned design tokens as CSS custom properties before styling sections.',
      'Keep this prototype static and avoid a component library.',
      'Vary alignment and density between sections; do not repeat the same layout pattern.'
    ],
    avoid: [...preset.forbiddenPatterns, ...(input.avoid ?? [])]
  };
}

export interface DesignRules {
  category: string;
  compositionPrinciples: readonly string[];
  typographyPrinciples: readonly string[];
  spacingPrinciples: readonly string[];
  imagePrinciples: readonly string[];
  motionPrinciples: readonly string[];
  antiPatterns: readonly string[];
  implementationConstraints: readonly string[];
}

export function getDesignRules(category = 'general'): DesignRules {
  return {
    category,
    compositionPrinciples: ['Vary section widths and visual density.', 'Use one strong visual idea per page.', 'Avoid defaulting to centered alignment.', 'Do not repeat one layout pattern from section to section.'],
    typographyPrinciples: ['Use typography as a compositional element.', 'Create a clear display-to-body contrast.', 'Keep long-form copy at a readable line length.'],
    spacingPrinciples: ['Use deliberate changes in vertical rhythm.', 'Prefer dividers and whitespace to wrapping every group in a card.'],
    imagePrinciples: ['Choose a single coherent visual treatment.', 'Use crops and aspect ratios intentionally; avoid generic stock-image mosaics.'],
    motionPrinciples: ['Keep motion subtle unless explicitly requested.', 'Respect prefers-reduced-motion and never hide content before animation.'],
    antiPatterns: ['Gradients without conceptual justification', 'arbitrary shadows', 'excessive rounded containers', 'standard SaaS feature-grid sequence', 'nested cards'],
    implementationConstraints: ['Use semantic React components.', 'Use CSS custom properties for tokens.', 'Keep functionality static unless the user asks otherwise.', 'Do not introduce a component library.']
  };
}
