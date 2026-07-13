export interface SourceFile { path: string; content: string }
export interface ReviewFinding { severity: 'warning' | 'error'; rule: string; message: string; suggestion: string }
export interface ReviewResult { status: 'pass' | 'revision_recommended'; score: number; findings: readonly ReviewFinding[]; passedRules: readonly string[] }
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

const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length;

export function reviewImplementation(files: readonly SourceFile[], visualEvidence?: VisualEvidence): ReviewResult {
  const source = files.map((file) => file.content).join('\n');
  const findings: ReviewFinding[] = [];
  const gradients = count(source, /(?:linear|radial)-gradient\s*\(/gi);
  const purple = count(source, /#(?:8b5cf6|7c3aed|6d28d9|a855f7|9333ea|c084fc)|(?:purple|violet|indigo)/gi);
  const largeRadii = count(source, /border-radius\s*:\s*(?:[2-9]\d|[1-9]\d{2,})px/gi);
  const cardNames = count(source, /(?:feature-)?card/gi);
  const shadows = count(source, /box-shadow\s*:/gi);
  const threeColumn = /grid-template-columns\s*:\s*repeat\(\s*3\s*,/i.test(source);
  const centeredHero = /(?:\.hero[^}]*\{[^}]*text-align\s*:\s*center|\.hero[^}]*\{[^}]*align-items\s*:\s*center)/is.test(source);
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
    ...(visualEvidence?.checkedForEmptySpace && visualEvidence.checkedForMissingMedia ? ['Empty-space and missing-media checks confirmed'] : [])
  ];
  return { status: findings.length ? 'revision_recommended' : 'pass', score: Math.max(0, 100 - findings.length * 12), findings, passedRules };
}
