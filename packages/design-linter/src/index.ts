import { signatureSimilarity, type CompositionSignature, type NavigationId } from '@universal/composition-library';

export interface SourceFile {
  path: string;
  content: string;
}

export interface ReviewFinding {
  severity: 'warning' | 'error';
  rule: string;
  message: string;
  suggestion: string;
}

export interface ReviewResult {
  status: 'pass' | 'revision_recommended';
  score: number;
  findings: readonly ReviewFinding[];
  passedRules: readonly string[];
}

export interface ScreenshotEvidence {
  viewport: 'desktop' | 'mobile' | string;
  location?: string | undefined;
  notes?: string | undefined;
}

export interface VisualEvidence {
  screenshots: readonly ScreenshotEvidence[];
  checkedForEmptySpace: boolean;
  checkedForMissingMedia: boolean;
}

export interface ReviewCompositionContext {
  expectedSignature?: CompositionSignature | undefined;
  recentSignatures?: readonly CompositionSignature[] | undefined;
}

export interface StructuralSignatureEvidence {
  heroArchetype: string;
  navigationMode: NavigationId;
  signals: readonly string[];
}

const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length;

/** Extract implementation signals for composition-contract checks. */
export function extractStructuralSignature(files: readonly SourceFile[]): StructuralSignatureEvidence {
  const source = files.map((file) => file.content).join('\n');
  const signals: string[] = [];
  const heroSlice = source.match(/(?:\.hero|className=["'][^"']*hero)[\s\S]{0,3500}/i)?.[0] ?? source.slice(0, 3500);
  const splitGrid = /grid-template-columns\s*:\s*(?:minmax\([^;]+|[\d.]+fr\s+[\d.]+fr|repeat\(\s*2)/i.test(heroSlice);
  const copyLeftMediaRight = /(?:hero[-_ ]?(?:copy|content)|copy)[\s\S]{0,1600}(?:hero[-_ ]?(?:visual|media|image)|visual|media)/i.test(source);
  if (splitGrid) signals.push('two-column hero grid');
  if (copyLeftMediaRight) signals.push('copy precedes media in hero source order');

  const standardNav = /<nav[\s\S]{0,1600}(?:logo|brand)[\s\S]{0,1200}(?:nav[-_ ]?links|links)[\s\S]{0,1200}(?:cta|button)/i.test(source)
    || /\.nav[^}]*display\s*:\s*flex[\s\S]{0,1200}(?:margin-left\s*:\s*auto)/i.test(source);
  if (standardNav) signals.push('standard horizontal logo-links-CTA navigation');

  const verticalRail = /(?:vertical[-_ ]rail|side[-_ ]nav|writing-mode\s*:)/i.test(source);
  const masthead = /(?:masthead|utility[-_ ]row)/i.test(source);
  const embeddedIndex = /(?:embedded[-_ ]index|hero[-_ ]index|numbered[-_ ]index)/i.test(source);
  const perimeter = /(?:perimeter[-_ ]nav|corner[-_ ]controls)/i.test(source);
  const navigationMode: NavigationId = verticalRail ? 'vertical-rail' : masthead ? 'masthead' : embeddedIndex ? 'embedded-index' : perimeter ? 'perimeter' : standardNav ? 'standard-horizontal' : 'corner-controls';
  const heroArchetype = splitGrid && copyLeftMediaRight ? 'split-screen' : /(?:radial|orbit)/i.test(heroSlice) ? 'radial-core' : /(?:hero[-_ ]index|numbered[-_ ]index)/i.test(heroSlice) ? 'index-opener' : /(?:full[-_ ]bleed|background-image)/i.test(heroSlice) ? 'cinematic-full-bleed' : /(?:poster)/i.test(heroSlice) ? 'poster' : 'unclassified';
  return { heroArchetype, navigationMode, signals };
}

/** Review source and visual evidence against Universal's composition guardrails. */
export function reviewImplementation(files: readonly SourceFile[], visualEvidence?: VisualEvidence, compositionContext?: ReviewCompositionContext): ReviewResult {
  const source = files.map((file) => file.content).join('\n');
  const findings: ReviewFinding[] = [];
  const gradients = count(source, /(?:linear|radial)-gradient\s*\(/gi);
  const purple = count(source, /#(?:8b5cf6|7c3aed|6d28d9|a855f7|9333ea|c084fc)|(?:purple|violet|indigo)/gi);
  const largeRadii = count(source, /border-radius\s*:\s*(?:[2-9]\d|[1-9]\d{2,})px/gi);
  const cardNames = count(source, /(?:feature-)?card/gi);
  const shadows = count(source, /box-shadow\s*:/gi);
  const threeColumn = /grid-template-columns\s*:\s*repeat\(\s*3\s*,/i.test(source);
  const centeredHero = /(?:\.hero[^}]*\{[^}]*text-align\s*:\s*center|\.hero[^}]*\{[^}]*align-items\s*:\s*center)/is.test(source);
  const structural = extractStructuralSignature(files);
  const hasDesktopScreenshot = visualEvidence?.screenshots.some((shot) => shot.viewport.toLowerCase() === 'desktop') ?? false;
  const hasMobileScreenshot = visualEvidence?.screenshots.some((shot) => shot.viewport.toLowerCase() === 'mobile') ?? false;
  const hasVisualAsset = /<(?:img|picture|video|canvas|svg)\b/i.test(source);
  const hasLargeVisualRegion = /(?:hero|visual|media|image|logo|diagram|canvas|surface)[\w-]*[^\n]{0,300}(?:min-height|height)\s*:\s*(?:[3-9]\d{2,}|[1-9]\dvh)/i.test(source)
    || /(?:min-height|height)\s*:\s*(?:[3-9]\d{2,}|[1-9]\dvh)[\s\S]{0,500}(?:hero|visual|media|image|logo|diagram|canvas|surface)/i.test(source);

  if (gradients > 0 && (purple > 0 || gradients > 1)) findings.push({ severity: 'warning', rule: 'unjustified-gradients', message: `${gradients} gradient declaration(s) detected${purple ? ' alongside purple or violet language/colors' : ''}.`, suggestion: 'Use a solid, intentional accent unless a gradient is central to the concept.' });
  if (largeRadii >= 3) findings.push({ severity: 'warning', rule: 'excessive-rounded-containers', message: `Large border-radius values appear ${largeRadii} times.`, suggestion: 'Reserve rounded containers for one or two focal elements.' });
  if (threeColumn) findings.push({ severity: 'warning', rule: 'standard-feature-grid', message: 'A three-column grid was detected.', suggestion: 'Use an asymmetric or content-led composition unless equal columns are essential.' });
  if (cardNames >= 4) findings.push({ severity: 'warning', rule: 'repeated-card-pattern', message: `Card-related names appear ${cardNames} times.`, suggestion: 'Replace repeated cards with typography, dividers, or varied content groupings.' });
  if (shadows >= 4) findings.push({ severity: 'warning', rule: 'excessive-shadows', message: `box-shadow appears ${shadows} times.`, suggestion: 'Use shadows only where elevation clarifies interaction.' });
  if (centeredHero) findings.push({ severity: 'warning', rule: 'default-centered-hero', message: 'A likely centered hero was detected.', suggestion: 'Consider an offset or asymmetric opening composition.' });
  if (structural.heroArchetype === 'split-screen') findings.push({ severity: 'warning', rule: 'default-split-hero', message: `A conventional left-copy/right-media hero was detected (${structural.signals.join(', ')}).`, suggestion: 'Implement the selected hero coordinates instead of a two-column split.' });
  if (structural.navigationMode === 'standard-horizontal') findings.push({ severity: 'warning', rule: 'default-horizontal-navigation', message: 'A standard logo-left, links-and-CTA-right navigation was detected.', suggestion: 'Use the navigation mode selected by the design plan and integrate it with the hero composition.' });
  if (compositionContext?.expectedSignature) {
    const expected = compositionContext.expectedSignature;
    if (structural.heroArchetype !== 'unclassified' && structural.heroArchetype !== expected.heroArchetype) findings.push({ severity: 'error', rule: 'composition-contract-hero-mismatch', message: `Implementation appears to use “${structural.heroArchetype}” instead of the selected “${expected.heroArchetype}” hero.`, suggestion: 'Follow the heroComposition regions and grid from the design plan.' });
    if (structural.navigationMode !== expected.navigationMode) findings.push({ severity: 'error', rule: 'composition-contract-navigation-mismatch', message: `Implementation appears to use “${structural.navigationMode}” instead of “${expected.navigationMode}” navigation.`, suggestion: 'Preserve the selected navigation placement and relationship to the hero.' });
  }
  if (compositionContext?.expectedSignature && compositionContext.recentSignatures?.length) {
    const closest = Math.max(...compositionContext.recentSignatures.map((signature) => signatureSimilarity(compositionContext.expectedSignature!, signature)));
    if (closest >= 0.75) findings.push({ severity: 'error', rule: 'cross-run-structural-repetition', message: `The selected composition is ${Math.round(closest * 100)}% similar to a recent structural signature.`, suggestion: 'Regenerate with a different composition seed or exclude the repeated hero and navigation pairing.' });
  }
  if (!visualEvidence || !hasDesktopScreenshot || !hasMobileScreenshot) findings.push({ severity: 'warning', rule: 'visual-evidence-required', message: 'The review is missing required desktop and mobile screenshots.', suggestion: 'Capture both viewports before shipping and attach concise observations from each.' });
  if (visualEvidence && (!visualEvidence.checkedForEmptySpace || !visualEvidence.checkedForMissingMedia)) findings.push({ severity: 'warning', rule: 'visual-coverage-incomplete', message: 'The supplied visual review did not confirm checks for empty space and missing media or marks.', suggestion: 'Review every major section for unearned voids, blank logo areas, and placeholder-like visual regions.' });
  if (hasLargeVisualRegion && !hasVisualAsset) findings.push({ severity: 'warning', rule: 'likely-empty-visual-region', message: 'Large visual regions were detected without an image, logo, video, canvas, or SVG asset in the supplied source.', suggestion: 'Either add a purposeful visual asset or tighten the composition so the region does not read as an unfinished placeholder.' });

  const passedRules = [
    ...(gradients === 0 ? ['No gradients detected'] : []),
    ...(purple === 0 ? ['No purple or violet treatment detected'] : []),
    ...(!threeColumn ? ['No three-column feature grid detected'] : []),
    ...(largeRadii < 3 ? ['Rounded containers are restrained'] : []),
    ...(shadows < 4 ? ['Shadow use is restrained'] : []),
    ...(hasDesktopScreenshot && hasMobileScreenshot ? ['Desktop and mobile screenshot evidence supplied'] : []),
    ...(structural.heroArchetype !== 'split-screen' ? ['No default left-copy/right-media hero detected'] : []),
    ...(structural.navigationMode !== 'standard-horizontal' ? ['No default horizontal navigation detected'] : []),
    ...(visualEvidence?.checkedForEmptySpace && visualEvidence.checkedForMissingMedia ? ['Empty-space and missing-media checks confirmed'] : [])
  ];
  return { status: findings.length ? 'revision_recommended' : 'pass', score: Math.max(0, 100 - findings.length * 12), findings, passedRules };
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
export const lintDesign = (input: LintInput, rules: readonly DesignRule[] = []): readonly DesignFinding[] => rules.flatMap((rule) => rule.evaluate(input));
