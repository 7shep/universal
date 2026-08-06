export type TasteCategory =
  | 'typography'
  | 'color'
  | 'composition'
  | 'navigation'
  | 'imagery'
  | 'copy'
  | 'motion'
  | 'controls';

export type TasteSeverity = 'info' | 'warning' | 'error';

/** A durable design-quality principle used by planning and review. */
export interface TastePrinciple {
  id: string;
  statement: string;
  rationale: string;
  appliesTo: TasteCategory;
  priority: 'required' | 'preferred';
}

/** A risky default that requires contextual review rather than a blanket ban. */
export interface AntiPattern {
  id: string;
  description: string;
  detectionHints: readonly string[];
  recommendation: string;
  severityDefault: TasteSeverity;
  allowWhen: readonly string[];
}

/** A concrete choice made while turning a brief into a design direction. */
export interface TasteDecision {
  category: TasteCategory;
  choice: string;
  rationale: string;
  source: 'brief' | 'selected-direction' | 'taste-policy';
  confidence: number;
}

/** A documented exception for a normally risky pattern. */
export interface TasteException {
  pattern: string;
  rationale: string;
}

/** Taste-specific planning data embedded in the canonical DesignPlan. */
export interface TasteDirection {
  profileId: string;
  profileVersion: string;
  designThesis: string;
  decisions: readonly TasteDecision[];
  typographyRationale: string;
  colorRationale: string;
  visualTreatmentRationale: string;
  navigationRationale: string;
  signatureInteraction?: { concept: string; purpose: string } | undefined;
  motionRationale: string;
  reducedMotionBehavior: string;
  rejectedDefaultPatterns: readonly string[];
  exceptions: readonly TasteException[];
}

/** One actionable result from deterministic taste-policy review. */
export interface TasteFinding {
  rule: string;
  severity: TasteSeverity;
  rationale: string;
  actionableFix: string;
}

/** Aggregate taste review outcome, independent of any UI or framework. */
export interface TasteReviewResult {
  score: number;
  findings: readonly TasteFinding[];
  passedPrinciples: readonly string[];
  unresolvedDecisions: readonly string[];
  status: 'pass' | 'revision_recommended';
}

/** Versioned collection of taste principles and contextual anti-pattern guidance. */
export interface DesignTasteProfile {
  id: string;
  name: string;
  version: string;
  principles: readonly TastePrinciple[];
  antiPatterns: readonly AntiPattern[];
  positiveReferenceNotes: readonly string[];
  selectionCriteria: readonly string[];
}

/** Framework-neutral facts used to derive a deterministic taste direction. */
export interface TastePlanningContext {
  brief: string;
  audience?: string | undefined;
  preferences?: readonly string[] | undefined;
  avoid?: readonly string[] | undefined;
  presetName: string;
  brandAttributes: readonly string[];
  artDirection: string;
  displayStyle: string;
  bodyStyle: string;
  backgroundColor: string;
  accentColor: string;
  visualTreatments: readonly string[];
  hero: { name: string; intent: string; grid: string };
  navigation: {
    id: string;
    name: string;
    placement: string;
    relationshipToHero: string;
  };
  motion?: { concept: string; purpose: string; reducedMotionBehavior: string } | undefined;
}

