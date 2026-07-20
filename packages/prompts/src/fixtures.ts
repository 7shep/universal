import type { DesignPlanPromptInput } from './types.ts';

export const fixturePlan: DesignPlanPromptInput = {
  concept: 'A quiet editorial archive for independent architecture.',
  artDirection: 'Warm paper, precise rules, and monumental typography.',
  brandAttributes: ['editorial', 'assured'],
  pageStructure: [
    {
      id: 'hero',
      pattern: 'poster',
      description: 'Title and issue metadata establish the archive.'
    },
    { id: 'index', pattern: 'catalog', description: 'Projects form a paced reading index.' }
  ],
  heroComposition: {
    id: 'poster',
    name: 'Typographic poster',
    intent: 'Let one short statement occupy the canvas.',
    grid: '12 columns × 8 rows',
    viewportBehavior: 'One-screen field with supporting content at the edge.',
    contentOrder: ['headline', 'metadata', 'actions'],
    regions: [
      { slot: 'headline', desktop: 'columns 2–12, rows 2–6', mobile: 'full width, rows 2–5' },
      { slot: 'metadata', desktop: 'column 1', mobile: 'below headline' }
    ],
    prohibitedPatterns: ['centered hero stack']
  },
  navigation: {
    id: 'perimeter',
    name: 'Perimeter navigation',
    placement: 'Page edges',
    relationshipToHero: 'Frames rather than precedes the headline',
    density: 'minimal',
    desktop: 'Labels occupy opposing edges',
    mobile: 'Compact top and bottom anchors',
    prohibitedPatterns: ['logo-links-CTA row']
  },
  designTokens: {
    colors: {
      background: '#F3EFE5',
      surface: '#E5DFD2',
      text: '#171714',
      muted: '#6B675F',
      accent: '#B44A2B'
    },
    typography: {
      displayStyle: 'high-contrast editorial serif',
      bodyStyle: 'neutral grotesk',
      displayScale: ['clamp(4rem, 11vw, 10rem)', '2rem']
    },
    spacing: { sectionPadding: 'clamp(4rem, 9vw, 9rem)', contentGap: '1.5rem' },
    shape: { smallRadius: '0', largeRadius: '0' }
  },
  preferredVisualTreatments: ['duotone architectural photography'],
  tasteDirection: {
    profileId: 'universal-core',
    profileVersion: '1.0.0',
    designThesis: 'An architectural journal whose perimeter behaves like a printed folio.',
    decisions: [
      {
        category: 'composition',
        choice: 'edge-framed poster',
        rationale: 'The frame makes the opening recognizable.',
        source: 'selected-direction',
        confidence: 0.94
      },
      {
        category: 'typography',
        choice: 'serif display with grotesk notes',
        rationale: 'The contrast separates voice from utility.',
        source: 'taste-policy',
        confidence: 0.88
      }
    ],
    typographyRationale: 'Scale and family contrast create the hierarchy.',
    colorRationale: 'Warm neutrals evoke uncoated stock; rust marks selection.',
    visualTreatmentRationale: 'Duotone crops make the archive coherent.',
    navigationRationale: 'Perimeter labels preserve the poster field.',
    motionRationale: 'The static reading order is primary.',
    reducedMotionBehavior: 'Show every region in its final state with no transition.',
    rejectedDefaultPatterns: ['repeated cards'],
    exceptions: []
  },
  prohibitedPatterns: ['nested cards'],
  implementationNotes: ['Use semantic landmarks.', 'Edit copy before moving regions.']
};

export const accessibilityRequirements = [
  'Use semantic landmarks and one logical heading hierarchy.',
  'Meet WCAG AA contrast and expose visible keyboard focus.'
] as const;
