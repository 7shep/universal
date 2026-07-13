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
  motionDirection?: MotionDirection;
  implementationNotes: readonly string[];
  avoid: readonly string[];
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

const normalize = (value: string): string => value.toLowerCase();

function requestsLayeredScrollMotion(input: CreateDesignPlanInput): boolean {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  return ['animation', 'animated', 'scroll', 'parallax', 'exploded', 'layered', 'motion'].some((term) => terms.includes(term));
}

function createMotionDirection(input: CreateDesignPlanInput): MotionDirection | undefined {
  if (!requestsLayeredScrollMotion(input)) return undefined;

  return {
    signature: 'Scroll-driven exploded view that reveals the product as a sequence of physical layers.',
    trigger: 'scroll-driven',
    technique: 'Pin the focused product scene for a short narrative interval, then map scroll progress to transform and opacity only.',
    layers: ['base chassis or case', 'primary surface or plate', 'functional detail', 'protective top layer'],
    behavior: [
      'Begin assembled so the product remains legible before motion starts.',
      'Separate each layer on a shared depth axis with small, distinct offsets; do not make the layers orbit or bounce.',
      'Use restrained parallax to make the nearest layer travel slightly farther than the farthest layer.',
      'Reassemble or settle into a clear final state before the next section.'
    ],
    performance: [
      'Animate transform and opacity rather than layout properties.',
      'Keep the pinned interval concise and preserve normal scroll behavior.',
      'Use one signature sequence instead of repeated scroll reveals.'
    ],
    reducedMotion: 'Render the product in its final, legible static exploded state without scroll-linked animation.'
  };
}

export function selectPreset(input: CreateDesignPlanInput): DesignPreset {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  const scores = presetList.map((preset) => ({ preset, score: preset.keywords.reduce((score, keyword) => score + (terms.includes(keyword) ? 1 : 0), 0) }));
  const highest = scores.reduce((best, candidate) => (candidate.score > best.score ? candidate : best), scores[0]!);
  return highest.score > 0 ? highest.preset : presetList.find((preset) => preset.name === 'editorial')!;
}

export function createDesignPlan(input: CreateDesignPlanInput): DesignPlan {
  const preset = selectPreset(input);
  const motionDirection = createMotionDirection(input);
  return {
    preset: preset.name,
    concept: `A ${preset.brandAttributes.slice(0, 2).join(', ')} expression of ${input.prompt.trim().replace(/[.?!]+$/, '')}`,
    artDirection: preset.artDirection,
    layoutFamily: preset.layoutFamily,
    brandAttributes: preset.brandAttributes,
    pageStructure: preset.pageStructure,
    designTokens: preset.designTokens,
    preferredVisualTreatments: preset.visualTreatments,
    ...(motionDirection ? { motionDirection } : {}),
    implementationNotes: [
      'Use semantic React components and CSS Grid for the main compositions.',
      'Define the returned design tokens as CSS custom properties before styling sections.',
      requestsLayeredScrollMotion(input)
        ? 'Implement only the specified signature motion; respect prefers-reduced-motion and keep the rest of the interface static.'
        : 'Keep this prototype static and avoid a component library.',
      'Vary alignment and density between sections; do not repeat the same layout pattern.',
      'Before shipping, capture desktop and mobile screenshots. Inspect each major visual region for unearned empty space, blank logo zones, and missing media or marks.'
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
    imagePrinciples: ['Choose a single coherent visual treatment.', 'Use crops and aspect ratios intentionally; avoid generic stock-image mosaics.', 'When a composition creates a visual region for imagery, a logo, or a product result, fill it with a purposeful asset or remove the region.'],
    motionPrinciples: ['Use one signature scroll sequence only when it explains product construction or hierarchy.', 'Prefer transform and opacity for scroll-linked motion; do not scroll-jack or animate layout properties.', 'Respect prefers-reduced-motion and render a complete static fallback.', 'Never hide content before an animation completes.'],
    antiPatterns: ['Gradients without conceptual justification', 'arbitrary shadows', 'excessive rounded containers', 'standard SaaS feature-grid sequence', 'nested cards'],
    implementationConstraints: ['Use semantic React components.', 'Use CSS custom properties for tokens.', 'Keep functionality static unless the user asks otherwise.', 'Do not introduce a component library.', 'Before review, capture desktop and mobile screenshots and inspect them for empty space and missing expected visual assets.']
  };
}
