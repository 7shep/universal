import {
  signatureSimilarity,
  type CompositionSignature,
  type NavigationId
} from '@universal/composition-library';
import {
  getActiveTasteProfile,
  hasCredibleTasteException,
  type TasteCategory,
  type TasteDirection,
  type TasteFinding,
  type TasteSeverity
} from '@universal/design-taste';

export interface SourceFile {
  path: string;
  content: string;
}

/** Review finding with compatibility aliases for existing MCP clients. */
export interface ReviewFinding extends TasteFinding {
  message: string;
  suggestion: string;
}

export interface ReviewResult {
  status: 'pass' | 'revision_recommended';
  score: number;
  findings: readonly ReviewFinding[];
  passedRules: readonly string[];
  passedPrinciples: readonly string[];
  unresolvedDecisions: readonly string[];
  policy: { profileId: string; profileVersion: string };
}

export interface ScreenshotEvidence {
  viewport: 'desktop' | 'mobile' | string;
  location?: string | undefined;
  notes?: string | undefined;
}

/** Structured observation records human visual review without claiming pixel inspection. */
export interface VisualObservation {
  viewport: 'desktop' | 'mobile' | string;
  observation: string;
  ruleIds?: readonly string[] | undefined;
}

export interface VisualEvidence {
  screenshots: readonly ScreenshotEvidence[];
  checkedForEmptySpace: boolean;
  checkedForMissingMedia: boolean;
  visualObservations?: readonly VisualObservation[] | undefined;
}

export interface ReviewCompositionContext {
  expectedSignature?: CompositionSignature | undefined;
  recentSignatures?: readonly CompositionSignature[] | undefined;
  tasteDirection?: TasteDirection | undefined;
}

export interface StructuralSignatureEvidence {
  heroArchetype: string;
  navigationMode: NavigationId;
  signals: readonly string[];
}

const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length;

const ruleCategories: Readonly<Partial<Record<string, TasteCategory>>> = {
  'generic-vague-hero-copy': 'copy',
  'unjustified-gradients': 'color',
  'unjustified-purple-blue-gradient': 'color',
  'decorative-glow-overuse': 'color',
  'repeated-card-pattern': 'composition',
  'standard-feature-grid': 'composition',
  'nested-card-pattern': 'composition',
  'uniform-container-treatment': 'composition',
  'default-centered-hero': 'composition',
  'default-split-hero': 'composition',
  'generic-horizontal-navbar': 'navigation',
  'default-horizontal-navigation': 'navigation',
  'generic-hover-or-motion-pattern': 'motion',
  'missing-typographic-contrast': 'typography',
  'missing-design-thesis': 'composition',
  'missing-motion-rationale': 'motion',
  'unjustified-signature-interaction': 'motion',
  'unearned-generic-visual-region': 'imagery',
  'likely-empty-visual-region': 'imagery',
  'control-spacing-review-required': 'controls'
};

