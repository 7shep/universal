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

export type SpatialSlot = 'headline' | 'body' | 'media' | 'actions' | 'metadata' | 'navigation';
/** Stable catalog identity. Runtime section records receive their own opaque `section_` UUID. */
export type SectionId = `section:${string}`;
/** Stable address for a region within a catalog section template. */
export type RegionId = `region:${string}:${SpatialSlot}`;

/** Page-level composition retained for design-engine and linter consumers. */
export interface Composition extends Identifiable {
  name: string;
  intent: string;
  rhythm: 'dense' | 'balanced' | 'spacious';
  sections: readonly CompositionSection[];
}
export interface CompositionSection extends Identifiable {
  id: SectionId;
  kind: 'hero' | 'narrative' | 'gallery' | 'proof' | 'cta' | 'footer';
  purpose: string;
  emphasis: 'primary' | 'supporting' | 'quiet';
  slots: readonly SpatialSlot[];
}

export interface SpatialRegion {
  id: RegionId;
  slot: SpatialSlot;
  desktop: string;
  mobile: string;
}

export interface HeroArchetype extends Identifiable {
  /** Stable identity of the hero section template used by generation and targeted revision. */
  sectionId: SectionId;
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

interface SpatialRegionDefinition {
  slot: SpatialSlot;
  desktop: string;
  mobile: string;
}

type HeroArchetypeDefinition = Omit<HeroArchetype, 'sectionId' | 'regions'> & {
  regions: readonly SpatialRegionDefinition[];
};

const region = (slot: SpatialSlot, desktop: string, mobile: string): SpatialRegionDefinition => ({
  slot,
  desktop,
  mobile
});

const heroDefinitions: readonly HeroArchetypeDefinition[] = [
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
      region('navigation', 'embedded in perimeter modules', 'compact top module'),
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

export const compositionCatalog: readonly HeroArchetype[] = heroDefinitions.map((hero) => ({
  ...hero,
  sectionId: `section:${hero.id}`,
  regions: hero.regions.map((item) => ({
    ...item,
    id: `region:${hero.id}:${item.slot}`
  }))
}));

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
      'bottom-loaded',
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

export interface CompositionCatalogData {
  heroes: readonly HeroArchetype[];
  navigation: readonly NavigationDefinition[];
}

export interface CompositionValidationIssue {
  path: string;
  message: string;
}

export type CompositionValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly CompositionValidationIssue[] };

const visualPresets: readonly VisualPreset[] = [
  'editorial',
  'industrial',
  'minimal',
  'playful',
  'technical',
  'luxury'
];
const navigationIds: readonly NavigationId[] = [
  'standard-horizontal',
  'corner-controls',
  'perimeter',
  'overlay-minimal',
  'vertical-rail',
  'masthead',
  'embedded-index',
  'utility-dock'
];
const spatialSlots: readonly SpatialSlot[] = [
  'headline',
  'body',
  'media',
  'actions',
  'metadata',
  'navigation'
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

function validationResult<T>(
  value: unknown,
  errors: readonly CompositionValidationIssue[]
): CompositionValidationResult<T> {
  return errors.length === 0 ? { ok: true, value: value as T } : { ok: false, errors: [...errors] };
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: CompositionValidationIssue[]
): void {
  if (!isNonEmptyString(value[key]))
    errors.push({ path: `${path}.${key}`, message: `${key} must be a non-empty string.` });
}

/** Validate an untrusted spatial region without relying on TypeScript types at runtime. */
export function validateSpatialRegion(
  value: unknown,
  path = 'region'
): CompositionValidationResult<SpatialRegion> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Spatial region must be an object.' }] };
  requireString(value, 'id', path, errors);
  if (typeof value.slot !== 'string' || !spatialSlots.includes(value.slot as SpatialSlot))
    errors.push({ path: `${path}.slot`, message: 'Region slot is not supported.' });
  requireString(value, 'desktop', path, errors);
  requireString(value, 'mobile', path, errors);
  return validationResult<SpatialRegion>(value, errors);
}

/** Validate a stable, serializable section template used by generation and revision. */
export function validateCompositionSection(
  value: unknown,
  path = 'section'
): CompositionValidationResult<CompositionSection> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Composition section must be an object.' }] };
  requireString(value, 'id', path, errors);
  requireString(value, 'purpose', path, errors);
  if (!isNonEmptyString(value.id) || !value.id.startsWith('section:'))
    errors.push({ path: `${path}.id`, message: 'Section id must start with "section:".' });
  if (!['hero', 'narrative', 'gallery', 'proof', 'cta', 'footer'].includes(String(value.kind)))
    errors.push({ path: `${path}.kind`, message: 'Section kind is not supported.' });
  if (!['primary', 'supporting', 'quiet'].includes(String(value.emphasis)))
    errors.push({ path: `${path}.emphasis`, message: 'Section emphasis is not supported.' });
  if (
    !Array.isArray(value.slots) ||
    value.slots.length === 0 ||
    !value.slots.every(
      (slot) => typeof slot === 'string' && spatialSlots.includes(slot as SpatialSlot)
    )
  )
    errors.push({ path: `${path}.slots`, message: 'Section slots must contain supported slots.' });
  else if (new Set(value.slots).size !== value.slots.length)
    errors.push({ path: `${path}.slots`, message: 'Section slots must not repeat.' });
  return validationResult<CompositionSection>(value, errors);
}

