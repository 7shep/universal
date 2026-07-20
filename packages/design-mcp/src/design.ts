import {
  compositionCatalog,
  navigationCatalog,
  signatureSimilarity,
  type CompositionSignature,
  type HeroArchetype,
  type NavigationDefinition
} from '@universal/composition-library';
import {
  validateDesignPlan,
  type CreateDesignPlanInput,
  type DesignPlan,
  type MotionDirection
} from '@universal/design-engine';
import { createTasteDirection, getActiveTasteProfile } from '@universal/design-taste';
import { compositionImplementationPrompt, interpolatePrompt } from '@universal/prompts';
import { presetList, type DesignPreset } from './presets.js';

export type { CreateDesignPlanInput, DesignPlan, MotionDirection } from '@universal/design-engine';
export { getActiveTasteProfile } from '@universal/design-taste';

const recentPlanSignatures: CompositionSignature[] = [];
const normalize = (value: string): string => value.toLowerCase();
export const DESIGN_RULE_CATEGORIES = [
  'general',
  'website',
  'typography',
  'composition',
  'imagery',
  'motion'
] as const;
export type DesignRuleCategory = (typeof DESIGN_RULE_CATEGORIES)[number];

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1)
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
};
const seededFraction = (seed: number, salt: string): number => hash(`${seed}:${salt}`) / 0xffffffff;

function requestsSignatureMotion(input: CreateDesignPlanInput): boolean {
  const avoid = (input.avoid ?? []).map(normalize).join(' ');
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])]
    .map(normalize)
    .join(' ');
  if (/no (?:animation|motion)|avoid (?:animation|motion)|static only/.test(`${terms} ${avoid}`))
    return false;
  if (terms.includes('cursor')) return false;
  return ['animation', 'animated', 'scroll', 'parallax', 'exploded', 'layered', 'motion'].some(
    (term) => terms.includes(term)
  );
}

function createMotionDirection(input: CreateDesignPlanInput): MotionDirection | undefined {
  if (!requestsSignatureMotion(input)) return undefined;
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])]
    .map(normalize)
    .join(' ');
  const isLayeredProduct = /product|hardware|keyboard|device|layer|explod|mechanical/.test(terms);
  if (!isLayeredProduct)
    return {
      signature: 'Scroll-driven narrative index that marks the active content chapter.',
      trigger: 'scroll-driven',
      technique:
        'Keep a compact index sticky while normal document scroll updates only its active state.',
      layers: ['chapter label', 'primary content', 'supporting evidence'],
      behavior: [
        'Preserve normal document order and make every chapter available without animation.',
        'Update the index only when a chapter becomes the current reading context.',
        'Use one short transition for active-state continuity rather than repeated entrance reveals.'
      ],
      performance: [
        'Animate transform and opacity only.',
        'Do not intercept or remap normal scrolling.'
      ],
      reducedMotion:
        'Keep the index and every chapter visible, updating active state without animated transitions.'
    };
  return {
    signature:
      'Scroll-driven exploded view that reveals the product as a sequence of physical layers.',
    trigger: 'scroll-driven',
    technique:
      'Pin the focused product scene for a short narrative interval, then map scroll progress to transform and opacity only.',
    layers: [
      'base chassis or case',
      'primary surface or plate',
      'functional detail',
      'protective top layer'
    ],
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
    reducedMotion:
      'Render the product in its final, legible static exploded state without scroll-linked animation.'
  };
}

export function selectPreset(input: CreateDesignPlanInput): DesignPreset {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])]
    .map(normalize)
    .join(' ');
  const scores = presetList.map((preset) => ({
    preset,
    score: preset.keywords.reduce((score, keyword) => score + (terms.includes(keyword) ? 1 : 0), 0)
  }));
  const highest = scores.reduce(
    (best, candidate) => (candidate.score > best.score ? candidate : best),
    scores[0]!
  );
  return highest.score > 0
    ? highest.preset
    : presetList.find((preset) => preset.name === 'editorial')!;
}

