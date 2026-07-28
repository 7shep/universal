import {
  DISCOVERY_OUTPUT_TOPICS,
  type CreativeBriefCompilationOutput,
  type CreativeBriefContentOutput,
  type CreativeBriefPageOutput,
  type DiscoveryInterpretationOutput,
  type DiscoveryOutputTopic,
  type FactExtractionConflictOutput,
  type InitialFactExtractionOutput
} from './types.ts';

export class PromptOutputValidationError extends Error {
  override readonly name = 'PromptOutputValidationError';
  readonly path: string;

  constructor(path: string, message: string) {
    super(`Invalid prompt output at ${path}: ${message}`);
    this.path = path;
  }
}

const object = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new PromptOutputValidationError(path, 'expected an object.');
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, path: string, keys: readonly string[]): void => {
  const extra = Object.keys(value).find((key) => !keys.includes(key));
  if (extra) throw new PromptOutputValidationError(`${path}.${extra}`, 'unexpected field.');
};
const text = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new PromptOutputValidationError(path, 'expected a non-empty string.');
  return value.trim();
};
const strings = (value: unknown, path: string): readonly string[] => {
  if (!Array.isArray(value)) throw new PromptOutputValidationError(path, 'expected an array.');
  return value.map((item, index) => text(item, `${path}[${index}]`));
};
const topic = (value: unknown, path: string): DiscoveryOutputTopic => {
  if (!DISCOVERY_OUTPUT_TOPICS.includes(value as DiscoveryOutputTopic))
    throw new PromptOutputValidationError(path, 'expected a supported discovery topic.');
  return value as DiscoveryOutputTopic;
};
const discoveryValue = (value: unknown, path: string): DiscoveryInterpretationOutput['value'] => {
  const item = object(value, path);
  exact(item, path, ['summary', 'details']);
  return item.details === undefined
    ? { summary: text(item.summary, `${path}.summary`) }
    : {
        summary: text(item.summary, `${path}.summary`),
        details: strings(item.details, `${path}.details`)
      };
};
const interpretation = (value: unknown, path: string): DiscoveryInterpretationOutput => {
  const item = object(value, path);
  exact(item, path, ['topic', 'value', 'source', 'evidence']);
  if (!['user', 'model', 'repository'].includes(String(item.source)))
    throw new PromptOutputValidationError(`${path}.source`, 'expected user, model, or repository.');
  return {
    topic: topic(item.topic, `${path}.topic`),
    value: discoveryValue(item.value, `${path}.value`),
    source: item.source as DiscoveryInterpretationOutput['source'],
    evidence: text(item.evidence, `${path}.evidence`)
  };
};
const interpretationList = (
  value: unknown,
  path: string
): readonly DiscoveryInterpretationOutput[] => {
  if (!Array.isArray(value)) throw new PromptOutputValidationError(path, 'expected an array.');
  return value.map((item, index) => interpretation(item, `${path}[${index}]`));
};
const json = (value: string): unknown => {
  if (typeof value !== 'string' || !value.trim())
    throw new PromptOutputValidationError('$', 'expected a JSON string.');
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new PromptOutputValidationError('$', 'expected valid JSON.');
  }
};

export function parseInitialFactExtractionOutput(value: string): InitialFactExtractionOutput {
  const item = object(json(value), '$');
  exact(item, '$', ['interpretations', 'conflicts']);
  if (!Array.isArray(item.conflicts))
    throw new PromptOutputValidationError('$.conflicts', 'expected an array.');
  return {
    interpretations: interpretationList(item.interpretations, '$.interpretations'),
    conflicts: item.conflicts.map((entry, index): FactExtractionConflictOutput => {
      const path = `$.conflicts[${index}]`;
      const conflict = object(entry, path);
      exact(conflict, path, ['topics', 'summary', 'evidence']);
      if (!Array.isArray(conflict.topics) || conflict.topics.length === 0)
        throw new PromptOutputValidationError(`${path}.topics`, 'expected at least one topic.');
      return {
        topics: conflict.topics.map((entryTopic, topicIndex) =>
          topic(entryTopic, `${path}.topics[${topicIndex}]`)
        ),
        summary: text(conflict.summary, `${path}.summary`),
        evidence: strings(conflict.evidence, `${path}.evidence`)
      };
    })
  };
}