/** Validate a page-level composition and its stable section identities. */
export function validateComposition(
  value: unknown,
  path = 'composition'
): CompositionValidationResult<Composition> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Composition must be an object.' }] };
  for (const field of ['id', 'name', 'intent'] as const) requireString(value, field, path, errors);
  if (!['dense', 'balanced', 'spacious'].includes(String(value.rhythm)))
    errors.push({ path: `${path}.rhythm`, message: 'Composition rhythm is not supported.' });
  if (!Array.isArray(value.sections) || value.sections.length === 0)
    errors.push({ path: `${path}.sections`, message: 'Composition must contain sections.' });
  else {
    const ids = new Set<string>();
    for (const [index, section] of value.sections.entries()) {
      const result = validateCompositionSection(section, `${path}.sections.${index}`);
      if (!result.ok) errors.push(...result.errors);
      if (isRecord(section) && isNonEmptyString(section.id)) {
        if (ids.has(section.id))
          errors.push({
            path: `${path}.sections.${index}.id`,
            message: `Duplicate section id "${section.id}".`
          });
        ids.add(section.id);
      }
    }
  }
  return validationResult<Composition>(value, errors);
}

/** Validate an untrusted hero archetype, including stable section and region coordinates. */
export function validateHeroArchetype(
  value: unknown,
  path = 'hero'
): CompositionValidationResult<HeroArchetype> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Hero archetype must be an object.' }] };
  for (const field of ['id', 'sectionId', 'name', 'intent', 'grid', 'viewportBehavior'] as const)
    requireString(value, field, path, errors);
  if (isNonEmptyString(value.id) && value.sectionId !== `section:${value.id}`)
    errors.push({
      path: `${path}.sectionId`,
      message: `sectionId must be the stable catalog id "section:${value.id}".`
    });
  if (!['dense', 'balanced', 'spacious'].includes(String(value.rhythm)))
    errors.push({ path: `${path}.rhythm`, message: 'Hero rhythm is not supported.' });
  for (const field of ['requires', 'prohibitedPatterns', 'keywords'] as const) {
    if (!isStringArray(value[field]) || value[field].length === 0)
      errors.push({
        path: `${path}.${field}`,
        message: `${field} must contain at least one non-empty string.`
      });
  }
  if (
    !Array.isArray(value.compatiblePresets) ||
    value.compatiblePresets.length === 0 ||
    !value.compatiblePresets.every(
      (preset) => typeof preset === 'string' && visualPresets.includes(preset as VisualPreset)
    )
  )
    errors.push({
      path: `${path}.compatiblePresets`,
      message: 'compatiblePresets must contain supported preset ids.'
    });
  if (
    !Array.isArray(value.compatibleNavigation) ||
    value.compatibleNavigation.length === 0 ||
    !value.compatibleNavigation.every(
      (id) => typeof id === 'string' && navigationIds.includes(id as NavigationId)
    )
  )
    errors.push({
      path: `${path}.compatibleNavigation`,
      message: 'compatibleNavigation must contain supported navigation ids.'
    });
  if (
    !Array.isArray(value.contentOrder) ||
    value.contentOrder.length === 0 ||
    !value.contentOrder.every(
      (slot) => typeof slot === 'string' && spatialSlots.includes(slot as SpatialSlot)
    )
  )
    errors.push({ path: `${path}.contentOrder`, message: 'contentOrder contains invalid slots.' });
  else if (new Set(value.contentOrder).size !== value.contentOrder.length)
    errors.push({ path: `${path}.contentOrder`, message: 'contentOrder must not repeat slots.' });

  if (!Array.isArray(value.regions) || value.regions.length === 0)
    errors.push({ path: `${path}.regions`, message: 'Hero must define spatial regions.' });
  else {
    const regionIds = new Set<string>();
    const regionSlots = new Set<string>();
    for (const [index, item] of value.regions.entries()) {
      const regionPath = `${path}.regions.${index}`;
      const result = validateSpatialRegion(item, regionPath);
      if (!result.ok) errors.push(...result.errors);
      if (!isRecord(item)) continue;
      if (isNonEmptyString(item.id)) {
        if (regionIds.has(item.id))
          errors.push({ path: `${regionPath}.id`, message: `Duplicate region id "${item.id}".` });
        regionIds.add(item.id);
      }
      if (typeof item.slot === 'string') {
        if (regionSlots.has(item.slot))
          errors.push({
            path: `${regionPath}.slot`,
            message: `Duplicate region slot "${item.slot}".`
          });
        regionSlots.add(item.slot);
        if (isNonEmptyString(value.id) && item.id !== `region:${value.id}:${item.slot}`)
          errors.push({
            path: `${regionPath}.id`,
            message: `Region id must be "region:${value.id}:${item.slot}".`
          });
      }
    }
    if (!regionSlots.has('headline'))
      errors.push({ path: `${path}.regions`, message: 'Hero must define a headline region.' });
    if (Array.isArray(value.contentOrder))
      for (const slot of value.contentOrder)
        if (typeof slot === 'string' && !regionSlots.has(slot))
          errors.push({
            path: `${path}.contentOrder`,
            message: `Content-order slot "${slot}" has no spatial region.`
          });
  }
  return validationResult<HeroArchetype>(value, errors);
}

