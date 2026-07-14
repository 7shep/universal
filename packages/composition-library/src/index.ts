import type { Identifiable } from '@universal/shared';

export type VisualPreset =
  'editorial' | 'industrial' | 'minimal' | 'playful' | 'technical' | 'luxury';
export type NavigationId =
  | 'standard-horizontal'
  | 'corner-controls'
  | 'perimeter'
  | 'overlay-minimal'
  | 'vertical-rail'
  | 'masthead'
  | 'embedded-index'
  | 'utility-dock';

/** Page-level composition retained for design-engine and linter consumers. */
export interface Composition extends Identifiable {
  name: string;
  intent: string;
  rhythm: 'dense' | 'balanced' | 'spacious';
  sections: readonly CompositionSection[];
}
export interface CompositionSection extends Identifiable {
  kind: 'hero' | 'narrative' | 'gallery' | 'proof' | 'cta' | 'footer';
  purpose: string;
  emphasis: 'primary' | 'supporting' | 'quiet';
  slots: readonly SpatialRegion['slot'][];
}

export interface SpatialRegion {
  slot: 'headline' | 'body' | 'media' | 'actions' | 'metadata' | 'navigation';
  desktop: string;
  mobile: string;
}

export interface HeroArchetype extends Identifiable {
  name: string;
  intent: string;
  rhythm: 'dense' | 'balanced' | 'spacious';
  grid: string;
  viewportBehavior: string;
  contentOrder: readonly SpatialRegion['slot'][];
  regions: readonly SpatialRegion[];
  compatiblePresets: readonly VisualPreset[];
  compatibleNavigation: readonly NavigationId[];
  requires: readonly string[];
  prohibitedPatterns: readonly string[];
  keywords: readonly string[];
}

export interface NavigationDefinition extends Identifiable {
  id: NavigationId;
  name: string;
  placement: string;
  relationshipToHero: string;
  density: 'minimal' | 'compact' | 'full';
  compatibleHeroes: readonly string[];
  desktop: string;
  mobile: string;
  prohibitedPatterns: readonly string[];
}

/** The selected hero, navigation, and signature that implementations must preserve. */
export interface CompositionContract {
  hero: HeroArchetype;
  navigation: NavigationDefinition;
  signature: CompositionSignature;
}

const region = (slot: SpatialRegion['slot'], desktop: string, mobile: string): SpatialRegion => ({
  slot,
  desktop,
  mobile
});

