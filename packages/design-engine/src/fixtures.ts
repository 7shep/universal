import type {
  CompositionSignature,
  HeroArchetype,
  NavigationDefinition
} from '@universal/composition-library';
import {
  serializeContract,
  type DesignDirection,
  type DesignPlan,
  type DesignPlanBrief,
  type DesignReviewContext,
  type ProjectGenerationRequest,
  type SerializedContractMap
} from './contracts.ts';

const fixtureHero: HeroArchetype = {
  id: 'editorial-masthead',
  sectionId: 'section:editorial-masthead',
  name: 'Editorial masthead',
  intent: 'Open like a publication cover with type, rules, and captions.',
  rhythm: 'balanced',
  grid: '6 columns with baseline rows',
  viewportBehavior: 'Headline spans irregular columns; imagery is an inset editorial plate.',
  contentOrder: ['navigation', 'headline', 'media'],
  regions: [
    {
      id: 'region:editorial-masthead:navigation',
      slot: 'navigation',
      desktop: 'rows 1–2 as masthead',
      mobile: 'compact top row'
    },
    {
      id: 'region:editorial-masthead:headline',
      slot: 'headline',
      desktop: 'columns 1–6, rows 3–5',
      mobile: 'full width'
    },
    {
      id: 'region:editorial-masthead:media',
      slot: 'media',
      desktop: 'columns 4–6, rows 5–8',
      mobile: 'full-bleed crop'
    }
  ],
  compatiblePresets: ['editorial'],
  compatibleNavigation: ['masthead'],
  requires: ['editorial content hierarchy'],
  prohibitedPatterns: ['centered hero', '50/50 split'],
  keywords: ['editorial', 'journal']
};

const fixtureNavigation: NavigationDefinition = {
  id: 'masthead',
  name: 'Editorial masthead',
  placement: 'top two rows',
  relationshipToHero: 'Publication identity and navigation share one typographic system.',
  density: 'full',
  compatibleHeroes: ['editorial-masthead'],
  desktop: 'Utility row, oversized wordmark row, and section links.',
  mobile: 'Wordmark row and menu trigger.',
  prohibitedPatterns: ['generic app navbar spacing']
};

const fixtureSignature: CompositionSignature = {
  heroArchetype: 'editorial-masthead',
  navigationMode: 'masthead',
  sectionSequence: ['offset typographic opener', 'captioned index'],
  preset: 'editorial'
};

export const fixtureBrief: DesignPlanBrief = {
  prompt: 'Create an independent architecture journal.',
  audience: 'Architecture readers and practitioners',
  constraints: ['Static React/Vite output'],
  websiteType: 'Editorial archive',
  preferences: ['warm monochrome', 'large typography'],
  avoid: ['dashboard cards'],
  compositionSeed: 17
};