/** Validate an untrusted navigation definition. */
export function validateNavigationDefinition(
  value: unknown,
  path = 'navigation'
): CompositionValidationResult<NavigationDefinition> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Navigation definition must be an object.' }] };
  for (const field of [
    'id',
    'name',
    'placement',
    'relationshipToHero',
    'desktop',
    'mobile'
  ] as const)
    requireString(value, field, path, errors);
  if (typeof value.id !== 'string' || !navigationIds.includes(value.id as NavigationId))
    errors.push({ path: `${path}.id`, message: `Unknown navigation id "${String(value.id)}".` });
  if (!['minimal', 'compact', 'full'].includes(String(value.density)))
    errors.push({ path: `${path}.density`, message: 'Navigation density is not supported.' });
  if (!isStringArray(value.compatibleHeroes))
    errors.push({ path: `${path}.compatibleHeroes`, message: 'compatibleHeroes must be strings.' });
  if (!isStringArray(value.prohibitedPatterns) || value.prohibitedPatterns.length === 0)
    errors.push({
      path: `${path}.prohibitedPatterns`,
      message: 'Navigation must define at least one prohibited pattern.'
    });
  return validationResult<NavigationDefinition>(value, errors);
}

/** Validate a structural signature before persistence or comparison. */
export function validateCompositionSignature(
  value: unknown,
  path = 'signature'
): CompositionValidationResult<CompositionSignature> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Composition signature must be an object.' }] };
  requireString(value, 'heroArchetype', path, errors);
  if (
    typeof value.navigationMode !== 'string' ||
    !navigationIds.includes(value.navigationMode as NavigationId)
  )
    errors.push({
      path: `${path}.navigationMode`,
      message: 'Signature navigation mode is invalid.'
    });
  if (typeof value.preset !== 'string' || !visualPresets.includes(value.preset as VisualPreset))
    errors.push({ path: `${path}.preset`, message: 'Signature preset is invalid.' });
  if (!isStringArray(value.sectionSequence) || value.sectionSequence.length === 0)
    errors.push({
      path: `${path}.sectionSequence`,
      message: 'Signature sectionSequence must contain non-empty section patterns.'
    });
  return validationResult<CompositionSignature>(value, errors);
}

