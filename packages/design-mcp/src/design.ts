import { compositionCatalog, navigationCatalog, signatureSimilarity, type CompositionSignature, type HeroArchetype, type NavigationDefinition } from '@universal/composition-library';
import { compositionImplementationPrompt, interpolatePrompt } from '@universal/prompts';
import { presetList, type DesignPreset, type PresetName } from './presets.js';

export interface CreateDesignPlanInput {
  prompt: string;
  websiteType?: string | undefined;
  preferences?: string[] | undefined;
  avoid?: string[] | undefined;
  compositionSeed?: number | undefined;
  recentSignatures?: readonly CompositionSignature[] | undefined;
}

export interface EnforceableComposition {
  id: string;
  name: string;
  grid: string;
  viewportBehavior: string;
  contentOrder: HeroArchetype['contentOrder'];
  regions: HeroArchetype['regions'];
  requires: HeroArchetype['requires'];
}

export interface DesignPlan {
  preset: PresetName;
  concept: string;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: DesignPreset['pageStructure'];
  heroComposition: EnforceableComposition;
  navigation: NavigationDefinition;
  compositionSeed: number;
  compositionSignature: CompositionSignature;
  noveltyScore: number;
  implementationPrompt: string;
  prohibitedPatterns: readonly string[];
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

const recentPlanSignatures: CompositionSignature[] = [];
const normalize = (value: string): string => value.toLowerCase();
const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
};
const seededFraction = (seed: number, salt: string): number => hash(`${seed}:${salt}`) / 0xffffffff;

function requestsLayeredScrollMotion(input: CreateDesignPlanInput): boolean {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  return ['animation', 'animated', 'scroll', 'parallax', 'exploded', 'layered', 'motion'].some((term) => terms.includes(term));
}

function createMotionDirection(input: CreateDesignPlanInput): MotionDirection | undefined {
  if (!requestsLayeredScrollMotion(input)) return undefined;
  return {
    signature: 'Scroll-driven exploded view that reveals the product as a sequence of physical layers.', trigger: 'scroll-driven',
    technique: 'Pin the focused product scene for a short narrative interval, then map scroll progress to transform and opacity only.',
    layers: ['base chassis or case', 'primary surface or plate', 'functional detail', 'protective top layer'],
    behavior: ['Begin assembled so the product remains legible before motion starts.','Separate each layer on a shared depth axis with small, distinct offsets; do not make the layers orbit or bounce.','Use restrained parallax to make the nearest layer travel slightly farther than the farthest layer.','Reassemble or settle into a clear final state before the next section.'],
    performance: ['Animate transform and opacity rather than layout properties.','Keep the pinned interval concise and preserve normal scroll behavior.','Use one signature sequence instead of repeated scroll reveals.'],
    reducedMotion: 'Render the product in its final, legible static exploded state without scroll-linked animation.'
  };
}

export function selectPreset(input: CreateDesignPlanInput): DesignPreset {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  const scores = presetList.map((preset) => ({ preset, score: preset.keywords.reduce((score, keyword) => score + (terms.includes(keyword) ? 1 : 0), 0) }));
  const highest = scores.reduce((best, candidate) => (candidate.score > best.score ? candidate : best), scores[0]!);
  return highest.score > 0 ? highest.preset : presetList.find((preset) => preset.name === 'editorial')!;
}

function chooseComposition(input: CreateDesignPlanInput, preset: DesignPreset): { hero: HeroArchetype; navigation: NavigationDefinition; seed: number; noveltyScore: number } {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])].map(normalize).join(' ');
  const history = [...recentPlanSignatures, ...(input.recentSignatures ?? [])].slice(-12);
  const seed = input.compositionSeed ?? hash(`${terms}:${recentPlanSignatures.length}`);
  const candidates = compositionCatalog.filter((hero) => hero.compatiblePresets.includes(preset.name));
  const scored = candidates.flatMap((hero) => hero.compatibleNavigation.flatMap((navigationId) => {
    const navigation = navigationCatalog.find((item) => item.id === navigationId);
    if (!navigation || !navigation.compatibleHeroes.includes(hero.id)) return [];
    const keywordScore = hero.keywords.reduce((score, keyword) => score + (terms.includes(keyword) ? .12 : 0), 0);
    const signature: CompositionSignature = { heroArchetype: hero.id, navigationMode: navigation.id, sectionSequence: preset.pageStructure.map((section) => section.pattern), preset: preset.name };
    const maxSimilarity = history.reduce((max, previous) => Math.max(max, signatureSimilarity(signature, previous)), 0);
    const noveltyScore = Number((1 - maxSimilarity).toFixed(3));
    const score = keywordScore + noveltyScore * .65 + seededFraction(seed, `${hero.id}:${navigation.id}`) * .35;
    return [{ hero, navigation, noveltyScore, score }];
  }));
  const selected = scored.sort((a, b) => b.score - a.score)[0];
  if (!selected) throw new Error(`No compatible composition found for preset ${preset.name}.`);
  return { hero: selected.hero, navigation: selected.navigation, seed, noveltyScore: selected.noveltyScore };
}

