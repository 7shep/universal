import type { DesignTokens, PageSection, PresetName } from './index.ts';

export type { DesignTokens, PageSection, PresetName } from './index.ts';

export interface DesignPreset {
  name: PresetName;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: readonly PageSection[];
  designTokens: DesignTokens;
  visualTreatments: readonly string[];
  forbiddenPatterns: readonly string[];
  keywords: readonly string[];
}

const sharedAvoid = [
  'centered hero with badge and two buttons',
  'purple radial glow',
  'three equal feature cards',
  'glassmorphism',
  'gradient text',
  'nested cards'
] as const;

const structure = (hero: string, story: string, details: string): readonly PageSection[] => [
  {
    id: 'hero',
    pattern: hero,
    description: 'Establish the point of view immediately with one decisive composition.'
  },
  {
    id: 'story',
    pattern: story,
    description: 'Build the narrative through a change of density, scale, and alignment.'
  },
  {
    id: 'details',
    pattern: details,
    description: 'Let typography, dividers, and material cues carry supporting information.'
  },
  {
    id: 'closing',
    pattern: 'minimal closing statement',
    description: 'End with a concise invitation rather than a boxed conversion module.'
  }
];

export const presets: Record<PresetName, DesignPreset> = {
  editorial: {
    name: 'editorial',
    artDirection: 'editorial narrative',
    layoutFamily: 'asymmetric product story',
    brandAttributes: ['considered', 'expressive', 'restrained'],
    pageStructure: structure(
      'offset typographic opener',
      'full-width narrative',
      'captioned detail spread'
    ),
    designTokens: {
      colors: {
        background: '#171716',
        surface: '#232320',
        text: '#F4F2EC',
        muted: '#AAA79E',
        accent: '#D15E3B'
      },
      typography: {
        displayStyle: 'high-contrast serif or condensed sans-serif',
        bodyStyle: 'neutral sans-serif',
        displayScale: ['3rem', '5rem', '7rem']
      },
      spacing: { sectionPadding: 'clamp(5rem, 10vw, 10rem)', contentGap: 'clamp(2rem, 5vw, 6rem)' },
      shape: { smallRadius: '2px', largeRadius: '8px' }
    },
    visualTreatments: ['full-bleed photography', 'captions', 'intentional negative space'],
    forbiddenPatterns: sharedAvoid,
    keywords: ['editorial', 'magazine', 'story', 'culture', 'portfolio', 'architecture']
  },
  industrial: {
    name: 'industrial',
    artDirection: 'industrial editorial',
    layoutFamily: 'technical product story',
    brandAttributes: ['precise', 'tactile', 'engineered'],
    pageStructure: structure(
      'asymmetric mechanical opener',
      'material-led narrative',
      'technical specification spread'
    ),
    designTokens: {
      colors: {
        background: '#111111',
        surface: '#191919',
        text: '#F2EFE8',
        muted: '#9D9A92',
        accent: '#E55F3A'
      },
      typography: {
        displayStyle: 'condensed sans-serif',
        bodyStyle: 'neutral sans-serif',
        displayScale: ['3rem', '5rem', '8rem']
      },
      spacing: { sectionPadding: 'clamp(5rem, 10vw, 10rem)', contentGap: 'clamp(2rem, 5vw, 6rem)' },
      shape: { smallRadius: '2px', largeRadius: '6px' }
    },
    visualTreatments: ['macro material crops', 'thin technical dividers', 'annotated details'],
    forbiddenPatterns: sharedAvoid,
    keywords: [
      'industrial',
      'hardware',
      'mechanical',
      'automotive',
      'engineered',
      'metal',
      'machine',
      'keyboard',
      'tactile'
    ]
  },
  minimal: {
    name: 'minimal',
    artDirection: 'quiet functional minimalism',
    layoutFamily: 'spacious linear narrative',
    brandAttributes: ['clear', 'calm', 'intentional'],
    pageStructure: structure(
      'left-aligned quiet opener',
      'measured content bands',
      'typographic comparison'
    ),
    designTokens: {
      colors: {
        background: '#FAFAF8',
        surface: '#F0F0ED',
        text: '#1D1D1A',
        muted: '#676762',
        accent: '#1F6A5B'
      },
      typography: {
        displayStyle: 'clean grotesk',
        bodyStyle: 'clean grotesk',
        displayScale: ['2.75rem', '4.5rem', '6rem']
      },
      spacing: { sectionPadding: 'clamp(4rem, 8vw, 8rem)', contentGap: 'clamp(1.5rem, 4vw, 4rem)' },
      shape: { smallRadius: '2px', largeRadius: '6px' }
    },
    visualTreatments: ['plain surfaces', 'generous whitespace', 'single strong image'],
    forbiddenPatterns: sharedAvoid,
    keywords: ['minimal', 'simple', 'calm', 'clean', 'quiet', 'essential']
  },
  playful: {
    name: 'playful',
    artDirection: 'expressive contemporary',
    layoutFamily: 'irregular visual collage',
    brandAttributes: ['energetic', 'optimistic', 'unexpected'],
    pageStructure: structure(
      'oversized expressive opener',
      'asymmetric collage',
      'rhythmic type-and-image sequence'
    ),
    designTokens: {
      colors: {
        background: '#F8E9D4',
        surface: '#FFF8ED',
        text: '#1B2440',
        muted: '#5F6376',
        accent: '#E44D2E'
      },
      typography: {
        displayStyle: 'bold geometric sans-serif',
        bodyStyle: 'humanist sans-serif',
        displayScale: ['3rem', '5.5rem', '7rem']
      },
      spacing: { sectionPadding: 'clamp(4rem, 9vw, 9rem)', contentGap: 'clamp(2rem, 6vw, 6rem)' },
      shape: { smallRadius: '4px', largeRadius: '12px' }
    },
    visualTreatments: ['cropped imagery', 'playful scale shifts', 'unexpected alignment'],
    forbiddenPatterns: sharedAvoid,
    keywords: ['playful', 'creative', 'youth', 'music', 'festival', 'fun', 'bold']
  },
  technical: {
    name: 'technical',
    artDirection: 'documentation-inspired technical clarity',
    layoutFamily: 'grid-based information system',
    brandAttributes: ['rigorous', 'legible', 'confident'],
    pageStructure: structure(
      'grid-aligned technical opener',
      'documentation narrative',
      'capability index'
    ),
    designTokens: {
      colors: {
        background: '#10151B',
        surface: '#17212B',
        text: '#EAF0F5',
        muted: '#9BAAB8',
        accent: '#5CC8B5'
      },
      typography: {
        displayStyle: 'modern grotesk',
        bodyStyle: 'monospace paired with neutral sans-serif',
        displayScale: ['2.75rem', '4.5rem', '6.5rem']
      },
      spacing: { sectionPadding: 'clamp(4rem, 8vw, 8rem)', contentGap: 'clamp(1.5rem, 4vw, 4rem)' },
      shape: { smallRadius: '3px', largeRadius: '8px' }
    },
    visualTreatments: ['code-like labels', 'thin grids', 'diagrammatic visual fields'],
    forbiddenPatterns: sharedAvoid,
    keywords: [
      'technical',
      'developer',
      'infrastructure',
      'software',
      'api',
      'cloud',
      'documentation',
      'platform'
    ]
  },
  luxury: {
    name: 'luxury',
    artDirection: 'restrained luxury editorial',
    layoutFamily: 'cinematic product narrative',
    brandAttributes: ['refined', 'sensory', 'confident'],
    pageStructure: structure(
      'cinematic type-and-image opener',
      'slow material story',
      'sparse product detail spread'
    ),
    designTokens: {
      colors: {
        background: '#171516',
        surface: '#211D1C',
        text: '#F6F0E9',
        muted: '#B5AAA0',
        accent: '#B78645'
      },
      typography: {
        displayStyle: 'elegant high-contrast serif',
        bodyStyle: 'refined sans-serif',
        displayScale: ['3rem', '5.5rem', '7.5rem']
      },
      spacing: { sectionPadding: 'clamp(5rem, 11vw, 11rem)', contentGap: 'clamp(2rem, 6vw, 7rem)' },
      shape: { smallRadius: '1px', largeRadius: '6px' }
    },
    visualTreatments: ['dramatic crop', 'material close-up', 'controlled negative space'],
    forbiddenPatterns: sharedAvoid,
    keywords: [
      'luxury',
      'premium',
      'fashion',
      'jewelry',
      'jewellery',
      'watch',
      'fragrance',
      'exclusive'
    ]
  }
};

export const presetList = Object.values(presets);