/** Validate the selected contract and its cross-field compatibility. */
export function validateCompositionContract(
  value: unknown,
  path = 'composition'
): CompositionValidationResult<CompositionContract> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path, message: 'Composition contract must be an object.' }] };
  const hero = validateHeroArchetype(value.hero, `${path}.hero`);
  const navigation = validateNavigationDefinition(value.navigation, `${path}.navigation`);
  const signature = validateCompositionSignature(value.signature, `${path}.signature`);
  if (!hero.ok) errors.push(...hero.errors);
  if (!navigation.ok) errors.push(...navigation.errors);
  if (!signature.ok) errors.push(...signature.errors);
  if (hero.ok && navigation.ok) {
    if (!hero.value.compatibleNavigation.includes(navigation.value.id))
      errors.push({
        path: `${path}.navigation.id`,
        message: `Navigation "${navigation.value.id}" is not compatible with hero "${hero.value.id}".`
      });
    if (!navigation.value.compatibleHeroes.includes(hero.value.id))
      errors.push({
        path: `${path}.navigation.compatibleHeroes`,
        message: `Navigation "${navigation.value.id}" does not reference hero "${hero.value.id}".`
      });
  }
  if (hero.ok && signature.ok) {
    if (signature.value.heroArchetype !== hero.value.id)
      errors.push({
        path: `${path}.signature.heroArchetype`,
        message: 'Signature hero does not match.'
      });
    if (!hero.value.compatiblePresets.includes(signature.value.preset))
      errors.push({
        path: `${path}.signature.preset`,
        message: 'Signature preset is incompatible.'
      });
  }
  if (navigation.ok && signature.ok && signature.value.navigationMode !== navigation.value.id)
    errors.push({
      path: `${path}.signature.navigationMode`,
      message: 'Signature navigation does not match.'
    });
  return validationResult<CompositionContract>(value, errors);
}

