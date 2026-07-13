export interface SourceFile { path: string; content: string }
export interface ReviewFinding { severity: 'warning' | 'error'; rule: string; message: string; suggestion: string }
export interface ReviewResult { status: 'pass' | 'revision_recommended'; score: number; findings: readonly ReviewFinding[]; passedRules: readonly string[] }

const count = (source: string, pattern: RegExp): number => (source.match(pattern) ?? []).length;

export function reviewImplementation(files: readonly SourceFile[]): ReviewResult {
  const source = files.map((file) => file.content).join('\n');
  const findings: ReviewFinding[] = [];
  const gradients = count(source, /(?:linear|radial)-gradient\s*\(/gi);
  const purple = count(source, /#(?:8b5cf6|7c3aed|6d28d9|a855f7|9333ea|c084fc)|(?:purple|violet|indigo)/gi);
  const largeRadii = count(source, /border-radius\s*:\s*(?:[2-9]\d|[1-9]\d{2,})px/gi);
  const cardNames = count(source, /(?:feature-)?card/gi);
  const shadows = count(source, /box-shadow\s*:/gi);
  const threeColumn = /grid-template-columns\s*:\s*repeat\(\s*3\s*,/i.test(source);
  const centeredHero = /(?:\.hero[^}]*\{[^}]*text-align\s*:\s*center|\.hero[^}]*\{[^}]*align-items\s*:\s*center)/is.test(source);

  if (gradients > 0 && (purple > 0 || gradients > 1)) findings.push({ severity: 'warning', rule: 'unjustified-gradients', message: `${gradients} gradient declaration(s) detected${purple ? ' alongside purple or violet language/colors' : ''}.`, suggestion: 'Use a solid, intentional accent unless a gradient is central to the concept.' });
  if (largeRadii >= 3) findings.push({ severity: 'warning', rule: 'excessive-rounded-containers', message: `Large border-radius values appear ${largeRadii} times.`, suggestion: 'Reserve rounded containers for one or two focal elements.' });
  if (threeColumn) findings.push({ severity: 'warning', rule: 'standard-feature-grid', message: 'A three-column grid was detected.', suggestion: 'Use an asymmetric or content-led composition unless equal columns are essential.' });
  if (cardNames >= 4) findings.push({ severity: 'warning', rule: 'repeated-card-pattern', message: `Card-related names appear ${cardNames} times.`, suggestion: 'Replace repeated cards with typography, dividers, or varied content groupings.' });
  if (shadows >= 4) findings.push({ severity: 'warning', rule: 'excessive-shadows', message: `box-shadow appears ${shadows} times.`, suggestion: 'Use shadows only where elevation clarifies interaction.' });
  if (centeredHero) findings.push({ severity: 'warning', rule: 'default-centered-hero', message: 'A likely centered hero was detected.', suggestion: 'Consider an offset or asymmetric opening composition.' });

  const passedRules = [
    ...(gradients === 0 ? ['No gradients detected'] : []),
    ...(purple === 0 ? ['No purple or violet treatment detected'] : []),
    ...(!threeColumn ? ['No three-column feature grid detected'] : []),
    ...(largeRadii < 3 ? ['Rounded containers are restrained'] : []),
    ...(shadows < 4 ? ['Shadow use is restrained'] : [])
  ];
  return { status: findings.length ? 'revision_recommended' : 'pass', score: Math.max(0, 100 - findings.length * 12), findings, passedRules };
}
