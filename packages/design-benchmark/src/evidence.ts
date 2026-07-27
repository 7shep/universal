import { createHash } from 'node:crypto';

export const SOURCE_EVIDENCE_VERSION = '1.0.0' as const;

export interface EvidenceSourceFile {
  readonly path: string;
  readonly content: string;
}

/**
 * A reference to rendered output. The collector records the reference but never
 * treats its presence as proof of a visual quality.
 */
export interface RenderedEvidenceReference {
  readonly path: string;
  readonly viewport: string;
  readonly sha256?: string;
}

export interface SourceEvidencePolicy {
  readonly include: readonly string[];
  readonly ignore: readonly string[];
  readonly requiredChecks: readonly string[];
}

export interface CollectSourceEvidenceInput {
  readonly files: readonly EvidenceSourceFile[];
  readonly renderedEvidence?: readonly RenderedEvidenceReference[];
  readonly policy: SourceEvidencePolicy;
  readonly completedChecks: readonly string[];
}

export type SourceLanguage =
  'css' | 'html' | 'javascript' | 'json' | 'svg' | 'typescript' | 'unknown';

export interface FileSourceEvidence {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly lines: number;
  readonly language: SourceLanguage;
}

export interface SourceSignalCounts {
  readonly headings: Readonly<Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', number>>;
  readonly landmarks: Readonly<
    Record<'aside' | 'footer' | 'header' | 'main' | 'nav' | 'section', number>
  >;
  readonly controls: Readonly<Record<'button' | 'input' | 'select' | 'textarea', number>>;
  readonly media: Readonly<Record<'canvas' | 'img' | 'picture' | 'svg' | 'video', number>>;
  readonly imagesWithAltAttribute: number;
  readonly imagesWithoutAltAttribute: number;
  readonly mediaQueries: number;
  readonly reducedMotionQueries: number;
  readonly cssCustomPropertyDeclarations: number;
  readonly keyframeDeclarations: number;
}

export const VISUAL_ONLY_CRITERIA = [
  'visual_hierarchy',
  'composition_and_spacing',
  'typography_and_color',
  'visual_craft',
  'distinctiveness'
] as const;

export type VisualOnlyCriterion = (typeof VISUAL_ONLY_CRITERIA)[number];
export type VisualEvaluationStatus = 'not_evaluable' | 'awaiting_blind_review';

export interface VisualEvaluationAvailability {
  readonly criterion: VisualOnlyCriterion;
  readonly status: VisualEvaluationStatus;
  readonly reason: string;
}

export interface SourceEvidence {
  readonly version: typeof SOURCE_EVIDENCE_VERSION;
  readonly sourceDigest: string;
  readonly files: readonly FileSourceEvidence[];
  readonly signals: SourceSignalCounts;
  readonly renderedEvidence: readonly RenderedEvidenceReference[];
  readonly visualOnly: readonly VisualEvaluationAvailability[];
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const occurrences = (source: string, expression: RegExp): number =>
  Array.from(source.matchAll(expression)).length;

const normalizedPath = (path: string): string => {
  const slashPath = path.replaceAll('\\', '/').replace(/^\.\/+/, '');
  if (!slashPath || slashPath.startsWith('/') || /^[a-z]:\//i.test(slashPath))
    throw new Error(`Evidence paths must be non-empty project-relative paths: ${path}`);
  const segments = slashPath.split('/');
  if (segments.some((segment) => segment === '..'))
    throw new Error(`Evidence paths cannot traverse outside the project: ${path}`);
  const normalized = segments.filter((segment) => segment !== '' && segment !== '.').join('/');
  if (!normalized) throw new Error(`Evidence paths must be non-empty: ${path}`);
  return normalized;
};

const normalizeLf = (content: string): string => content.replace(/\r\n?/g, '\n');

function globExpression(pattern: string): RegExp {
  const normalized = normalizedPath(pattern);
  let expression = pattern.includes('/') ? '^' : '^(?:.*/)?';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]!;
    if (character === '*' && normalized[index + 1] === '*') {
      index += 1;
      if (normalized[index + 1] === '/') {
        index += 1;
        expression += '(?:.*/)?';
      } else expression += '.*';
    } else if (character === '*') expression += '[^/]*';
    else if (character === '?') expression += '[^/]';
    else expression += character.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  }
  return new RegExp(`${expression}$`);
}

function enforcePolicy(input: CollectSourceEvidenceInput, paths: readonly string[]): void {
  const include = input.policy.include.map(globExpression);
  const ignore = input.policy.ignore.map(globExpression);
  if (include.length === 0) throw new Error('Evidence policy must declare include patterns.');
  for (const path of paths) {
    if (!include.some((expression) => expression.test(path)))
      throw new Error(`Evidence source path is not included by policy: ${path}`);
    if (ignore.some((expression) => expression.test(path)))
      throw new Error(`Evidence source path is ignored by policy: ${path}`);
  }
  const completed = new Set(input.completedChecks);
  const missing = input.policy.requiredChecks.filter((check) => !completed.has(check));
  if (missing.length > 0)
    throw new Error(`Required evidence checks did not complete: ${missing.join(', ')}`);
}