const principles: readonly TastePrinciple[] = [
  {
    id: 'coherent-visual-world',
    statement: 'Typography, imagery, copy, spacing, and motion must support one clear idea.',
    rationale:
      'Coherence makes a direction recognizable and difficult to rebrand indiscriminately.',
    appliesTo: 'composition',
    priority: 'required'
  },
  {
    id: 'deliberate-type-relationship',
    statement: 'Choose a deliberate display and body relationship.',
    rationale: 'Typography can carry hierarchy and composition without ornamental shells.',
    appliesTo: 'typography',
    priority: 'required'
  },
  {
    id: 'brand-specific-color',
    statement:
      'Use color for brand character, hierarchy, or meaning rather than category decoration.',
    rationale: 'Controlled color avoids interchangeable technology aesthetics.',
    appliesTo: 'color',
    priority: 'required'
  },
  {
    id: 'navigation-is-composition',
    statement: 'Select navigation for its relationship to content and reading order.',
    rationale: 'Navigation placement changes the page composition and should not be automatic.',
    appliesTo: 'navigation',
    priority: 'required'
  },
  {
    id: 'purposeful-visual-material',
    statement: 'Use specific brand or product material with one coherent treatment.',
    rationale: 'Purposeful material communicates identity better than placeholder abstraction.',
    appliesTo: 'imagery',
    priority: 'required'
  },
  {
    id: 'specific-copy',
    statement: 'Prefer concrete claims and language grounded in the brief.',
    rationale: 'Specific copy prevents an otherwise polished page from feeling interchangeable.',
    appliesTo: 'copy',
    priority: 'required'
  },
  {
    id: 'purposeful-motion',
    statement:
      'Motion must reveal hierarchy, navigate content, communicate state, or reinforce character.',
    rationale: 'A stated purpose prevents animation from becoming repetitive decoration.',
    appliesTo: 'motion',
    priority: 'required'
  },
  {
    id: 'accessible-reading-order',
    statement: 'Spatial or cinematic behavior must preserve reading order and essential content.',
    rationale:
      'Expressive behavior is only successful when the page remains understandable and operable.',
    appliesTo: 'motion',
    priority: 'required'
  },
  {
    id: 'optically-consistent-controls',
    statement: 'Primary controls require consistent treatment and human review of optical spacing.',
    rationale: 'Source parsing cannot prove perceived balance across labels and viewports.',
    appliesTo: 'controls',
    priority: 'required'
  },
  {
    id: 'purpose-over-ornament',
    statement: 'Favor a few specific details over accumulated ornamental complexity.',
    rationale: 'Restraint keeps the core concept legible.',
    appliesTo: 'composition',
    priority: 'preferred'
  }
];