/** Validate catalog-wide uniqueness and bidirectional references. */
export function validateCompositionCatalog(
  value: unknown
): CompositionValidationResult<CompositionCatalogData> {
  const errors: CompositionValidationIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [{ path: 'catalog', message: 'Catalog must be an object.' }] };
  if (!Array.isArray(value.heroes))
    errors.push({ path: 'catalog.heroes', message: 'Catalog heroes must be an array.' });
  if (!Array.isArray(value.navigation))
    errors.push({ path: 'catalog.navigation', message: 'Catalog navigation must be an array.' });
  if (!Array.isArray(value.heroes) || !Array.isArray(value.navigation))
    return { ok: false, errors };

  const heroIds = new Set<string>();
  for (const [index, hero] of value.heroes.entries()) {
    const result = validateHeroArchetype(hero, `catalog.heroes.${index}`);
    if (!result.ok) errors.push(...result.errors);
    if (isRecord(hero) && isNonEmptyString(hero.id)) {
      if (heroIds.has(hero.id))
        errors.push({
          path: `catalog.heroes.${index}.id`,
          message: `Duplicate hero id "${hero.id}".`
        });
      heroIds.add(hero.id);
    }
  }
  const navigationById = new Map<string, Record<string, unknown>>();
  for (const [index, navigation] of value.navigation.entries()) {
    const result = validateNavigationDefinition(navigation, `catalog.navigation.${index}`);
    if (!result.ok) errors.push(...result.errors);
    if (isRecord(navigation) && isNonEmptyString(navigation.id)) {
      if (navigationById.has(navigation.id))
        errors.push({
          path: `catalog.navigation.${index}.id`,
          message: `Duplicate navigation id "${navigation.id}".`
        });
      navigationById.set(navigation.id, navigation);
    }
  }
  for (const [heroIndex, hero] of value.heroes.entries()) {
    if (!isRecord(hero) || !isNonEmptyString(hero.id) || !Array.isArray(hero.compatibleNavigation))
      continue;
    for (const navigationId of hero.compatibleNavigation) {
      const navigation = navigationById.get(String(navigationId));
      if (!navigation)
        errors.push({
          path: `catalog.heroes.${heroIndex}.compatibleNavigation`,
          message: `Hero "${hero.id}" references missing navigation "${String(navigationId)}".`
        });
      else if (
        !Array.isArray(navigation.compatibleHeroes) ||
        !navigation.compatibleHeroes.includes(hero.id)
      )
        errors.push({
          path: `catalog.heroes.${heroIndex}.compatibleNavigation`,
          message: `Hero "${hero.id}" and navigation "${String(navigationId)}" must reference each other.`
        });
    }
  }
  for (const [navigationIndex, navigation] of value.navigation.entries()) {
    if (
      !isRecord(navigation) ||
      !isNonEmptyString(navigation.id) ||
      !Array.isArray(navigation.compatibleHeroes)
    )
      continue;
    for (const heroId of navigation.compatibleHeroes) {
      const hero = value.heroes.find((candidate) => isRecord(candidate) && candidate.id === heroId);
      if (!hero)
        errors.push({
          path: `catalog.navigation.${navigationIndex}.compatibleHeroes`,
          message: `Navigation "${navigation.id}" references missing hero "${String(heroId)}".`
        });
      else if (
        !Array.isArray(hero.compatibleNavigation) ||
        !hero.compatibleNavigation.includes(navigation.id)
      )
        errors.push({
          path: `catalog.navigation.${navigationIndex}.compatibleHeroes`,
          message: `Navigation "${navigation.id}" and hero "${String(heroId)}" must reference each other.`
        });
    }
  }
  return validationResult<CompositionCatalogData>(value, errors);
}

export class CompositionCatalogValidationError extends Error {
  readonly issues: readonly CompositionValidationIssue[];

  constructor(issues: readonly CompositionValidationIssue[]) {
    super(
      `Invalid composition catalog:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`
    );
    this.name = 'CompositionCatalogValidationError';
    this.issues = [...issues];
  }
}

export function assertValidCompositionCatalog(value: unknown): CompositionCatalogData {
  const result = validateCompositionCatalog(value);
  if (!result.ok) throw new CompositionCatalogValidationError(result.errors);
  return result.value;
}

export interface CompositionSelectionBrief {
  prompt: string;
  audience?: string | undefined;
  websiteType?: string | undefined;
  preferences?: readonly string[] | undefined;
  constraints?: readonly string[] | undefined;
}

/** JSON-safe, complete input to deterministic selection; no module state is consulted. */
export interface CompositionSelectionInput {
  brief: CompositionSelectionBrief;
  preset: VisualPreset;
  sectionSequence: readonly string[];
  seed: number;
  recentSignatures: readonly CompositionSignature[];
  history: readonly CompositionSignature[];
}