export const compositionCatalog: readonly HeroArchetype[] = [
  {
    id: 'poster',
    name: 'Typographic poster',
    intent: 'Let one short statement occupy the canvas.',
    rhythm: 'spacious',
    grid: '12 columns × 8 rows',
    viewportBehavior: 'One-screen typographic field; supporting content stays peripheral.',
    contentOrder: ['headline', 'metadata', 'actions'],
    regions: [
      region(
        'headline',
        'columns 2–12, rows 2–6; may cross the center line',
        'full width, rows 2–5'
      ),
      region('metadata', 'column 1 or bottom edge', 'below headline'),
      region('actions', 'bottom-right corner', 'bottom-left')
    ],
    compatiblePresets: ['editorial', 'industrial', 'playful', 'minimal'],
    compatibleNavigation: ['corner-controls', 'perimeter', 'utility-dock'],
    requires: ['headline under 10 words', 'no required hero image'],
    prohibitedPatterns: [
      'left-copy-right-media',
      'centered headline stack',
      'horizontal logo-links-cta navbar',
      'card inside hero'
    ],
    keywords: ['manifesto', 'campaign', 'event', 'culture', 'bold', 'statement']
  },
  {
    id: 'cinematic-full-bleed',
    name: 'Cinematic full bleed',
    intent: 'Make one purposeful image or film frame the environment.',
    rhythm: 'spacious',
    grid: 'edge-to-edge media with 12-column overlay grid',
    viewportBehavior: 'Media fills the first viewport; copy is embedded at an edge, never boxed.',
    contentOrder: ['media', 'headline', 'metadata', 'actions'],
    regions: [
      region('media', 'entire viewport', 'entire viewport'),
      region('headline', 'lower-left columns 1–8', 'lower third'),
      region('metadata', 'opposite upper corner', 'above headline'),
      region('actions', 'lower-right', 'below copy')
    ],
    compatiblePresets: ['editorial', 'luxury', 'playful', 'industrial'],
    compatibleNavigation: ['overlay-minimal', 'corner-controls', 'perimeter'],
    requires: ['strong landscape media', 'high-contrast overlay zone'],
    prohibitedPatterns: [
      'side-by-side media panel',
      'opaque navbar bar',
      'floating glass card',
      'centered copy block'
    ],
    keywords: ['cinematic', 'photography', 'film', 'fashion', 'travel', 'product']
  },
  {
    id: 'editorial-masthead',
    name: 'Editorial masthead',
    intent: 'Open like a publication cover with type, rules, and captions.',
    rhythm: 'balanced',
    grid: '6 columns with baseline rows',
    viewportBehavior: 'Headline spans irregular columns; image is an inset editorial plate.',
    contentOrder: ['navigation', 'headline', 'media', 'body', 'metadata'],
    regions: [
      region('navigation', 'rows 1–2 as masthead', 'compact top row'),
      region('headline', 'columns 1–6, rows 3–5', 'full width'),
      region('media', 'columns 4–6, rows 5–8', 'full-bleed crop'),
      region('body', 'columns 1–2, rows 6–7', 'below headline'),
      region('metadata', 'outer margins and rules', 'caption below media')
    ],
    compatiblePresets: ['editorial', 'luxury', 'minimal'],
    compatibleNavigation: ['masthead', 'perimeter'],
    requires: ['editorial content hierarchy'],
    prohibitedPatterns: [
      '50/50 split',
      'pill navigation',
      'centered hero',
      'single isolated image on right'
    ],
    keywords: ['editorial', 'journal', 'magazine', 'publication', 'architecture']
  },
  {
    id: 'type-staircase',
    name: 'Typographic staircase',
    intent: 'Move the reading path diagonally through staggered phrases.',
    rhythm: 'balanced',
    grid: '10 columns × 7 rows',
    viewportBehavior: 'Each phrase begins on a later column; CTA anchors the final step.',
    contentOrder: ['headline', 'body', 'actions', 'metadata'],
    regions: [
      region(
        'headline',
        'three phrase blocks: cols 1–6, 3–8, 5–10',
        'stacked with alternating inset'
      ),
      region('body', 'columns 1–3, bottom', 'below phrases'),
      region('actions', 'columns 8–10, bottom', 'full-width after body'),
      region('metadata', 'top-right', 'top row')
    ],
    compatiblePresets: ['playful', 'editorial', 'industrial'],
    compatibleNavigation: ['corner-controls', 'utility-dock', 'perimeter'],
    requires: ['headline divisible into 2–4 short phrases'],
    prohibitedPatterns: [
      'single left-aligned headline column',
      'hero image on right',
      'centered stack',
      'equal two-column grid'
    ],
    keywords: ['kinetic', 'creative', 'studio', 'music', 'youth']
  },
  {
    id: 'modular-field',
    name: 'Modular content field',
    intent: 'Compose the opening from unequal fragments rather than two halves.',
    rhythm: 'dense',
    grid: '8 × 6 modular grid with unequal spans',
    viewportBehavior: 'Headline, media, proof, and navigation each own a non-equal module.',
    contentOrder: ['navigation', 'headline', 'media', 'metadata', 'actions'],
    regions: [
      region('headline', 'columns 1–5, rows 2–4', 'top two modules'),
      region('media', 'columns 6–8, rows 1–3 plus col 1–2 row 5', 'single wide crop'),
      region('metadata', 'small modules across perimeter', 'inline below copy'),
      region('actions', 'columns 5–8, row 6', 'bottom module')
    ],
    compatiblePresets: ['playful', 'technical', 'industrial', 'editorial'],
    compatibleNavigation: ['embedded-index', 'utility-dock', 'corner-controls'],
    requires: ['at least three distinct content types'],
    prohibitedPatterns: [
      'two equal halves',
      'three equal cards',
      'separate conventional navbar',
      'all modules same size'
    ],
    keywords: ['community', 'programs', 'portfolio', 'projects', 'platform']
  },
  {
    id: 'vertical-rail',
    name: 'Vertical rail stage',
    intent: 'Use a persistent side rail to frame a changing main stage.',
    rhythm: 'balanced',
    grid: 'fixed 72–112px rail + 10-column stage',
    viewportBehavior:
      'Rail owns identity and navigation; hero content can occupy the full remaining width.',
    contentOrder: ['navigation', 'media', 'headline', 'actions', 'metadata'],
    regions: [
      region('navigation', 'fixed left rail, full height', 'top compact bar'),
      region('media', 'stage columns 1–10, background or upper field', 'upper half'),
      region('headline', 'stage columns 2–9, lower field', 'below media'),
      region('actions', 'stage lower-right', 'below headline'),
      region('metadata', 'rail bottom', 'footer row')
    ],
    compatiblePresets: ['technical', 'industrial', 'editorial', 'minimal'],
    compatibleNavigation: ['vertical-rail'],
    requires: ['short brand mark', '4 or fewer primary links'],
    prohibitedPatterns: [
      'top horizontal navbar',
      '50/50 split',
      'copy confined to left half',
      'decorative empty right panel'
    ],
    keywords: ['technical', 'institution', 'museum', 'archive', 'developer']
  },
  {
    id: 'bottom-loaded',
    name: 'Bottom-loaded atmosphere',
    intent: 'Reserve the upper field for atmosphere and load meaning along the baseline.',
    rhythm: 'spacious',
    grid: '12 columns × 8 rows',
    viewportBehavior:
      'Upper 55–65% is purposeful media or texture; all copy aligns along the bottom.',
    contentOrder: ['media', 'headline', 'body', 'actions'],
    regions: [
      region('media', 'columns 1–12, rows 1–5', 'upper half'),
      region('headline', 'columns 1–7, rows 6–8', 'lower half'),
      region('body', 'columns 8–10, rows 7–8', 'below headline'),
      region('actions', 'columns 11–12, row 8', 'final row')
    ],
    compatiblePresets: ['luxury', 'editorial', 'minimal', 'playful'],
    compatibleNavigation: ['overlay-minimal', 'perimeter', 'corner-controls'],
    requires: ['purposeful atmospheric visual'],
    prohibitedPatterns: [
      'copy vertically centered',
      'right-side image panel',
      'large top padding before headline',
      'boxed CTA panel'
    ],
    keywords: ['atmospheric', 'premium', 'calm', 'immersive', 'art']
  },
  {
    id: 'framed-stage',
    name: 'Inset framed stage',
    intent: 'Treat the viewport as a designed object with an active perimeter.',
    rhythm: 'balanced',
    grid: 'outer frame + 9-column inner stage',
    viewportBehavior:
      'Navigation and metadata occupy the frame; main statement breaks one frame edge.',
    contentOrder: ['navigation', 'headline', 'media', 'actions', 'metadata'],
    regions: [
      region('navigation', 'top and right frame edges', 'top edge'),
      region('headline', 'inner columns 1–7; one line crosses frame', 'inner top'),
      region('media', 'inner columns 3–9, lower rows', 'full-width below headline'),
      region('actions', 'left frame edge, bottom', 'below media'),
      region('metadata', 'bottom frame edge', 'footer line')
    ],
    compatiblePresets: ['editorial', 'industrial', 'luxury', 'technical'],
    compatibleNavigation: ['perimeter', 'corner-controls'],
    requires: ['visible frame boundary'],
    prohibitedPatterns: [
      'standard full-width navbar',
      'contained card hero',
      'symmetrical margins everywhere',
      'left-copy-right-image'
    ],
    keywords: ['gallery', 'exhibition', 'architecture', 'premium', 'launch']
  },
  {
    id: 'radial-core',
    name: 'Radial core',
    intent: 'Organize short information around one meaningful central object.',
    rhythm: 'balanced',
    grid: 'central radial field mapped to 12-column fallback',
    viewportBehavior:
      'Central mark/media anchors the composition; copy occupies separated orbital positions.',
    contentOrder: ['media', 'headline', 'metadata', 'actions'],
    regions: [
      region('media', 'central 35% of viewport', 'upper center'),
      region('headline', 'left and lower-left orbit', 'below core'),
      region('metadata', 'upper-right orbit', 'top edge'),
      region('actions', 'lower-right orbit', 'bottom')
    ],
    compatiblePresets: ['technical', 'playful', 'industrial'],
    compatibleNavigation: ['corner-controls', 'perimeter', 'utility-dock'],
    requires: ['meaningful central mark or object', 'short supporting fragments'],
    prohibitedPatterns: [
      'media isolated in right half',
      'all text grouped left',
      'decorative orbit without semantic labels',
      'standard navbar'
    ],
    keywords: ['network', 'community', 'science', 'space', 'system', 'ai']
  },
  {
    id: 'horizontal-sequence',
    name: 'Horizontal narrative sequence',
    intent: 'Make the first viewport read as three connected beats.',
    rhythm: 'dense',
    grid: 'three unequal vertical scenes: 5/3/4 columns',
    viewportBehavior: 'Scenes form a continuous narrative, not copy and illustration halves.',
    contentOrder: ['headline', 'media', 'body', 'actions', 'metadata'],
    regions: [
      region('headline', 'scene one, columns 1–5', 'top'),
      region('media', 'scene two, columns 6–8', 'middle'),
      region('body', 'scene three, columns 9–12', 'below media'),
      region('actions', 'scene three bottom', 'full width'),
      region('metadata', 'across scene boundaries', 'inline')
    ],
    compatiblePresets: ['editorial', 'playful', 'technical', 'industrial'],
    compatibleNavigation: ['utility-dock', 'perimeter', 'embedded-index'],
    requires: ['content with a before/during/after or three-beat story'],
    prohibitedPatterns: [
      'two-column split',
      'three equal columns',
      'independent cards',
      'headline and CTA stacked conventionally'
    ],
    keywords: ['process', 'journey', 'how it works', 'education', 'project']
  },
  {
    id: 'index-opener',
    name: 'Index as hero',
    intent: 'Turn the organization or offering index into the primary visual.',
    rhythm: 'dense',
    grid: '4-column index with oversized active row',
    viewportBehavior: 'Navigation and hero merge; one active item carries the primary statement.',
    contentOrder: ['navigation', 'headline', 'metadata', 'actions'],
    regions: [
      region('navigation', 'full-width numbered index, rows 2–7', 'stacked index'),
      region('headline', 'inside or adjacent to active index item', 'top active item'),
      region('metadata', 'right edge of each row', 'below each label'),
      region('actions', 'final index row', 'bottom')
    ],
    compatiblePresets: ['technical', 'minimal', 'editorial', 'industrial'],
    compatibleNavigation: ['embedded-index', 'vertical-rail', 'masthead'],
    requires: ['3–6 meaningful sections or programs'],
    prohibitedPatterns: [
      'separate link row navbar',
      'hero image on right',
      'generic feature cards',
      'duplicate navigation'
    ],
    keywords: ['programs', 'services', 'school', 'organization', 'agency', 'archive']
  },
  {
    id: 'layered-collage',
    name: 'Layered editorial collage',
    intent: 'Create depth through purposeful overlapping crops and type.',
    rhythm: 'balanced',
    grid: '12-column canvas with 3 depth planes',
    viewportBehavior:
      'Two or three media crops overlap the headline without obscuring reading order.',
    contentOrder: ['headline', 'media', 'metadata', 'actions'],
    regions: [
      region('headline', 'columns 2–11, middle plane', 'top layer'),
      region('media', 'unequal crops at cols 1–4 and 8–12', 'two stacked crops'),
      region('metadata', 'attached to crop edges', 'below primary crop'),
      region('actions', 'open corner opposite focal crop', 'below headline')
    ],
    compatiblePresets: ['playful', 'editorial', 'luxury'],
    compatibleNavigation: ['corner-controls', 'overlay-minimal', 'perimeter'],
    requires: ['two or three related image crops'],
    prohibitedPatterns: [
      'single image in right column',
      'equal photo mosaic',
      'text inside glass card',
      'centered hero stack'
    ],
    keywords: ['fashion', 'culture', 'creative', 'festival', 'portfolio']
  }
];