const antiPatterns: readonly AntiPattern[] = [
  {
    id: 'gradient-text-treatment',
    description:
      'Gradient-clipped text is used as default emphasis rather than meaningful encoding.',
    detectionHints: ['background-clip text with a gradient', 'transparent text fill'],
    recommendation: 'Use typographic contrast or one solid brand color.',
    severityDefault: 'warning',
    allowWhen: ['The gradient has a documented semantic or established brand role.']
  },
  {
    id: 'default-dark-purple-theme',
    description:
      'A dark surface with purple, indigo, or cyan accents is selected as automatic tech styling.',
    detectionHints: ['near-black background with purple accents', 'cyan-on-dark with colored glow'],
    recommendation:
      'Derive the palette from the product and audience instead of the category default.',
    severityDefault: 'warning',
    allowWhen: ['The palette is an established brand asset and the direction explains its use.']
  },
  {
    id: 'low-contrast-dark-theme-text',
    description: 'Muted grey or translucent text on a dark surface fails or barely passes WCAG AA.',
    detectionHints: ['grey body text on near-black', 'translucent white body copy'],
    recommendation: 'Measure rendered color pairs and raise body-copy contrast to WCAG AA.',
    severityDefault: 'error',
    allowWhen: ['Rendered contrast meets WCAG AA for the actual text size and weight.']
  },
  {
    id: 'glassmorphism-orb-decoration',
    description:
      'Frosted surfaces, blurred orbs, or glow borders decorate without a layering purpose.',
    detectionHints: ['backdrop blur cards', 'blurred background orb', 'translucent glow border'],
    recommendation: 'Use solid surfaces and hierarchy unless the treatment explains real layering.',
    severityDefault: 'warning',
    allowWhen: ['The direction documents a material or depth concept that requires it.']
  },
  {
    id: 'colored-card-edge',
    description: 'A thick colored top or left border is used as a generic card accent.',
    detectionHints: ['side-tab card', 'accent border on rounded card', 'colored left stripe'],
    recommendation: 'Use hierarchy, spacing, or a meaningful state instead of a decorative edge.',
    severityDefault: 'warning',
    allowWhen: ['The border communicates a documented state, category, or severity.']
  },
  {
    id: 'template-pattern-cluster',
    description: 'Several generated landing-page motifs appear together as a copy-paste layout.',
    detectionHints: [
      'numbered steps plus stat row',
      'icon-top cards plus all-caps labels',
      'hero badge plus equal sections'
    ],
    recommendation:
      'Keep only structures required by content and vary density, scale, and alignment.',
    severityDefault: 'warning',
    allowWhen: [
      'The plan independently justifies each motif and establishes a non-template hierarchy.'
    ]
  },
  {
    id: 'shadcn-default-fingerprint',
    description: 'Stock shadcn tokens, radii, typography, and utilities ship without adaptation.',
    detectionHints: [
      'default card and muted tokens',
      'rounded-md shells',
      'text-muted-foreground everywhere'
    ],
    recommendation:
      'Keep accessible primitives but replace the default visual system and composition.',
    severityDefault: 'warning',
    allowWhen: ['The product design system intentionally documents those exact tokens.']
  },
  {
    id: 'cluttered-primary-actions',
    description: 'Too many controls, metrics, or requests compete at the top level.',
    detectionHints: ['five or more hero actions', 'secondary analytics beside the primary CTA'],
    recommendation: 'Keep the primary task visible and disclose secondary tools progressively.',
    severityDefault: 'warning',
    allowWhen: ['A documented expert workflow requires simultaneous access to the controls.']
  },
  {
    id: 'lazy-impact-statement',
    description: 'Copy claims impact or transformation without naming a mechanism or outcome.',
    detectionHints: ['drive meaningful impact', 'transform your workflow', 'results that matter'],
    recommendation: 'Name the audience, action, product mechanism, or measurable result.',
    severityDefault: 'warning',
    allowWhen: [
      'The claim is immediately supported by specific evidence and approved campaign language.'
    ]
  },
  {
    id: 'redundant-interface-copy',
    description: 'Labels, sublabels, helper text, and tooltips repeat the same instruction.',
    detectionHints: ['same label repeated in one container', 'helper text restates the label'],
    recommendation: 'Say the instruction once where it is most useful.',
    severityDefault: 'warning',
    allowWhen: ['Repetition is required across independently encountered accessible contexts.']
  },
  {
    id: 'generic-font-monoculture',
    description: 'Inter or Geist carries every role without a deliberate internal type system.',
    detectionHints: ['one font family everywhere', 'Inter headings, body, labels, and buttons'],
    recommendation:
      'Choose a product-specific voice or define contrast through width, weight, scale, and rhythm.',
    severityDefault: 'warning',
    allowWhen: ['The plan documents a strong single-family system with measurable contrast.']
  },
  {
    id: 'stock-font-pairing',
    description:
      'A frequently generated font combination or isolated serif-italic accent substitutes for a type concept.',
    detectionHints: [
      'Space Grotesk plus Instrument Serif',
      'Geist utility type',
      'one italic serif hero word'
    ],
    recommendation: 'Assign type roles from the brand concept rather than a fashionable default.',
    severityDefault: 'warning',
    allowWhen: ['The direction establishes an editorial register and explains the pairing.']
  },
  {
    id: 'centered-generic-sans-hero',
    description: 'A centered hero uses a generic sans-serif and familiar SaaS framing.',
    detectionHints: ['centered Inter hero', 'badge above centered headline'],
    recommendation: 'Use the selected composition and a deliberate display voice.',
    severityDefault: 'warning',
    allowWhen: ['The centered axis and type system are explicitly justified by the content.']
  },
  {
    id: 'decorative-grid-background',
    description: 'A grid-line background decorates a surface without supporting spatial work.',
    detectionHints: ['repeating grid background', 'graph-paper hero texture'],
    recommendation: 'Use product structure or a plain field unless the grid supports a real task.',
    severityDefault: 'warning',
    allowWhen: ['The surface is a canvas, map, editor, or measurement interface.']
  },
  {
    id: 'hero-eyebrow-chip',
    description: 'A tiny tracked kicker or pill sits immediately above an oversized hero headline.',
    detectionHints: ['badge above h1', 'uppercase eyebrow above hero'],
    recommendation: 'Fold the words into the headline or use a real breadcrumb.',
    severityDefault: 'warning',
    allowWhen: ['The label communicates genuine taxonomy or navigation context.']
  },
  {
    id: 'meaningless-status-motion',
    description:
      'Pulsing dots, fake cursors, marquees, bounce easing, or hover transforms demand attention without state.',
    detectionHints: ['pulsing status dot', 'decorative caret', 'auto marquee', 'bounce easing'],
    recommendation: 'Animate only state, navigation, hierarchy, or documented material behavior.',
    severityDefault: 'warning',
    allowWhen: ['The motion reflects changing data or a meaningful physical interaction.']
  },
  {
    id: 'generic-marketing-cadence',
    description:
      'Buzzwords, em-dash chains, aphoristic rebuttals, or theater framing imitate generated marketing voice.',
    detectionHints: [
      'supercharge your workflow',
      'enterprise-grade',
      'Not a feature. A platform.',
      'growth theater'
    ],
    recommendation: 'Use specific verbs, nouns, mechanisms, and evidence in the product voice.',
    severityDefault: 'warning',
    allowWhen: ['The phrase belongs to an approved campaign voice and is used sparingly.']
  },
  {
    id: 'shape-assembled-illustration',
    description:
      'Generic hand-coded SVG shapes substitute for purposeful illustration or product material.',
    detectionHints: ['shape-assembled hero art', 'hand-coded mascot scene', 'decorative SVG blob'],
    recommendation:
      'Use real product imagery, commissioned or generated artwork, or no illustration.',
    severityDefault: 'warning',
    allowWhen: [
      'The visual is an intentional diagram, icon, logo, or established illustration system.'
    ]
  },
  {
    id: 'generic-vague-hero-copy',
    description: 'A vague future or potential claim substitutes for a concrete proposition.',
    detectionHints: ['Build the Future', 'Unlock Potential', 'The Future of X'],
    recommendation: 'Write a specific claim grounded in the product, audience, or action.',
    severityDefault: 'warning',
    allowWhen: ['The brief or established campaign explicitly requires the phrase.']
  },
  {
    id: 'unjustified-purple-blue-gradient',
    description: 'A purple/blue gradient is used as default technology decoration.',
    detectionHints: ['purple or blue tokens inside a gradient', 'gradient text'],
    recommendation: "Use a solid brand color or document the gradient's semantic or brand role.",
    severityDefault: 'warning',
    allowWhen: ['The gradient is an established brand asset or encodes meaningful progression.']
  },
  {
    id: 'decorative-glow-overuse',
    description: 'Neon glows accumulate without clarifying focus, state, or atmosphere.',
    detectionHints: ['repeated luminous box shadows', 'blurred glow layers'],
    recommendation: 'Keep only the glow that communicates focus, state, or a named visual concept.',
    severityDefault: 'warning',
    allowWhen: ['A restrained glow is central to a documented material or state concept.']
  },
  {
    id: 'repeated-card-pattern',
    description: 'Repeated equal cards replace content-led hierarchy.',
    detectionHints: ['equal three-column grid', 'four or more card identifiers'],
    recommendation:
      'Use type, dividers, sequencing, or varied spans unless the content is genuinely peer-level.',
    severityDefault: 'warning',
    allowWhen: [
      'Comparable items require scanning and the plan explains why equal treatment helps.'
    ]
  },
  {
    id: 'nested-card-pattern',
    description: 'Cards are nested inside other cards or rounded shells.',
    detectionHints: ['card descendant of card', 'panel descendant selectors'],
    recommendation: 'Flatten the hierarchy and let spacing or dividers express grouping.',
    severityDefault: 'warning',
    allowWhen: ['The inner boundary communicates a real interactive or semantic containment level.']
  },
  {
    id: 'uniform-container-treatment',
    description: 'Every section uses the same rounded, bordered, or shadowed shell.',
    detectionHints: ['repeated section shells', 'uniform large radii'],
    recommendation: 'Vary density and grouping according to content hierarchy.',
    severityDefault: 'warning',
    allowWhen: [
      'A documented system metaphor requires repeated modules and still varies hierarchy.'
    ]
  },
  {
    id: 'generic-horizontal-navbar',
    description: 'Logo-left, links-right, CTA-right navigation is selected automatically.',
    detectionHints: ['horizontal flex navigation', 'links pushed right with a CTA'],
    recommendation:
      'Integrate navigation with the selected composition or explain why convention improves clarity.',
    severityDefault: 'warning',
    allowWhen: [
      'Task speed, familiarity, or information density makes conventional navigation clearest.'
    ]
  },
  {
    id: 'generic-hover-or-motion-pattern',
    description: 'Repeated fade-up or lift-on-hover motion is decorative and generic.',
    detectionHints: ['fade-up keyframes', 'translateY hover', 'transition all'],
    recommendation:
      'Remove it or connect motion to hierarchy, navigation, state, or brand character.',
    severityDefault: 'warning',
    allowWhen: ['The behavior communicates a documented state change or navigation cue.']
  },
  {
    id: 'missing-typographic-contrast',
    description: 'One generic sans-serif is used without a documented display/body decision.',
    detectionHints: ['one font family everywhere', 'no display treatment'],
    recommendation:
      'Declare how display and body typography differ through family, weight, width, scale, or rhythm.',
    severityDefault: 'warning',
    allowWhen: ['A single-family system uses deliberate internal contrast documented in the plan.']
  },
  {
    id: 'missing-design-thesis',
    description: 'The implementation is reviewed without a concrete design thesis.',
    detectionHints: ['missing tasteDirection', 'preset label without a one-sentence idea'],
    recommendation: 'State how the visual system supports one brief-specific idea.',
    severityDefault: 'warning',
    allowWhen: ['The change is non-visual maintenance outside a design review.']
  },
  {
    id: 'missing-motion-rationale',
    description: 'Motion is present without a hierarchy, navigation, state, or brand purpose.',
    detectionHints: ['animation without plan rationale', 'motion without reduced-motion behavior'],
    recommendation: 'State the purpose and fallback or remove the motion.',
    severityDefault: 'warning',
    allowWhen: ['A platform-native state transition is self-evident and remains accessible.']
  },
  {
    id: 'unjustified-signature-interaction',
    description:
      'A cursor, spatial, entry, or scroll concept is added without one explicit purpose.',
    detectionHints: ['custom cursor', 'pinned scene', 'parallax sequence'],
    recommendation: 'Declare one signature interaction and its purpose or remove it.',
    severityDefault: 'warning',
    allowWhen: [
      'The plan identifies the interaction, purpose, reading-order behavior, and fallback.'
    ]
  },
  {
    id: 'unearned-generic-visual-region',
    description: 'A large visual region relies on placeholder-like or generic abstract material.',
    detectionHints: ['large empty media region', 'placeholder or stock naming'],
    recommendation: 'Supply purposeful brand/product material or remove the unearned region.',
    severityDefault: 'warning',
    allowWhen: ['The empty or abstract field has a documented compositional or narrative purpose.']
  },
  {
    id: 'control-spacing-review-required',
    description:
      'Primary control optical spacing has not been reviewed at desktop and mobile sizes.',
    detectionHints: ['primary button or CTA present'],
    recommendation:
      'Record desktop and mobile observations of label centering, padding, height, and consistency.',
    severityDefault: 'warning',
    allowWhen: ['Structured observations cover both desktop and mobile primary controls.']
  }
];