function chooseComposition(
  input: CreateDesignPlanInput,
  preset: DesignPreset
): { hero: HeroArchetype; navigation: NavigationDefinition; seed: number; noveltyScore: number } {
  const terms = [input.prompt, input.websiteType ?? '', ...(input.preferences ?? [])]
    .map(normalize)
    .join(' ');
  const history = [...recentPlanSignatures, ...(input.recentSignatures ?? [])].slice(-12);
  const seed = input.compositionSeed ?? hash(`${terms}:${recentPlanSignatures.length}`);
  const candidates = compositionCatalog.filter((hero) =>
    hero.compatiblePresets.includes(preset.name)
  );
  const scored = candidates.flatMap((hero) =>
    hero.compatibleNavigation.flatMap((navigationId) => {
      const navigation = navigationCatalog.find((item) => item.id === navigationId);
      if (!navigation || !navigation.compatibleHeroes.includes(hero.id)) return [];
      const keywordScore = hero.keywords.reduce(
        (score, keyword) => score + (terms.includes(keyword) ? 0.12 : 0),
        0
      );
      const signature: CompositionSignature = {
        heroArchetype: hero.id,
        navigationMode: navigation.id,
        sectionSequence: preset.pageStructure.map((section) => section.pattern),
        preset: preset.name
      };
      const maxSimilarity = history.reduce(
        (max, previous) => Math.max(max, signatureSimilarity(signature, previous)),
        0
      );
      const noveltyScore = Number((1 - maxSimilarity).toFixed(3));
      const score =
        keywordScore +
        noveltyScore * 0.65 +
        seededFraction(seed, `${hero.id}:${navigation.id}`) * 0.35;
      return [{ hero, navigation, noveltyScore, score }];
    })
  );
  const selected = scored.sort((a, b) => b.score - a.score)[0];
  if (!selected) throw new Error(`No compatible composition found for preset ${preset.name}.`);
  return {
    hero: selected.hero,
    navigation: selected.navigation,
    seed,
    noveltyScore: selected.noveltyScore
  };
}

function rememberSignature(signature: CompositionSignature): void {
  recentPlanSignatures.push(signature);
  if (recentPlanSignatures.length > 12) recentPlanSignatures.shift();
}

export function resetCompositionHistory(): void {
  recentPlanSignatures.length = 0;
}
export function getCompositionHistory(): readonly CompositionSignature[] {
  return [...recentPlanSignatures];
}