export const navigationCatalog: readonly NavigationDefinition[] = [
  {
    id: 'standard-horizontal',
    name: 'Standard horizontal',
    placement: 'top bar',
    relationshipToHero: 'separate from hero',
    density: 'full',
    compatibleHeroes: [],
    desktop: 'logo left; links center/right; CTA right',
    mobile: 'logo and menu trigger',
    prohibitedPatterns: ['use as default', 'pair with archetypes that prohibit it']
  },
  {
    id: 'corner-controls',
    name: 'Corner controls',
    placement: 'four viewport corners',
    relationshipToHero: 'part of the hero canvas',
    density: 'minimal',
    compatibleHeroes: [
      'poster',
      'cinematic-full-bleed',
      'type-staircase',
      'modular-field',
      'bottom-loaded',
      'framed-stage',
      'radial-core',
      'layered-collage'
    ],
    desktop: 'brand top-left, menu top-right, context bottom-left, action bottom-right',
    mobile: 'brand top-left and menu top-right; context moves below hero',
    prohibitedPatterns: ['continuous navbar background', 'centered link row']
  },
  {
    id: 'perimeter',
    name: 'Perimeter navigation',
    placement: 'along frame edges',
    relationshipToHero: 'defines the composition boundary',
    density: 'compact',
    compatibleHeroes: [
      'poster',
      'cinematic-full-bleed',
      'editorial-masthead',
      'type-staircase',
      'framed-stage',
      'radial-core',
      'horizontal-sequence',
      'layered-collage'
    ],
    desktop: 'brand and links distributed across top/bottom edges',
    mobile: 'single top edge plus expandable index',
    prohibitedPatterns: ['logo-links-cta cluster', 'detached rounded nav container']
  },
  {
    id: 'overlay-minimal',
    name: 'Minimal overlay',
    placement: 'over hero media',
    relationshipToHero: 'transparent overlay with no separate bar',
    density: 'minimal',
    compatibleHeroes: ['cinematic-full-bleed', 'bottom-loaded', 'layered-collage'],
    desktop: 'brand and one menu control over media',
    mobile: 'same with protected contrast zone',
    prohibitedPatterns: ['opaque navbar', 'more than two visible controls']
  },
  {
    id: 'vertical-rail',
    name: 'Vertical rail',
    placement: 'fixed left edge',
    relationshipToHero: 'rail removes the need for a top navbar',
    density: 'compact',
    compatibleHeroes: ['vertical-rail', 'index-opener'],
    desktop: 'rotated or stacked brand, links, and action in a 72–112px rail',
    mobile: 'collapse to compact top bar',
    prohibitedPatterns: ['additional top navbar', 'horizontal desktop link row']
  },
  {
    id: 'masthead',
    name: 'Editorial masthead',
    placement: 'top two rows',
    relationshipToHero: 'publication identity and navigation share one typographic system',
    density: 'full',
    compatibleHeroes: ['editorial-masthead', 'index-opener'],
    desktop: 'utility row, oversized wordmark row, section links',
    mobile: 'wordmark row and menu trigger',
    prohibitedPatterns: ['pill CTA in masthead', 'generic app navbar spacing']
  },
  {
    id: 'embedded-index',
    name: 'Embedded index',
    placement: 'inside hero content grid',
    relationshipToHero: 'navigation is the primary content structure',
    density: 'full',
    compatibleHeroes: ['modular-field', 'horizontal-sequence', 'index-opener'],
    desktop: 'numbered links occupy hero modules or rows',
    mobile: 'stacked index below active statement',
    prohibitedPatterns: ['duplicate navbar links', 'separate nav card']
  },
  {
    id: 'utility-dock',
    name: 'Utility dock',
    placement: 'bottom or side edge',
    relationshipToHero: 'identity is separate; navigation behaves like a compact tool strip',
    density: 'compact',
    compatibleHeroes: [
      'poster',
      'type-staircase',
      'modular-field',
      'radial-core',
      'horizontal-sequence'
    ],
    desktop: 'compact labeled controls anchored to one edge',
    mobile: 'bottom dock or top compact row',
    prohibitedPatterns: ['floating glass pill', 'oversized primary CTA inside dock']
  }
];

export interface CompositionSignature {
  /** Stable hero archetype identifier; review may also report an unclassified value. */
  heroArchetype: string;
  navigationMode: NavigationId;
  sectionSequence: readonly string[];
  preset: VisualPreset;
}

export const signatureSimilarity = (a: CompositionSignature, b: CompositionSignature): number => {
  const hero = a.heroArchetype === b.heroArchetype ? 0.45 : 0;
  const nav = a.navigationMode === b.navigationMode ? 0.25 : 0;
  const max = Math.max(a.sectionSequence.length, b.sectionSequence.length, 1);
  const sequence =
    (a.sectionSequence.filter((value, index) => b.sectionSequence[index] === value).length / max) *
    0.2;
  const preset = a.preset === b.preset ? 0.1 : 0;
  return Number((hero + nav + sequence + preset).toFixed(3));
};