export const antiSlopCraftV1: DesignTasteProfile = {
  id: 'anti-slop-craft-v1',
  name: 'Anti-slop craft',
  version: '1.0.0',
  principles,
  antiPatterns,
  positiveReferenceNotes: [
    'Typography may be the primary compositional material when its display/body relationship is deliberate.',
    'Rich color is controlled and brand-specific rather than a shortcut to a technology aesthetic.',
    'At most one signature interaction may anchor a direction when it has a stated purpose.',
    'Motion reveals hierarchy, navigates content, communicates state, or reinforces brand character.',
    'Cinematic or spatial scrolling preserves reading order, essential content, and reduced-motion access.',
    'Navigation may be a perimeter, rail, overlay, masthead, embedded index, or conventional structure when clearest.',
    'A coherent visual world aligns typography, assets, copy, spacing, and motion around one idea.',
    'Specific, purposeful details are preferred to ornamental complexity.'
  ],
  selectionCriteria: [
    'Use as the default profile for website planning and implementation review.',
    'Adapt decisions to the brief and selected composition rather than treating the profile as a visual preset.',
    'Accept risky patterns only with a matching, credible rationale; never trade away accessibility or structural correctness.'
  ]
};

export const getActiveTasteProfile = (): DesignTasteProfile => antiSlopCraftV1;

