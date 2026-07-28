import type { GeneratedProject, ProjectGenerationRequest } from '@universal/generation';
import type { ImplementationReviewRecord } from '@universal/runtime-contracts';
import { analyzeReactArchitecture } from './architecture.ts';
export function reviewGeneratedImplementation(
  project: GeneratedProject,
  request: ProjectGenerationRequest,
  now: string
): ImplementationReviewRecord {
  const source = project.files.map((file) => file.content).join('\n');
  const css = project.files
    .filter((file) => file.kind === 'stylesheet')
    .map((file) => file.content)
    .join('\n');
  const checks: ImplementationReviewRecord['checks'][number][] = [];
  const machine = (id: string, condition: boolean, pass: string, fail: string) =>
    checks.push({ id, status: condition ? 'pass' : 'fail', message: condition ? pass : fail });
  machine(
    'page-map-coverage',
    request.context.pageMap.pages.every((page) => source.includes(page.route)),
    'Every approved route is represented in generated source.',
    'One or more approved routes is missing.'
  );
  machine(
    'semantic-navigation',
    /<nav\b/.test(source) && /<main\b/.test(source) && /<h1\b/.test(source),
    'Semantic navigation, main, and heading landmarks are present.',
    'Semantic page landmarks are incomplete.'
  );
  machine(
    'visible-focus',
    /focus-visible/.test(css),
    'Visible keyboard focus treatment is present.',
    'Visible focus treatment is missing.'
  );
  machine(
    'reduced-motion',
    /prefers-reduced-motion/.test(css),
    'Reduced-motion behavior is explicit.',
    'Reduced-motion behavior is missing.'
  );
  const generic = [
    /glassmorphism/i,
    /\bbento\b/i,
    /fake scarcity/i,
    /gamer neon/i,
    /black-and-gold/i,
    /cards? inside cards?/i
  ];
  machine(
    'prohibited-pattern-resistance',
    !generic.some((pattern) => pattern.test(source)),
    'No prohibited generic pattern signal was detected.',
    'Generated source introduced a prohibited generic pattern.'
  );
  machine(
    'network-denial',
    !/\bfetch\s*\(|XMLHttpRequest|new WebSocket|https?:\/\//.test(source),
    'Generated code contains no outbound network call.',
    'Generated code attempts outbound network access.'
  );
  const architecture = analyzeReactArchitecture(project, request);
  checks.push({
    id: 'architecture-summary',
    status: 'pass',
    severity: 'info',
    message: 'React repository architecture was analyzed with the TypeScript compiler API.',
    evidence: architecture.evidence
  });
  for (const finding of architecture.findings)
    checks.push({
      id: finding.id,
      status: finding.severity === 'error' ? 'fail' : 'pass',
      severity: finding.severity,
      message: finding.message,
      evidence: finding.evidence
    });
  checks.push({
    id: 'visual-quality',
    status: 'human-review',
    message:
      'Composition fidelity and subjective visual quality require rendered desktop and mobile judgment.'
  });
  return {
    status: checks.some((check) => check.status === 'fail') ? 'revision_recommended' : 'pass',
    checkedAt: now,
    checks
  };
}