export const fixturePlan: DesignPlan = {
  preset: 'editorial',
  concept: 'A considered architecture journal composed like a printed folio.',
  artDirection: 'Warm paper, precise rules, and monumental typography.',
  layoutFamily: 'Editorial masthead',
  brandAttributes: ['considered', 'expressive', 'restrained'],
  pageStructure: [
    {
      id: 'hero',
      pattern: 'offset typographic opener',
      description: 'Establish the point of view with one decisive composition.'
    },
    {
      id: 'index',
      pattern: 'captioned index',
      description: 'Present projects as a paced reading index.'
    }
  ],
  heroComposition: fixtureHero,
  navigation: fixtureNavigation,
  composition: {
    hero: fixtureHero,
    navigation: fixtureNavigation,
    signature: fixtureSignature
  },
  compositionSeed: 17,
  compositionSignature: fixtureSignature,
  noveltyScore: 1,
  implementationPrompt: 'Follow the selected editorial masthead coordinates and relationships.',
  prohibitedPatterns: ['centered hero', '50/50 split', 'dashboard cards'],
  designTokens: {
    colors: {
      background: '#171716',
      surface: '#232320',
      text: '#F4F2EC',
      muted: '#AAA79E',
      accent: '#D15E3B'
    },
    typography: {
      displayStyle: 'high-contrast serif',
      bodyStyle: 'neutral sans-serif',
      displayScale: ['3rem', '5rem', '7rem']
    },
    spacing: {
      sectionPadding: 'clamp(5rem, 10vw, 10rem)',
      contentGap: 'clamp(2rem, 5vw, 6rem)'
    },
    shape: { smallRadius: '2px', largeRadius: '8px' }
  },
  preferredVisualTreatments: ['full-bleed photography', 'captions'],
  tasteDirection: {
    profileId: 'anti-slop-craft-v1',
    profileVersion: '1.0.0',
    designThesis:
      'An architecture journal whose masthead, rules, and image plates behave like a printed folio.',
    decisions: [
      {
        category: 'composition',
        choice: 'Editorial masthead',
        rationale: 'The masthead creates a recognizable publication structure.',
        source: 'selected-direction',
        confidence: 0.92
      },
      {
        category: 'typography',
        choice: 'High-contrast serif with neutral sans-serif notes',
        rationale: 'Family and scale contrast separate editorial voice from utility.',
        source: 'selected-direction',
        confidence: 0.88
      },
      {
        category: 'color',
        choice: 'Warm near-black ground with one rust accent',
        rationale: 'The restrained palette evokes ink and uncoated stock.',
        source: 'selected-direction',
        confidence: 0.86
      },
      {
        category: 'navigation',
        choice: 'Navigation integrated into the masthead',
        rationale: 'Shared typography preserves the publication hierarchy.',
        source: 'selected-direction',
        confidence: 0.9
      },
      {
        category: 'imagery',
        choice: 'Captioned architectural image plates',
        rationale: 'Real editorial material prevents placeholder-like visual regions.',
        source: 'selected-direction',
        confidence: 0.84
      }
    ],
    typographyRationale: 'Display and body roles use family, scale, and density contrast.',
    colorRationale: 'Warm neutrals carry the editorial tone; rust marks hierarchy only.',
    visualTreatmentRationale: 'Captioned image plates make source material feel curated.',
    navigationRationale: 'The masthead frames the opening instead of preceding it.',
    motionRationale: 'Static hierarchy carries the experience without decorative animation.',
    reducedMotionBehavior: 'No content or interaction depends on motion.',
    rejectedDefaultPatterns: ['dashboard cards', 'generic app navbar'],
    exceptions: []
  },
  implementationNotes: [
    'Treat composition regions as coordinates and relationships.',
    'Keep the masthead relationship intact.',
    'Use semantic React components.'
  ],
  avoid: ['centered hero', '50/50 split', 'dashboard cards']
};

export const fixtureDirection: DesignDirection = {
  id: 'direction_fixture_editorial',
  label: 'Printed folio',
  status: 'selected',
  plan: fixturePlan
};

export const fixtureProjectRequest: ProjectGenerationRequest = {
  direction: fixtureDirection,
  content: 'Issue 08 — Houses for changing climates.',
  accessibilityRequirements: [
    'Use semantic landmarks and one logical heading hierarchy.',
    'Meet WCAG AA contrast and expose visible keyboard focus.'
  ]
};

export const fixtureReviewContext: DesignReviewContext = {
  plan: fixturePlan,
  files: [
    {
      path: 'src/App.tsx',
      content: '<main><section data-section-id="hero"><h1>Issue 08</h1></section></main>'
    },
    {
      path: 'src/styles.css',
      content: ':root { --background: #171716; --accent: #D15E3B; }'
    }
  ],
  recentSignatures: [],
  visualEvidence: {
    screenshots: [
      { viewport: 'desktop', location: 'fixtures/editorial-desktop.png' },
      { viewport: 'mobile', location: 'fixtures/editorial-mobile.png' }
    ],
    checkedForEmptySpace: true,
    checkedForMissingMedia: true
  }
};

/** Versioned, JSON serialized examples for consumers that do not run MCP. */
export const serializedContractFixtures: {
  readonly [Kind in keyof SerializedContractMap]: string;
} = {
  brief: serializeContract(fixtureBrief),
  plan: serializeContract(fixturePlan),
  direction: serializeContract(fixtureDirection),
  'project-request': serializeContract(fixtureProjectRequest),
  'review-context': serializeContract(fixtureReviewContext)
};