const normalize = (value: string): string => value.toLowerCase();

function decisionSource(
  context: TastePlanningContext,
  terms: readonly string[]
): TasteDecision['source'] {
  const preferences = (context.preferences ?? []).join(' ').toLowerCase();
  return terms.some((term) => preferences.includes(term)) ? 'brief' : 'selected-direction';
}

/** Create the default profile's concrete, rationale-rich direction from planning facts. */
export function createTasteDirection(context: TastePlanningContext): TasteDirection {
  const profile = getActiveTasteProfile();
  const subject = context.brief.trim().replace(/[.?!]+$/, '');
  const visualTreatment = context.visualTreatments.slice(0, 2).join(' and ');
  const audience = context.audience?.trim() || 'the intended audience';
  const heroIntent = context.hero.intent.replace(/[.?!]+$/, '').toLowerCase();
  const typographyRationale = `${context.displayStyle} creates the primary compositional voice, while ${context.bodyStyle} keeps supporting copy legible and distinct.`;
  const colorRationale = `The ${context.backgroundColor} ground and ${context.accentColor} accent express ${context.brandAttributes.join(', ')} character; the accent is reserved for hierarchy and state rather than generic decoration.`;
  const visualTreatmentRationale = `${visualTreatment} ties imagery to the ${context.artDirection} direction so visual regions read as specific material, not placeholders.`;
  const navigationRationale = `${context.navigation.name} is used because its ${context.navigation.placement} placement ${context.navigation.relationshipToHero}, supporting the ${context.hero.name} reading order.`;
  const terms = [context.brief, ...(context.preferences ?? [])].map(normalize).join(' ');
  const restrictions = [context.brief, ...(context.avoid ?? [])].map(normalize).join(' ');
  const cursorAllowed = !/(?:no|avoid) (?:custom |spatial |media-revealing )?cursor/.test(
    restrictions
  );
  const requestedSignature =
    terms.includes('cursor') && cursorAllowed
      ? {
          concept: terms.includes('reveal') ? 'Media-revealing cursor' : 'Spatial cursor response',
          purpose:
            'Connect pointer position to the currently explorable product or media region without hiding essential content.'
        }
      : context.motion
        ? { concept: context.motion.concept, purpose: context.motion.purpose }
        : undefined;
  const decisions: readonly TasteDecision[] = [
    {
      category: 'composition',
      choice: context.hero.name,
      rationale: `${context.hero.intent} Its ${context.hero.grid} geometry gives the brief a recognizable structure.`,
      source: 'selected-direction',
      confidence: 0.92
    },
    {
      category: 'typography',
      choice: `${context.displayStyle} with ${context.bodyStyle}`,
      rationale: typographyRationale,
      source: decisionSource(context, ['type', 'font', 'editorial']),
      confidence: 0.88
    },
    {
      category: 'color',
      choice: `Controlled ${context.presetName} palette with one ${context.accentColor} accent`,
      rationale: colorRationale,
      source: decisionSource(context, ['color', 'colour', 'palette', 'dark', 'light']),
      confidence: 0.86
    },
    {
      category: 'navigation',
      choice: context.navigation.name,
      rationale: navigationRationale,
      source: decisionSource(context, ['navigation', 'navbar', 'rail', 'index']),
      confidence: 0.9
    },
    {
      category: 'imagery',
      choice: visualTreatment,
      rationale: visualTreatmentRationale,
      source: decisionSource(context, ['image', 'photo', 'visual', 'diagram', 'illustration']),
      confidence: 0.84
    }
  ];
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    designThesis: `For ${audience}, ${subject} will ${heroIntent} through ${visualTreatment}, making the experience feel ${context.brandAttributes.slice(0, 2).join(' and ')}.`,
    decisions,
    typographyRationale,
    colorRationale,
    visualTreatmentRationale,
    navigationRationale,
    ...(requestedSignature ? { signatureInteraction: requestedSignature } : {}),
    motionRationale: requestedSignature
      ? `${requestedSignature.concept} is the single signature interaction because it ${requestedSignature.purpose.charAt(0).toLowerCase()}${requestedSignature.purpose.slice(1)}`
      : 'No signature motion is selected; hierarchy and brand character are carried by static composition, type, color, and imagery.',
    reducedMotionBehavior:
      context.motion?.reducedMotionBehavior ??
      (requestedSignature
        ? 'Replace the interaction with a stable, fully legible static state and preserve every action in normal reading order.'
        : 'No motion-dependent content or interaction is introduced.'),
    rejectedDefaultPatterns: [
      'vague future-focused hero copy',
      'purple/blue gradient or neon glow as technology decoration',
      ...(context.navigation.id === 'standard-horizontal'
        ? []
        : ['automatic logo-left, links-right, CTA-right navbar']),
      'equal feature cards without peer-level content justification',
      'generic placeholder or abstract visual material',
      'repeated fade-up and lift-on-hover animation',
      ...(context.avoid ?? [])
    ],
    exceptions:
      context.navigation.id === 'standard-horizontal'
        ? [{ pattern: 'generic-horizontal-navbar', rationale: navigationRationale }]
        : []
  };
}

/** True when a plan contains a sufficiently specific exception matching a rule or alias. */
export function hasCredibleTasteException(
  direction: TasteDirection | undefined,
  ruleId: string,
  aliases: readonly string[] = []
): boolean {
  if (!direction) return false;
  const terms = [ruleId, ...aliases].map((value) => value.toLowerCase());
  return direction.exceptions.some((exception) => {
    const pattern = exception.pattern.toLowerCase();
    return (
      exception.rationale.trim().length >= 24 &&
      terms.some((term) => pattern.includes(term) || term.includes(pattern))
    );
  });
}