export function createDesignPlan(input: CreateDesignPlanInput): DesignPlan {
  const preset = selectPreset(input);
  const selected = chooseComposition(input, preset);
  const motionDirection = createMotionDirection(input);
  const preferredVisualTreatments = [
    ...new Set([...preset.visualTreatments, ...(input.preferences ?? [])])
  ];
  const tasteDirection = createTasteDirection({
    brief: input.prompt,
    audience: input.audience,
    preferences: input.preferences,
    avoid: input.avoid,
    presetName: preset.name,
    brandAttributes: preset.brandAttributes,
    artDirection: preset.artDirection,
    displayStyle: preset.designTokens.typography.displayStyle,
    bodyStyle: preset.designTokens.typography.bodyStyle,
    backgroundColor: preset.designTokens.colors.background,
    accentColor: preset.designTokens.colors.accent,
    visualTreatments: preferredVisualTreatments,
    hero: selected.hero,
    navigation: selected.navigation,
    ...(motionDirection
      ? {
          motion: {
            concept: motionDirection.signature,
            purpose: /exploded view/i.test(motionDirection.signature)
              ? 'Reveal product hierarchy as a short narrative sequence while preserving normal reading order.'
              : 'Communicate the active narrative chapter without changing normal document order.',
            reducedMotionBehavior: motionDirection.reducedMotion
          }
        }
      : {})
  });
  const sectionSequence = preset.pageStructure.map((section) => section.pattern);
  const compositionSignature: CompositionSignature = {
    heroArchetype: selected.hero.id,
    navigationMode: selected.navigation.id,
    sectionSequence,
    preset: preset.name
  };
  const prohibitedPatterns = [
    ...new Set([
      ...selected.hero.prohibitedPatterns,
      ...selected.navigation.prohibitedPatterns,
      ...preset.forbiddenPatterns,
      ...(input.avoid ?? [])
    ])
  ];
  const implementationPrompt = interpolatePrompt(compositionImplementationPrompt.template, {
    heroName: selected.hero.name,
    grid: selected.hero.grid,
    viewportBehavior: selected.hero.viewportBehavior,
    navigation: `${selected.navigation.name}: ${selected.navigation.desktop}`,
    regions: selected.hero.regions
      .map((item) => `- ${item.slot}: desktop ${item.desktop}; mobile ${item.mobile}`)
      .join('\n'),
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
    heroComposition: selected.hero,
    navigation: selected.navigation,
    composition: {
      hero: selected.hero,
      navigation: selected.navigation,
      signature: compositionSignature
    },
    compositionSeed: selected.seed,
    compositionSignature,
    noveltyScore: selected.noveltyScore,
    implementationPrompt,
    prohibitedPatterns,
    designTokens: preset.designTokens,
    preferredVisualTreatments,
    tasteDirection,
    ...(motionDirection ? { motionDirection } : {}),
    implementationNotes: [
      'Treat heroComposition regions as coordinates and relationships, not optional inspiration.',
      'Preserve the selected navigation relationship; do not replace it with a standard horizontal navbar.',
      'Edit copy length before changing the composition contract.',
      'Use semantic React components and CSS Grid for the specified composition.',
      tasteDirection.signatureInteraction
        ? 'Implement only the specified signature interaction; honor its purpose and prefers-reduced-motion behavior, and keep the rest static.'
        : 'Keep this prototype static and avoid a component library.',
      'Before shipping, capture desktop and mobile screenshots and check every major visual region.'
    ],
    avoid: prohibitedPatterns
  };
  const validation = validateDesignPlan(plan);
  if (!validation.ok)
    throw new Error(
      `Generated an invalid design plan at ${validation.error.path}: ${validation.error.message}`
    );
  rememberSignature(compositionSignature);
  return validation.value;
}

export interface DesignRules {
  category: DesignRuleCategory;
  tasteProfile: { id: string; version: string };
  categoryPrinciples: readonly string[];
  compositionPrinciples: readonly string[];
  typographyPrinciples: readonly string[];
  spacingPrinciples: readonly string[];
  imagePrinciples: readonly string[];
  motionPrinciples: readonly string[];
  antiPatterns: readonly string[];
  implementationConstraints: readonly string[];
}

const categoryPrinciples: Record<DesignRuleCategory, readonly string[]> = {
  general: [
    'Establish one coherent visual thesis before selecting components.',
    'Use the global principles as constraints throughout implementation and review.'
  ],
  website: [
    'Make the first viewport communicate hierarchy, purpose, and a deliberate entry point.',
    'Vary section composition while preserving one visual system across the whole page.'
  ],
  typography: [
    'Choose display and body faces for a specific contrast in voice, scale, and density.',
    'Define a compact type scale and line-length limits before styling individual components.'
  ],
  composition: [
    'Assign every major region a spatial role before deciding its visual treatment.',
    'Create rhythm through changes in alignment, density, and scale instead of repeated grids.'
  ],
  imagery: [
    'Specify subject, crop, aspect ratio, and treatment so imagery carries design intent.',
    'Use one image system consistently and remove media regions that lack purposeful assets.'
  ],
  motion: [
    'Give each animation a single communicative purpose tied to hierarchy or state.',
    'Design the reduced-motion experience first so content and navigation never depend on animation.'
  ]
};

export function getDesignRules(category: DesignRuleCategory = 'general'): DesignRules {
  if (!DESIGN_RULE_CATEGORIES.includes(category)) {
    throw new Error(
      `Unsupported design rule category "${category}". Choose one of: ${DESIGN_RULE_CATEGORIES.join(', ')}.`
    );
  }
  const tasteProfile = getActiveTasteProfile();
  return {
    category,
    tasteProfile: { id: tasteProfile.id, version: tasteProfile.version },
    categoryPrinciples: categoryPrinciples[category],
    compositionPrinciples: [
      'Select geometry before aesthetics.',
      'Follow the selected spatial coordinates and relationships.',
      'Vary section widths and visual density.',
      'Do not reinterpret asymmetry as left-copy/right-media.',
      'Do not repeat one layout pattern from section to section.'
    ],
    typographyPrinciples: [
      'Use typography as a compositional element.',
      'Create a clear display-to-body contrast.',
      'Keep long-form copy at a readable line length.'
    ],
    spacingPrinciples: [
      'Use deliberate changes in vertical rhythm.',
      'Prefer dividers and whitespace to wrapping every group in a card.'
    ],
    imagePrinciples: [
      'Choose a single coherent visual treatment.',
      'Use crops and aspect ratios intentionally; avoid generic stock-image mosaics.',
      'Fill purposeful media regions or remove them.'
    ],
    motionPrinciples: [
      'Use one signature scroll sequence only when it explains hierarchy.',
      'Prefer transform and opacity; do not scroll-jack.',
      'Respect prefers-reduced-motion.',
      'Never hide content before an animation completes.'
    ],
    antiPatterns: [
      ...tasteProfile.antiPatterns.map((pattern) => pattern.description),
      'left-copy/right-media as a default',
      'standard logo-links-CTA navbar',
      'gradients without conceptual justification',
      'arbitrary shadows',
      'excessive rounded containers',
      'standard SaaS feature-grid sequence',
      'nested cards'
    ],
    implementationConstraints: [
      'Use semantic React components.',
      'Use CSS custom properties for tokens.',
      'Keep functionality static unless requested.',
      'Do not introduce a component library.',
      'Capture desktop and mobile screenshots before review.'
    ]
  };
}