export interface CompositionSelection {
  hero: HeroArchetype;
  navigation: NavigationDefinition;
  signature: CompositionSignature;
  seed: number;
  noveltyScore: number;
  fallback: 'none' | 'history-exhausted';
}

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1)
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
};
const seededFraction = (seed: number, salt: string): number => hash(`${seed}:${salt}`) / 0xffffffff;

/** Select a composition deterministically from only the supplied input and catalog. */
export function selectComposition(
  input: CompositionSelectionInput,
  catalog: CompositionCatalogData = compositionDomainCatalog
): CompositionSelection {
  const validatedCatalog = assertValidCompositionCatalog(catalog);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0)
    throw new TypeError('Composition selection seed must be a non-negative safe integer.');
  if (!isNonEmptyString(input.brief.prompt))
    throw new TypeError('Composition selection brief.prompt must be a non-empty string.');
  if (!visualPresets.includes(input.preset)) throw new TypeError('Composition preset is invalid.');
  if (!isStringArray(input.sectionSequence) || input.sectionSequence.length === 0)
    throw new TypeError('Composition sectionSequence must contain non-empty patterns.');
  const history = [...input.history, ...input.recentSignatures].slice(-12);
  for (const [index, signature] of history.entries()) {
    const result = validateCompositionSignature(signature, `history.${index}`);
    if (!result.ok) throw new CompositionCatalogValidationError(result.errors);
  }
  const terms = [
    input.brief.prompt,
    input.brief.audience ?? '',
    input.brief.websiteType ?? '',
    ...(input.brief.preferences ?? []),
    ...(input.brief.constraints ?? [])
  ]
    .join(' ')
    .toLowerCase();
  const candidates = validatedCatalog.heroes
    .filter((hero) => hero.compatiblePresets.includes(input.preset))
    .flatMap((hero) =>
      hero.compatibleNavigation.flatMap((navigationId) => {
        const navigation = validatedCatalog.navigation.find((item) => item.id === navigationId);
        if (!navigation || !navigation.compatibleHeroes.includes(hero.id)) return [];
        const signature: CompositionSignature = {
          heroArchetype: hero.id,
          navigationMode: navigation.id,
          sectionSequence: [...input.sectionSequence],
          preset: input.preset
        };
        const maxSimilarity = history.reduce(
          (maximum, previous) => Math.max(maximum, signatureSimilarity(signature, previous)),
          0
        );
        const noveltyScore = Number((1 - maxSimilarity).toFixed(3));
        const keywordScore = hero.keywords.reduce(
          (score, keyword) => score + (terms.includes(keyword.toLowerCase()) ? 0.12 : 0),
          0
        );
        return [
          {
            hero,
            navigation,
            signature,
            maxSimilarity,
            noveltyScore,
            score:
              keywordScore +
              noveltyScore * 0.65 +
              seededFraction(input.seed, `${hero.id}:${navigation.id}`) * 0.35
          }
        ];
      })
    );
  if (candidates.length === 0)
    throw new Error(`No compatible composition found for preset ${input.preset}.`);
  const novel = candidates.filter((candidate) => candidate.maxSimilarity < 0.75);
  const fallback = novel.length === 0 && history.length > 0 ? 'history-exhausted' : 'none';
  const selected = [...(novel.length > 0 ? novel : candidates)].sort(
    (a, b) =>
      b.score - a.score ||
      a.hero.id.localeCompare(b.hero.id) ||
      a.navigation.id.localeCompare(b.navigation.id)
  )[0]!;
  return {
    hero: selected.hero,
    navigation: selected.navigation,
    signature: selected.signature,
    seed: input.seed,
    noveltyScore: selected.noveltyScore,
    fallback
  };
}

/** Validated, serialization-friendly catalog exported for generator and persistence consumers. */
export const compositionDomainCatalog = assertValidCompositionCatalog({
  heroes: compositionCatalog,
  navigation: navigationCatalog
});