const languageFor = (path: string): SourceLanguage => {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (extension === '.css' || extension === '.scss' || extension === '.sass') return 'css';
  if (extension === '.html' || extension === '.htm') return 'html';
  if (extension === '.js' || extension === '.jsx' || extension === '.mjs') return 'javascript';
  if (extension === '.json') return 'json';
  if (extension === '.svg') return 'svg';
  if (extension === '.ts' || extension === '.tsx') return 'typescript';
  return 'unknown';
};

const lineCount = (content: string): number =>
  content.length === 0 ? 0 : occurrences(content, /\n/g) + 1;

function countTags(source: string, tag: string): number {
  return occurrences(source, new RegExp(`<${tag}(?=[\\s>/])`, 'gi'));
}

function collectSignals(source: string): SourceSignalCounts {
  const images = Array.from(source.matchAll(/<img(?=[\s>/])[^>]*>/gi), (match) => match[0]);
  const withAlt = images.filter((tag) => /\balt\s*=/i.test(tag)).length;
  return {
    headings: {
      h1: countTags(source, 'h1'),
      h2: countTags(source, 'h2'),
      h3: countTags(source, 'h3'),
      h4: countTags(source, 'h4'),
      h5: countTags(source, 'h5'),
      h6: countTags(source, 'h6')
    },
    landmarks: {
      aside: countTags(source, 'aside'),
      footer: countTags(source, 'footer'),
      header: countTags(source, 'header'),
      main: countTags(source, 'main'),
      nav: countTags(source, 'nav'),
      section: countTags(source, 'section')
    },
    controls: {
      button: countTags(source, 'button'),
      input: countTags(source, 'input'),
      select: countTags(source, 'select'),
      textarea: countTags(source, 'textarea')
    },
    media: {
      canvas: countTags(source, 'canvas'),
      img: images.length,
      picture: countTags(source, 'picture'),
      svg: countTags(source, 'svg'),
      video: countTags(source, 'video')
    },
    imagesWithAltAttribute: withAlt,
    imagesWithoutAltAttribute: images.length - withAlt,
    mediaQueries: occurrences(source, /@media(?=[\s({])/gi),
    reducedMotionQueries: occurrences(source, /prefers-reduced-motion\s*:/gi),
    cssCustomPropertyDeclarations: occurrences(source, /--[\w-]+\s*:/g),
    keyframeDeclarations: occurrences(source, /@(?:-webkit-)?keyframes(?=[\s{])/gi)
  };
}

function canonicalRenderedEvidence(
  references: readonly RenderedEvidenceReference[] | undefined
): readonly RenderedEvidenceReference[] {
  return [...(references ?? [])]
    .map((reference) => {
      const path = normalizedPath(reference.path);
      const viewport = reference.viewport.trim();
      if (!viewport) throw new Error(`Rendered evidence viewport is required: ${reference.path}`);
      return reference.sha256 === undefined
        ? { path, viewport }
        : { path, viewport, sha256: reference.sha256.toLowerCase() };
    })
    .sort(
      (left, right) =>
        compareText(left.path, right.path) ||
        compareText(left.viewport, right.viewport) ||
        compareText(left.sha256 ?? '', right.sha256 ?? '')
    );
}

/**
 * Collect deterministic, network-free facts from checked-in source.
 *
 * This intentionally does not infer layout quality, visual hierarchy, contrast,
 * spacing quality, or any other property that requires rendered inspection.
 */
export function collectSourceEvidence(input: CollectSourceEvidenceInput): SourceEvidence {
  const canonicalFiles = input.files
    .map((file) => ({ path: normalizedPath(file.path), content: normalizeLf(file.content) }))
    .sort((left, right) => compareText(left.path, right.path));
  const seenPaths = new Set<string>();
  for (const file of canonicalFiles) {
    if (seenPaths.has(file.path))
      throw new Error(`Duplicate evidence source path after normalization: ${file.path}`);
    seenPaths.add(file.path);
  }

  enforcePolicy(
    input,
    canonicalFiles.map((file) => file.path)
  );

  const files = canonicalFiles.map((file): FileSourceEvidence => ({
    path: file.path,
    sha256: sha256(file.content),
    bytes: Buffer.byteLength(file.content, 'utf8'),
    lines: lineCount(file.content),
    language: languageFor(file.path)
  }));
  const sourceDigest = sha256(
    canonicalFiles
      .map(
        (file) =>
          `${Buffer.byteLength(file.path, 'utf8')}:${file.path}:${Buffer.byteLength(file.content, 'utf8')}:${file.content}`
      )
      .join('')
  );
  const renderedEvidence = canonicalRenderedEvidence(input.renderedEvidence);
  const status: VisualEvaluationStatus =
    renderedEvidence.length === 0 ? 'not_evaluable' : 'awaiting_blind_review';
  const reason =
    status === 'not_evaluable'
      ? 'Rendered evidence has not been supplied.'
      : 'Rendered evidence is available but requires blind visual scoring.';

  return {
    version: SOURCE_EVIDENCE_VERSION,
    sourceDigest,
    files,
    signals: collectSignals(canonicalFiles.map((file) => file.content).join('\n')),
    renderedEvidence,
    visualOnly: VISUAL_ONLY_CRITERIA.map((criterion) => ({ criterion, status, reason }))
  };
}
