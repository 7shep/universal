import type { DesignPlanPromptInput } from './types.ts';
import { PromptAssemblyError } from './render.ts';

export const bullets = (values: readonly string[], empty = '- None specified.'): string =>
  values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : empty;

const requireText = (value: string, path: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new PromptAssemblyError(`Missing required prompt input at ${path}.`);
  return value.trim();
};

const unique = (values: readonly string[]): readonly string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean))
];

export function serializePlan(plan: DesignPlanPromptInput): string {
  if (!plan || typeof plan !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at plan.');
  if (!plan.heroComposition || typeof plan.heroComposition !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at plan.heroComposition.');
  if (!plan.navigation || typeof plan.navigation !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at plan.navigation.');
  if (!plan.designTokens || typeof plan.designTokens !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at plan.designTokens.');
  if (!plan.tasteDirection || typeof plan.tasteDirection !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at plan.tasteDirection.');
  if (!Array.isArray(plan.pageStructure) || plan.pageStructure.length === 0)
    throw new PromptAssemblyError('Missing required prompt input at plan.pageStructure.');
  requireText(plan.concept, 'plan.concept');
  requireText(plan.artDirection, 'plan.artDirection');
  requireText(plan.heroComposition.name, 'plan.heroComposition.name');
  requireText(plan.heroComposition.grid, 'plan.heroComposition.grid');
  requireText(plan.navigation.name, 'plan.navigation.name');
  requireText(plan.tasteDirection.designThesis, 'plan.tasteDirection.designThesis');
  if (!Array.isArray(plan.heroComposition.regions) || plan.heroComposition.regions.length === 0)
    throw new PromptAssemblyError('Missing required prompt input at plan.heroComposition.regions.');
  if (!plan.designTokens.colors || Object.keys(plan.designTokens.colors).length === 0)
    throw new PromptAssemblyError('Missing required prompt input at plan.designTokens.colors.');
  if (!plan.designTokens.typography)
    throw new PromptAssemblyError('Missing required prompt input at plan.designTokens.typography.');
  if (!plan.designTokens.spacing)
    throw new PromptAssemblyError('Missing required prompt input at plan.designTokens.spacing.');
  if (!plan.designTokens.shape)
    throw new PromptAssemblyError('Missing required prompt input at plan.designTokens.shape.');

  const regions = plan.heroComposition.regions
    .map(
      (region) =>
        `- ${requireText(region.slot, 'plan.heroComposition.regions[].slot')}: desktop ${requireText(region.desktop, `plan.heroComposition.regions.${region.slot}.desktop`)}; mobile ${requireText(region.mobile, `plan.heroComposition.regions.${region.slot}.mobile`)}`
    )
    .join('\n');
  const navigation = [
    `- ID/name: ${plan.navigation.id} / ${plan.navigation.name}`,
    `- Placement: ${plan.navigation.placement}`,
    `- Relationship to hero: ${plan.navigation.relationshipToHero}`,
    `- Density: ${plan.navigation.density}`,
    `- Desktop: ${plan.navigation.desktop}`,
    `- Mobile: ${plan.navigation.mobile}`
  ].join('\n');
  const tokens = [
    `- Colors: ${Object.entries(plan.designTokens.colors)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')}`,
    `- Display typography: ${plan.designTokens.typography.displayStyle}`,
    `- Body typography: ${plan.designTokens.typography.bodyStyle}`,
    `- Display scale: ${plan.designTokens.typography.displayScale.join(' / ')}`,
    `- Spacing: section=${plan.designTokens.spacing.sectionPadding}; content gap=${plan.designTokens.spacing.contentGap}`,
    `- Shape: small radius=${plan.designTokens.shape.smallRadius}; large radius=${plan.designTokens.shape.largeRadius}`
  ].join('\n');
  const tasteDecisions = plan.tasteDirection.decisions
    .map(
      (decision) =>
        `- [${decision.category}] ${decision.choice} — ${decision.rationale} (source: ${decision.source}; confidence: ${decision.confidence.toFixed(2)})`
    )
    .join('\n');
  const prohibited = unique([
    ...plan.prohibitedPatterns,
    ...plan.heroComposition.prohibitedPatterns,
    ...plan.navigation.prohibitedPatterns,
    ...plan.tasteDirection.rejectedDefaultPatterns
  ]);
  const motion = plan.motionDirection
    ? [
        `- Signature: ${plan.motionDirection.signature}`,
        `- Technique: ${plan.motionDirection.technique}`,
        `- Layers: ${plan.motionDirection.layers.join('; ')}`,
        `- Behavior: ${plan.motionDirection.behavior.join('; ')}`,
        `- Performance: ${plan.motionDirection.performance.join('; ')}`,
        `- Reduced motion: ${plan.motionDirection.reducedMotion}`
      ].join('\n')
    : `- No signature motion requested. Keep the experience static.\n- Reduced motion: ${plan.tasteDirection.reducedMotionBehavior}`;

  return `DESIGN INTENT
Concept: ${plan.concept}
Art direction: ${plan.artDirection}
Brand attributes: ${plan.brandAttributes.join(', ')}
Design thesis: ${plan.tasteDirection.designThesis}

PAGE STRUCTURE
${plan.pageStructure.map((section) => `- ${section.id}: ${section.pattern} — ${section.description}`).join('\n')}

SPATIAL CONTRACT
Hero: ${plan.heroComposition.name} (${plan.heroComposition.id})
Intent: ${plan.heroComposition.intent}
Grid: ${plan.heroComposition.grid}
Viewport behavior: ${plan.heroComposition.viewportBehavior}
Content order: ${plan.heroComposition.contentOrder.join(' → ')}
Regions:
${regions}

NAVIGATION CONTRACT
${navigation}

DESIGN TOKENS
${tokens}

TASTE DECISIONS
${tasteDecisions || '- None supplied.'}
Typography rationale: ${plan.tasteDirection.typographyRationale}
Color rationale: ${plan.tasteDirection.colorRationale}
Visual treatment rationale: ${plan.tasteDirection.visualTreatmentRationale}
Navigation rationale: ${plan.tasteDirection.navigationRationale}
Preferred visual treatments:
${bullets(plan.preferredVisualTreatments)}

PROHIBITED PATTERNS
${bullets(prohibited)}

MOTION AND REDUCED MOTION
${motion}

IMPLEMENTATION NOTES
${bullets(plan.implementationNotes)}`;
}

export function serializeAccessibility(
  requirements: readonly string[],
  reducedMotionBehavior: string
): string {
  requireText(reducedMotionBehavior, 'reducedMotionBehavior');
  if (!Array.isArray(requirements) || requirements.length === 0)
    throw new PromptAssemblyError('Missing required prompt input at accessibilityRequirements.');
  return `${bullets(requirements)}\n- Reduced motion: ${reducedMotionBehavior}`;
}