const page = (value: unknown, path: string): CreativeBriefPageOutput => {
  const item = object(value, path);
  exact(item, path, [
    'id',
    'route',
    'name',
    'userGoal',
    'primaryMessage',
    'requiredSections',
    'requiredContent',
    'primaryAction',
    'secondaryActions',
    'navigationRelationship',
    'uniqueResponsibility',
    'sharedElements',
    'pageSpecificElements'
  ]);
  const route = text(item.route, `${path}.route`);
  if (!route.startsWith('/'))
    throw new PromptOutputValidationError(`${path}.route`, 'expected a route starting with /.');
  const result = {
    id: text(item.id, `${path}.id`),
    route,
    name: text(item.name, `${path}.name`),
    userGoal: text(item.userGoal, `${path}.userGoal`),
    primaryMessage: text(item.primaryMessage, `${path}.primaryMessage`),
    requiredSections: strings(item.requiredSections, `${path}.requiredSections`),
    requiredContent: strings(item.requiredContent, `${path}.requiredContent`),
    secondaryActions: strings(item.secondaryActions, `${path}.secondaryActions`),
    navigationRelationship: text(item.navigationRelationship, `${path}.navigationRelationship`),
    uniqueResponsibility: text(item.uniqueResponsibility, `${path}.uniqueResponsibility`),
    sharedElements: strings(item.sharedElements, `${path}.sharedElements`),
    pageSpecificElements: strings(item.pageSpecificElements, `${path}.pageSpecificElements`)
  };
  return item.primaryAction === undefined
    ? result
    : { ...result, primaryAction: text(item.primaryAction, `${path}.primaryAction`) };
};

const content = (value: unknown, path: string): CreativeBriefContentOutput => {
  const item = object(value, path);
  const optionalValueKeys = [
    'positioning',
    'emotionalResponse',
    'hero',
    'navigation',
    'color',
    'typography',
    'brandAssets',
    'imagery'
  ] as const;
  exact(item, path, [
    'projectName',
    'purpose',
    'audience',
    ...optionalValueKeys,
    'pageMap',
    'pageContent',
    'constraints',
    'references',
    'antiPatterns',
    'preferences'
  ]);
  const map = object(item.pageMap, `${path}.pageMap`);
  exact(map, `${path}.pageMap`, ['kind', 'pages']);
  if (!['single-page', 'multi-page'].includes(String(map.kind)))
    throw new PromptOutputValidationError(
      `${path}.pageMap.kind`,
      'expected single-page or multi-page.'
    );
  if (!Array.isArray(map.pages) || map.pages.length === 0)
    throw new PromptOutputValidationError(`${path}.pageMap.pages`, 'expected at least one page.');
  const pages = map.pages.map((entry, index) => page(entry, `${path}.pageMap.pages[${index}]`));
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const [index, candidatePage] of pages.entries()) {
    if (ids.has(candidatePage.id))
      throw new PromptOutputValidationError(
        `${path}.pageMap.pages[${index}].id`,
        'expected a unique page ID.'
      );
    if (routes.has(candidatePage.route))
      throw new PromptOutputValidationError(
        `${path}.pageMap.pages[${index}].route`,
        'expected a unique page route.'
      );
    ids.add(candidatePage.id);
    routes.add(candidatePage.route);
  }
  if (map.kind === 'single-page' && pages.length !== 1)
    throw new PromptOutputValidationError(
      `${path}.pageMap.pages`,
      'single-page output requires exactly one page.'
    );
  if (map.kind === 'multi-page' && pages.length < 2)
    throw new PromptOutputValidationError(
      `${path}.pageMap.pages`,
      'multi-page output requires at least two pages.'
    );
  if (!Array.isArray(item.references))
    throw new PromptOutputValidationError(`${path}.references`, 'expected an array.');
  const references = item.references.map((entry, index) => {
    const referencePath = `${path}.references[${index}]`;
    const reference = object(entry, referencePath);
    exact(reference, referencePath, ['description', 'url', 'role']);
    if (!['inspiration', 'anti-reference'].includes(String(reference.role)))
      throw new PromptOutputValidationError(
        `${referencePath}.role`,
        'expected inspiration or anti-reference.'
      );
    const base = {
      description: text(reference.description, `${referencePath}.description`),
      role: reference.role as 'inspiration' | 'anti-reference'
    };
    return reference.url === undefined
      ? base
      : { ...base, url: text(reference.url, `${referencePath}.url`) };
  });
  const result: Record<string, unknown> = {
    purpose: discoveryValue(item.purpose, `${path}.purpose`),
    audience: discoveryValue(item.audience, `${path}.audience`),
    pageMap: { kind: map.kind, pages },
    pageContent: discoveryValue(item.pageContent, `${path}.pageContent`),
    constraints: strings(item.constraints, `${path}.constraints`),
    references,
    antiPatterns: strings(item.antiPatterns, `${path}.antiPatterns`),
    preferences: strings(item.preferences, `${path}.preferences`)
  };
  if (item.projectName !== undefined)
    result.projectName = text(item.projectName, `${path}.projectName`);
  for (const key of optionalValueKeys)
    if (item[key] !== undefined) result[key] = discoveryValue(item[key], `${path}.${key}`);
  return result as unknown as CreativeBriefContentOutput;
};

export function parseCreativeBriefCompilationOutput(value: string): CreativeBriefCompilationOutput {
  const item = object(json(value), '$');
  exact(item, '$', ['content', 'interpretations']);
  return {
    content: content(item.content, '$.content'),
    interpretations: interpretationList(item.interpretations, '$.interpretations')
  };
}

export const toDiscoveryInterpretations = (
  output: InitialFactExtractionOutput | CreativeBriefCompilationOutput
): readonly DiscoveryInterpretationOutput[] => output.interpretations;