function rememberSignature(signature: CompositionSignature): void {
  recentPlanSignatures.push(signature);
  if (recentPlanSignatures.length > 12) recentPlanSignatures.shift();
}

export function resetCompositionHistory(): void { recentPlanSignatures.length = 0; }
export function getCompositionHistory(): readonly CompositionSignature[] { return [...recentPlanSignatures]; }

export function createDesignPlan(input: CreateDesignPlanInput): DesignPlan {
  const preset = selectPreset(input);
  const selected = chooseComposition(input, preset);
  const motionDirection = createMotionDirection(input);
  const sectionSequence = preset.pageStructure.map((section) => section.pattern);
  const compositionSignature: CompositionSignature = { heroArchetype: selected.hero.id, navigationMode: selected.navigation.id, sectionSequence, preset: preset.name };
  const prohibitedPatterns = [...new Set([...selected.hero.prohibitedPatterns, ...selected.navigation.prohibitedPatterns, ...preset.forbiddenPatterns, ...(input.avoid ?? [])])];
  const implementationPrompt = interpolatePrompt(compositionImplementationPrompt.template, {
    heroName: selected.hero.name,
    grid: selected.hero.grid,
    viewportBehavior: selected.hero.viewportBehavior,
    navigation: `${selected.navigation.name}: ${selected.navigation.desktop}`,
    regions: selected.hero.regions.map((item) => `- ${item.slot}: desktop ${item.desktop}; mobile ${item.mobile}`).join('\n'),
    contentOrder: selected.hero.contentOrder.join(' → '),
    prohibitedPatterns: prohibitedPatterns.join('; ')
  });
  const plan: DesignPlan = {
    preset: preset.name,
    concept: `A ${preset.brandAttributes.slice(0, 2).join(', ')} expression of ${input.prompt.trim().replace(/[.?!]+$/, '')}`,
    artDirection: preset.artDirection,
    layoutFamily: selected.hero.name,
    brandAttributes: preset.brandAttributes,
    pageStructure: preset.pageStructure,
    heroComposition: { id:selected.hero.id, name:selected.hero.name, grid:selected.hero.grid, viewportBehavior:selected.hero.viewportBehavior, contentOrder:selected.hero.contentOrder, regions:selected.hero.regions, requires:selected.hero.requires },
    navigation: selected.navigation,
    compositionSeed: selected.seed,
    compositionSignature,
    noveltyScore: selected.noveltyScore,
    implementationPrompt,
    prohibitedPatterns,
    designTokens: preset.designTokens,
    preferredVisualTreatments: preset.visualTreatments,
    ...(motionDirection ? { motionDirection } : {}),
    implementationNotes: [
      'Treat heroComposition regions as coordinates and relationships, not optional inspiration.',
      'Preserve the selected navigation relationship; do not replace it with a standard horizontal navbar.',
      'Edit copy length before changing the composition contract.',
      'Use semantic React components and CSS Grid for the specified composition.',
      requestsLayeredScrollMotion(input) ? 'Implement only the specified signature motion; respect prefers-reduced-motion and keep the rest static.' : 'Keep this prototype static and avoid a component library.',
      'Before shipping, capture desktop and mobile screenshots and check every major visual region.'
    ],
    avoid: prohibitedPatterns
  };
  rememberSignature(compositionSignature);
  return plan;
}

export interface DesignRules { category:string; compositionPrinciples:readonly string[]; typographyPrinciples:readonly string[]; spacingPrinciples:readonly string[]; imagePrinciples:readonly string[]; motionPrinciples:readonly string[]; antiPatterns:readonly string[]; implementationConstraints:readonly string[] }
export function getDesignRules(category = 'general'): DesignRules {
  return {
    category,
    compositionPrinciples:['Select geometry before aesthetics.','Follow the selected spatial coordinates and relationships.','Vary section widths and visual density.','Do not reinterpret asymmetry as left-copy/right-media.','Do not repeat one layout pattern from section to section.'],
    typographyPrinciples:['Use typography as a compositional element.','Create a clear display-to-body contrast.','Keep long-form copy at a readable line length.'],
    spacingPrinciples:['Use deliberate changes in vertical rhythm.','Prefer dividers and whitespace to wrapping every group in a card.'],
    imagePrinciples:['Choose a single coherent visual treatment.','Use crops and aspect ratios intentionally; avoid generic stock-image mosaics.','Fill purposeful media regions or remove them.'],
    motionPrinciples:['Use one signature scroll sequence only when it explains hierarchy.','Prefer transform and opacity; do not scroll-jack.','Respect prefers-reduced-motion.','Never hide content before an animation completes.'],
    antiPatterns:['left-copy/right-media as a default','standard logo-links-CTA navbar','gradients without conceptual justification','arbitrary shadows','excessive rounded containers','standard SaaS feature-grid sequence','nested cards'],
    implementationConstraints:['Use semantic React components.','Use CSS custom properties for tokens.','Keep functionality static unless requested.','Do not introduce a component library.','Capture desktop and mobile screenshots before review.']
  };
}