/** Extract implementation signals for composition-contract checks. */
export function extractStructuralSignature(
  files: readonly SourceFile[]
): StructuralSignatureEvidence {
  const source = files.map((file) => file.content).join('\n');
  const signals: string[] = [];
  const heroSlice =
    source.match(/(?:\.hero|className=["'][^"']*hero)[\s\S]{0,3500}/i)?.[0] ??
    source.slice(0, 3500);
  const splitGrid =
    /grid-template-columns\s*:\s*(?:minmax\([^;]+|[\d.]+fr\s+[\d.]+fr|repeat\(\s*2)/i.test(
      heroSlice
    );
  const copyLeftMediaRight =
    /(?:hero[-_ ]?(?:copy|content)|copy)[\s\S]{0,1600}(?:hero[-_ ]?(?:visual|media|image)|visual|media)/i.test(
      source
    );
  if (splitGrid) signals.push('two-column hero grid');
  if (copyLeftMediaRight) signals.push('copy precedes media in hero source order');

  const standardNav =
    /<nav[\s\S]{0,1600}(?:logo|brand)[\s\S]{0,1200}(?:nav[-_ ]?links|links)[\s\S]{0,1200}(?:cta|button)/i.test(
      source
    ) || /\.nav[^}]*display\s*:\s*flex[\s\S]{0,1200}(?:margin-left\s*:\s*auto)/i.test(source);
  if (standardNav) signals.push('standard horizontal logo-links-CTA navigation');

  const verticalRail = /(?:vertical[-_ ]rail|side[-_ ]nav|writing-mode\s*:)/i.test(source);
  const masthead = /(?:masthead|utility[-_ ]row)/i.test(source);
  const embeddedIndex = /(?:embedded[-_ ]index|hero[-_ ]index|numbered[-_ ]index)/i.test(source);
  const perimeter = /(?:perimeter[-_ ]nav|corner[-_ ]controls)/i.test(source);
  const navigationMode: NavigationId = verticalRail
    ? 'vertical-rail'
    : masthead
      ? 'masthead'
      : embeddedIndex
        ? 'embedded-index'
        : perimeter
          ? 'perimeter'
          : standardNav
            ? 'standard-horizontal'
            : 'corner-controls';
  const heroArchetype =
    splitGrid && copyLeftMediaRight
      ? 'split-screen'
      : /(?:radial|orbit)/i.test(heroSlice)
        ? 'radial-core'
        : /(?:hero[-_ ]index|numbered[-_ ]index)/i.test(heroSlice)
          ? 'index-opener'
          : /(?:full[-_ ]bleed|background-image)/i.test(heroSlice)
            ? 'cinematic-full-bleed'
            : /(?:poster)/i.test(heroSlice)
              ? 'poster'
              : 'unclassified';
  return { heroArchetype, navigationMode, signals };
}

function finding(
  severity: TasteSeverity,
  rule: string,
  rationale: string,
  actionableFix: string
): ReviewFinding {
  return {
    severity,
    rule,
    rationale,
    actionableFix,
    message: rationale,
    suggestion: actionableFix
  };
}

function hasException(
  direction: TasteDirection | undefined,
  rule: string,
  aliases: readonly string[]
): boolean {
  return hasCredibleTasteException(direction, rule, aliases);
}

function hasControlObservation(
  evidence: VisualEvidence | undefined,
  viewport: 'desktop' | 'mobile'
): boolean {
  return (
    evidence?.visualObservations?.some((item) => {
      const relevant =
        item.ruleIds?.includes('control-spacing-review-required') ||
        /control|button|cta|padding|spacing|cent(?:er|re)/i.test(item.observation);
      return (
        item.viewport.toLowerCase() === viewport &&
        Boolean(relevant) &&
        item.observation.trim().length >= 12
      );
    }) ?? false
  );
}

/** Review source, plan rationale, and supplied evidence against composition and taste guardrails. */
export function reviewImplementation(
  files: readonly SourceFile[],
  visualEvidence?: VisualEvidence,
  compositionContext?: ReviewCompositionContext
): ReviewResult {
  const source = files.map((file) => file.content).join('\n');
  const direction = compositionContext?.tasteDirection;
  const profile = getActiveTasteProfile();
  const findings: ReviewFinding[] = [];
  const gradients = count(source, /(?:linear|radial|conic)-gradient\s*\(/gi);
  const purpleBlue = count(
    source,
    /#(?:8b5cf6|7c3aed|6d28d9|a855f7|9333ea|c084fc|2563eb|3b82f6|1d4ed8|6366f1)|(?:purple|violet|indigo|electric-blue)/gi
  );
  const largeRadii = count(source, /border-radius\s*:\s*(?:[2-9]\d|[1-9]\d{2,})px/gi);
  const cardNames = count(source, /(?:feature-)?card/gi);
  const shadows = count(source, /box-shadow\s*:/gi);
  const glows = count(
    source,
    /(?:neon|glow|drop-shadow\s*\(|box-shadow\s*:[^;}]{0,160}(?:#(?:8b5cf6|2563eb|22d3ee)|rgba?\())/gi
  );
  const threeColumn = /grid-template-columns\s*:\s*repeat\(\s*3\s*,/i.test(source);
  const centeredHero =
    /(?:\.hero[^}]*\{[^}]*text-align\s*:\s*center|\.hero[^}]*\{[^}]*align-items\s*:\s*center)/is.test(
      source
    );
  const nestedCards =
    /\.(?:card|panel)[\w-]*\s+\.(?:card|panel)[\w-]*/i.test(source) ||
    /className=["'][^"']*(?:card|panel)\b[^"']*["'][^>]*(?<!\/)>[\s\S]{0,900}className=["'][^"']*(?:card|panel)\b[^"']*["']/i.test(
      source
    );
  const uniformContainers =
    count(
      source,
      /(?:section|container|panel|card)[\w-]*[^}]*\{[^}]*(?:border-radius|box-shadow|border\s*:)/gi
    ) >= 3 ||
    (largeRadii >= 3 && shadows >= 3);
  const genericMotion =
    /(?:fade[-_ ]?up|transition\s*:\s*all|:hover[^}]*transform\s*:\s*translateY)/is.test(source);
  const anyMotion =
    genericMotion ||
    /(?:@keyframes|animation\s*:|transition\s*:|scroll-trigger|parallax|cursor)/i.test(source);
  const signatureInteraction =
    /(?:custom[-_ ]cursor|cursor[-_ ]reveal|scroll-trigger|parallax|pin(?:ned)?[-_ ]scene)/i.test(
      source
    );
  const genericVisual =
    /(?:placeholder|stock[-_ ]?(?:image|photo)|abstract[-_ ]?(?:blob|orb|visual)|lorem[-_ ]?image)/i.test(
      source
    );
  const vagueHeroCopy =
    /(?:build\s+the\s+future|unlock\s+(?:your\s+)?potential|the\s+future\s+of\s+[a-z])/i.test(
      source
    );
  const fontFamilies = new Set(
    [...source.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((match) =>
      match[1]?.trim().toLowerCase()
    )
  );
  const documentedSingleFamilyContrast = direction?.typographyRationale.length
    ? /weight|width|scale|contrast|display|rhythm/i.test(direction.typographyRationale)
    : false;
  const missingTypeContrast =
    fontFamilies.size <= 1 &&
    !documentedSingleFamilyContrast &&
    !/font-variation-settings|font-stretch/i.test(source);
  const structural = extractStructuralSignature(files);
  const hasDesktopScreenshot =
    visualEvidence?.screenshots.some((shot) => shot.viewport.toLowerCase() === 'desktop') ?? false;
  const hasMobileScreenshot =
    visualEvidence?.screenshots.some((shot) => shot.viewport.toLowerCase() === 'mobile') ?? false;
  const hasVisualAsset = /<(?:img|picture|video|canvas|svg)\b/i.test(source);
  const hasLargeVisualRegion =
    /(?:hero|visual|media|image|logo|diagram|canvas|surface)[\w-]*[^\n]{0,300}(?:min-height|height)\s*:\s*(?:[3-9]\d{2,}|[1-9]\dvh)/i.test(
      source
    ) ||
    /(?:min-height|height)\s*:\s*(?:[3-9]\d{2,}|[1-9]\dvh)[\s\S]{0,500}(?:hero|visual|media|image|logo|diagram|canvas|surface)/i.test(
      source
    );
  const hasPrimaryControls =
    /<button\b|className=["'][^"']*(?:primary|cta)[^"']*["']|aria-label=["'][^"']*(?:submit|continue|start|buy|contact)/i.test(
      source
    );

  if (!direction || direction.designThesis.trim().length < 40)
    findings.push(
      finding(
        'warning',
        'missing-design-thesis',
        'The review has no concrete one-sentence design thesis to evaluate for coherence.',
        'Attach the generated tasteDirection with a specific thesis grounded in this brief.'
      )
    );
  if (
    vagueHeroCopy &&
    !hasException(direction, 'generic-vague-hero-copy', ['hero copy', 'future copy'])
  )
    findings.push(
      finding(
        'warning',
        'generic-vague-hero-copy',
        'The hero uses a broad future or potential claim that could fit an unrelated company.',
        'Replace it with a concrete product, audience, outcome, or action from the brief.'
      )
    );

  const gradientExcepted = hasException(direction, 'unjustified-purple-blue-gradient', [
    'gradient'
  ]);
  if (gradients > 0 && (purpleBlue > 0 || gradients > 1) && !gradientExcepted) {
    findings.push(
      finding(
        'warning',
        'unjustified-gradients',
        `${gradients} gradient declaration(s) appear without a matching plan exception.`,
        'Use a solid intentional accent or document what the gradient encodes.'
      )
    );
    findings.push(
      finding(
        'warning',
        'unjustified-purple-blue-gradient',
        'Purple/blue gradient treatment reads as default technology decoration rather than a brand decision.',
        'Remove it or add a credible taste exception describing its semantic or established brand role.'
      )
    );
  }
  if (glows >= 2 && !hasException(direction, 'decorative-glow-overuse', ['glow', 'neon']))
    findings.push(
      finding(
        'warning',
        'decorative-glow-overuse',
        `${glows} glow signals accumulate without a documented focus, state, or material purpose.`,
        'Keep one purposeful glow or replace the layers with contrast, spacing, or a brand-specific material cue.'
      )
    );
  if (largeRadii >= 3)
    findings.push(
      finding(
        'warning',
        'excessive-rounded-containers',
        `Large border-radius values appear ${largeRadii} times.`,
        'Reserve large radii for one or two elements with a real containment role.'
      )
    );

  const cardsExcepted = hasException(direction, 'repeated-card-pattern', [
    'card group',
    'cards',
    'feature grid'
  ]);
  if (threeColumn && !cardsExcepted)
    findings.push(
      finding(
        'warning',
        'standard-feature-grid',
        'An equal three-column grid was detected without content justification.',
        'Use a content-led sequence or document why the items require equal scanability.'
      )
    );
  if ((cardNames >= 4 || threeColumn) && !cardsExcepted)
    findings.push(
      finding(
        'warning',
        'repeated-card-pattern',
        'Repeated card treatment appears to replace a more specific information hierarchy.',
        'Use type, dividers, varied spans, or sequencing unless the plan explains peer-level comparison.'
      )
    );
  if (nestedCards && !hasException(direction, 'nested-card-pattern', ['nested card']))
    findings.push(
      finding(
        'warning',
        'nested-card-pattern',
        'A card or panel appears nested inside another container shell.',
        'Flatten the hierarchy or document the distinct interactive containment level.'
      )
    );
  if (
    uniformContainers &&
    !hasException(direction, 'uniform-container-treatment', [
      'container treatment',
      'module system'
    ])
  )
    findings.push(
      finding(
        'warning',
        'uniform-container-treatment',
        'Three or more sections appear to share the same container shell treatment.',
        'Vary grouping and density according to content hierarchy.'
      )
    );
  if (shadows >= 4)
    findings.push(
      finding(
        'warning',
        'excessive-shadows',
        `box-shadow appears ${shadows} times.`,
        'Use elevation only where it clarifies interaction or layering.'
      )
    );
  if (centeredHero)
    findings.push(
      finding(
        'warning',
        'default-centered-hero',
        'A likely centered hero was detected.',
        'Confirm the centered axis serves the thesis or use the selected composition coordinates.'
      )
    );
  if (structural.heroArchetype === 'split-screen')
    findings.push(
      finding(
        'warning',
        'default-split-hero',
        `A conventional left-copy/right-media hero was detected (${structural.signals.join(', ')}).`,
        'Implement the selected hero coordinates instead of defaulting to two columns.'
      )
    );

  const navExcepted = hasException(direction, 'generic-horizontal-navbar', [
    'navbar',
    'standard horizontal',
    'conventional navigation'
  ]);
  if (structural.navigationMode === 'standard-horizontal' && !navExcepted) {
    findings.push(
      finding(
        'warning',
        'default-horizontal-navigation',
        'A standard logo-left, links-and-CTA-right navigation was detected.',
        'Use the plan-selected navigation relationship or document why convention is clearest.'
      )
    );
    findings.push(
      finding(
        'warning',
        'generic-horizontal-navbar',
        'The navigation matches a generic horizontal default without a credible plan rationale.',
        'Integrate navigation with the composition or add a specific clarity/familiarity rationale.'
      )
    );
  }
  if (
    genericMotion &&
    !hasException(direction, 'generic-hover-or-motion-pattern', ['motion', 'hover', 'fade-up'])
  )
    findings.push(
      finding(
        'warning',
        'generic-hover-or-motion-pattern',
        'A repeated fade-up, transition-all, or lift-on-hover pattern appears decorative.',
        'Remove it or connect the behavior to hierarchy, navigation, or state.'
      )
    );
  if (
    missingTypeContrast &&
    !hasException(direction, 'missing-typographic-contrast', ['typography', 'single family'])
  )
    findings.push(
      finding(
        'warning',
        'missing-typographic-contrast',
        'Source and plan do not establish a deliberate display/body contrast.',
        'Differentiate family, weight, width, scale, or rhythm and record that choice in tasteDirection.'
      )
    );
  if (anyMotion && (!direction || direction.motionRationale.trim().length < 35))
    findings.push(
      finding(
        'warning',
        'missing-motion-rationale',
        'Motion is present without a sufficiently specific hierarchy, navigation, state, or brand purpose.',
        'Add a motion rationale and reduced-motion behavior, or remove the animation.'
      )
    );
  if (signatureInteraction && !direction?.signatureInteraction)
    findings.push(
      finding(
        'warning',
        'unjustified-signature-interaction',
        'A cursor, parallax, or pinned interaction appears without a declared single interaction concept and purpose.',
        'Declare one signatureInteraction with its explicit purpose and fallback, or remove it.'
      )
    );

  if (compositionContext?.expectedSignature) {
    const expected = compositionContext.expectedSignature;
    if (
      structural.heroArchetype !== 'unclassified' &&
      structural.heroArchetype !== expected.heroArchetype
    )
      findings.push(
        finding(
          'error',
          'composition-contract-hero-mismatch',
          `Implementation appears to use "${structural.heroArchetype}" instead of the selected "${expected.heroArchetype}" hero.`,
          'Follow the heroComposition regions and grid from the design plan.'
        )
      );
    if (structural.navigationMode !== expected.navigationMode)
      findings.push(
        finding(
          'error',
          'composition-contract-navigation-mismatch',
          `Implementation appears to use "${structural.navigationMode}" instead of "${expected.navigationMode}" navigation.`,
          'Preserve the selected navigation placement and relationship to the hero.'
        )
      );
  }
  if (compositionContext?.expectedSignature && compositionContext.recentSignatures?.length) {
    const closest = Math.max(
      ...compositionContext.recentSignatures.map((signature) =>
        signatureSimilarity(compositionContext.expectedSignature!, signature)
      )
    );
    if (closest >= 0.75)
      findings.push(
        finding(
          'error',
          'cross-run-structural-repetition',
          `The selected composition is ${Math.round(closest * 100)}% similar to a recent structural signature.`,
          'Regenerate with a different composition seed or exclude the repeated hero and navigation pairing.'
        )
      );
  }
  if (!visualEvidence || !hasDesktopScreenshot || !hasMobileScreenshot)
    findings.push(
      finding(
        'warning',
        'visual-evidence-required',
        'The review is missing required desktop and mobile screenshots.',
        'Capture both viewports and attach concise structured observations before shipping.'
      )
    );
  if (
    visualEvidence &&
    (!visualEvidence.checkedForEmptySpace || !visualEvidence.checkedForMissingMedia)
  )
    findings.push(
      finding(
        'warning',
        'visual-coverage-incomplete',
        'The supplied review did not confirm checks for empty space and missing media or marks.',
        'Review every major section for unearned voids, blank marks, and placeholder-like regions.'
      )
    );

  const visualExcepted = hasException(direction, 'unearned-generic-visual-region', [
    'visual region',
    'abstract field',
    'negative space'
  ]);
  if (((hasLargeVisualRegion && !hasVisualAsset) || genericVisual) && !visualExcepted) {
    findings.push(
      finding(
        'warning',
        'likely-empty-visual-region',
        'A large or placeholder-like visual region lacks purposeful supplied material.',
        'Add specific brand/product material or tighten the composition.'
      )
    );
    findings.push(
      finding(
        'warning',
        'unearned-generic-visual-region',
        'The visual region could be transferred to an unrelated brand with minimal change.',
        "Use real brand/product material with the plan-selected treatment, or document the field's narrative purpose."
      )
    );
  }
  if (
    hasPrimaryControls &&
    (!hasControlObservation(visualEvidence, 'desktop') ||
      !hasControlObservation(visualEvidence, 'mobile'))
  )
    findings.push(
      finding(
        'warning',
        'control-spacing-review-required',
        'Source parsing cannot prove primary-control optical spacing, and structured desktop/mobile observations are incomplete.',
        'Record observations for both viewports covering label centering, padding, height, and treatment consistency.'
      )
    );

  const passedRules = [
    ...(gradients === 0 ? ['No gradients detected'] : []),
    ...(purpleBlue === 0 ? ['No default purple or blue treatment detected'] : []),
    ...(!threeColumn ? ['No equal three-column feature grid detected'] : []),
    ...(largeRadii < 3 ? ['Rounded containers are restrained'] : []),
    ...(shadows < 4 ? ['Shadow use is restrained'] : []),
    ...(hasDesktopScreenshot && hasMobileScreenshot
      ? ['Desktop and mobile screenshot evidence supplied']
      : []),
    ...(structural.heroArchetype !== 'split-screen'
      ? ['No default left-copy/right-media hero detected']
      : []),
    ...(structural.navigationMode !== 'standard-horizontal'
      ? ['No default horizontal navigation detected']
      : []),
    ...(visualEvidence?.checkedForEmptySpace && visualEvidence.checkedForMissingMedia
      ? ['Empty-space and missing-media checks confirmed']
      : [])
  ];
  const failedRuleIds = new Set(findings.map((item) => item.rule));
  const failedCategories = new Set(
    findings
      .map((item) => ruleCategories[item.rule])
      .filter((category): category is TasteCategory => category !== undefined)
  );
  const passedPrinciples = profile.principles
    .filter((principle) => !failedCategories.has(principle.appliesTo))
    .map((principle) => principle.id);
  const unresolvedDecisions = [
    ...(!direction ? ['Attach tasteDirection from the canonical DesignPlan.'] : []),
    ...(anyMotion && failedRuleIds.has('missing-motion-rationale')
      ? ['Decide whether motion has a real purpose or should be removed.']
      : []),
    ...(hasPrimaryControls && failedRuleIds.has('control-spacing-review-required')
      ? ['Complete desktop and mobile primary-control spacing observations.']
      : [])
  ];
  const penalty = findings.reduce(
    (total, item) => total + (item.severity === 'error' ? 18 : item.severity === 'warning' ? 8 : 2),
    0
  );
  return {
    status: findings.length ? 'revision_recommended' : 'pass',
    score: Math.max(0, 100 - penalty),
    findings,
    passedRules,
    passedPrinciples,
    unresolvedDecisions,
    policy: { profileId: profile.id, profileVersion: profile.version }
  };
}

export type FindingSeverity = 'info' | 'warning' | 'error';

export interface DesignFinding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  recommendation: string;
}

export interface DesignRule {
  id: string;
  evaluate(input: LintInput): readonly DesignFinding[];
}

export interface LintInput {
  composition: import('@universal/composition-library').Composition;
  source?: string;
}

/** Execute explicitly registered linter rules for design-engine consumers. */
export const lintDesign = (
  input: LintInput,
  rules: readonly DesignRule[] = []
): readonly DesignFinding[] => rules.flatMap((rule) => rule.evaluate(input));
