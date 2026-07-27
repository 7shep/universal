import type { DesignReference } from '@universal/shared';
import type { DesignPlanBrief } from './contracts.ts';
import {
  DISCOVERY_CONTRACT_VERSION,
  type BriefApproval,
  type BriefRevision,
  type CompatibilityOptions,
  type CreativeBrief,
  type CreativeBriefContent,
  type CreativeBriefRevisionInput,
  type DecisionProvenance,
  type DiscoverySession,
  type DiscoveryTopic,
  type DiscoveryValue
} from './discovery-contracts.ts';
import { evaluateDiscoveryPolicy } from './discovery-policy.ts';
import {
  validateCreativeBrief,
  validateDecisionProvenance,
  validateDiscoveryInterpretation,
  validatePageMap
} from './discovery-validation.ts';

const fieldByTopic = {
  purpose: 'purpose',
  audience: 'audience',
  positioning: 'positioning',
  'emotional-response': 'emotionalResponse',
  'page-content': 'pageContent',
  hero: 'hero',
  navigation: 'navigation',
  color: 'color',
  typography: 'typography',
  'brand-assets': 'brandAssets',
  imagery: 'imagery'
} as const;

function latestDecision(
  decisions: readonly DecisionProvenance[],
  topic: DiscoveryTopic
): DecisionProvenance | undefined {
  return [...decisions].reverse().find((decision) => decision.topic === topic);
}

function requiredDecision(
  session: DiscoverySession,
  topic: 'purpose' | 'audience' | 'page-content'
): DiscoveryValue {
  const decision = latestDecision(session.decisions, topic);
  if (!decision) throw new Error(`Cannot prepare creative brief without ${topic}.`);
  return decision.value;
}

function optionalDecision(
  decisions: readonly DecisionProvenance[],
  topic: keyof typeof fieldByTopic
): DiscoveryValue | undefined {
  return latestDecision(decisions, topic)?.value;
}

function listFromDecision(
  decisions: readonly DecisionProvenance[],
  topic: DiscoveryTopic
): readonly string[] {
  const value = latestDecision(decisions, topic)?.value;
  if (!value) return [];
  return [value.summary, ...(value.details ?? [])];
}

function referencesFromDecision(
  decisions: readonly DecisionProvenance[]
): readonly DesignReference[] {
  return listFromDecision(decisions, 'references').map((description) => ({
    description,
    role: 'inspiration'
  }));
}

function buildContent(session: DiscoverySession): CreativeBriefContent {
  if (!session.pageMap || !validatePageMap(session.pageMap).ok)
    throw new Error('Cannot prepare creative brief without a valid page map.');
  const content: CreativeBriefContent = {
    purpose: requiredDecision(session, 'purpose'),
    audience: requiredDecision(session, 'audience'),
    pageMap: session.pageMap,
    pageContent: requiredDecision(session, 'page-content'),
    constraints: listFromDecision(session.decisions, 'constraints'),
    references: referencesFromDecision(session.decisions),
    antiPatterns: listFromDecision(session.decisions, 'anti-patterns'),
    preferences: session.decisions
      .filter((decision) => decision.disposition === 'preferred')
      .map((decision) => decision.value.summary)
  };
  for (const [topic, field] of Object.entries(fieldByTopic) as [
    keyof typeof fieldByTopic,
    (typeof fieldByTopic)[keyof typeof fieldByTopic]
  ][]) {
    if (['purpose', 'audience', 'page-content'].includes(topic)) continue;
    const value = optionalDecision(session.decisions, topic);
    if (value) Object.assign(content, { [field]: value });
  }
  return content;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function digestCreativeBrief(
  brief: Pick<CreativeBrief, 'contractVersion' | 'id' | 'version' | 'content' | 'decisions'>
): string {
  return `discovery-v1-${fnv1a(
    canonicalize({
      contractVersion: brief.contractVersion,
      id: brief.id,
      version: brief.version,
      content: brief.content,
      decisions: brief.decisions
    })
  )}`;
}

export function createCreativeBrief(session: DiscoverySession, now: string): CreativeBrief {
  const policy = evaluateDiscoveryPolicy(session);
  if (!policy.canPrepareBrief)
    throw new Error('Discovery is missing required information for a creative brief.');
  const base = {
    contractVersion: DISCOVERY_CONTRACT_VERSION,
    id: `brief:${session.id}`,
    version: 1,
    createdAt: now,
    updatedAt: now,
    content: buildContent(session),
    decisions: session.decisions,
    unresolved: policy.missing,
    revisions: [] as readonly BriefRevision[],
    approval: { status: 'brief-ready' } satisfies BriefApproval
  };
  const brief: CreativeBrief = { ...base, digest: digestCreativeBrief(base) };
  const validation = validateCreativeBrief(brief);
  if (!validation.ok)
    throw new Error(
      `Invalid creative brief at ${validation.error.path}: ${validation.error.message}`
    );
  return brief;
}

export function reviseCreativeBrief(
  brief: CreativeBrief,
  input: CreativeBriefRevisionInput
): CreativeBrief {
  if (!['brief-ready', 'revision-requested'].includes(brief.approval.status))
    throw new Error(`Cannot revise a brief from ${brief.approval.status} state.`);
  const changed = new Set<DiscoveryTopic>();
  const revisionCounts = new Map<DiscoveryTopic, number>();
  const interpretedDecisions: DecisionProvenance[] = (input.interpretations ?? []).map(
    (interpretation) => {
      const revision =
        (revisionCounts.get(interpretation.topic) ??
          brief.decisions.filter((decision) => decision.topic === interpretation.topic).length) + 1;
      revisionCounts.set(interpretation.topic, revision);
      const assumed = interpretation.source === 'model';
      return {
        id: `decision:${interpretation.topic}:${revision}`,
        topic: interpretation.topic,
        value: interpretation.value,
        source: interpretation.source,
        disposition: assumed ? 'assumed' : 'explicit',
        evidence: interpretation.evidence,
        revision,
        requiresConfirmation:
          assumed &&
          ['purpose', 'audience', 'page-map', 'page-content'].includes(interpretation.topic)
      };
    }
  );
  const incomingDecisions = [...interpretedDecisions, ...(input.decisions ?? [])];
  const decisions = [...brief.decisions, ...incomingDecisions];
  for (const decision of input.decisions ?? []) {
    const validation = validateDecisionProvenance(decision);
    if (!validation.ok)
      throw new Error(`Invalid decision at ${validation.error.path}: ${validation.error.message}`);
    changed.add(decision.topic);
  }
  for (const interpretation of input.interpretations ?? []) {
    const validation = validateDiscoveryInterpretation(interpretation);
    if (!validation.ok)
      throw new Error(
        `Invalid interpretation at ${validation.error.path}: ${validation.error.message}`
      );
    changed.add(interpretation.topic);
  }
  if (input.pageMap) {
    const validation = validatePageMap(input.pageMap);
    if (!validation.ok)
      throw new Error(`Invalid page map at ${validation.error.path}: ${validation.error.message}`);
    changed.add('page-map');
  }

  const content = { ...brief.content };
  for (const decision of incomingDecisions) {
    const field = fieldByTopic[decision.topic as keyof typeof fieldByTopic];
    if (field) Object.assign(content, { [field]: decision.value });
    if (decision.topic === 'constraints')
      content.constraints = [decision.value.summary, ...(decision.value.details ?? [])];
    if (decision.topic === 'anti-patterns')
      content.antiPatterns = [decision.value.summary, ...(decision.value.details ?? [])];
  }
  if (input.pageMap) content.pageMap = input.pageMap;

  const unresolved = brief.unresolved.filter((item) => !changed.has(item.topic));
  for (const nextDecision of incomingDecisions) {
    if (nextDecision.requiresConfirmation)
      unresolved.push({
        topic: nextDecision.topic,
        impact: ['purpose', 'audience', 'page-map', 'page-content'].includes(nextDecision.topic)
          ? 'high'
          : 'medium',
        reason: 'confirmation-required',
        questionId: `discovery:${nextDecision.topic}`,
        blocksApproval: ['purpose', 'audience', 'page-map', 'page-content'].includes(
          nextDecision.topic
        )
      });
  }

  const base = {
    ...brief,
    version: brief.version + 1,
    updatedAt: input.now,
    content,
    decisions,
    unresolved,
    approval: { status: 'brief-ready' } satisfies BriefApproval
  };
  const digest = digestCreativeBrief(base);
  const revision: BriefRevision = {
    version: base.version,
    revisedAt: input.now,
    reason: input.reason,
    changedTopics: [...changed].sort(),
    digest
  };
  return { ...base, digest, revisions: [...brief.revisions, revision] };
}

export function requestCreativeBriefApproval(brief: CreativeBrief, now: string): CreativeBrief {
  const blockers = brief.unresolved.filter((item) => item.blocksApproval);
  if (blockers.length > 0)
    throw new Error(`Creative brief has ${blockers.length} unresolved approval blocker(s).`);
  if (brief.approval.status !== 'brief-ready')
    throw new Error(`Cannot request approval from ${brief.approval.status} state.`);
  return { ...brief, updatedAt: now, approval: { status: 'approval-pending', requestedAt: now } };
}

export function approveCreativeBrief(
  brief: CreativeBrief,
  now: string,
  approvedBy = 'user'
): CreativeBrief {
  if (brief.approval.status !== 'approval-pending')
    throw new Error('Creative brief must be awaiting approval.');
  const blockers = brief.unresolved.filter((item) => item.blocksApproval);
  if (blockers.length > 0)
    throw new Error(`Creative brief has ${blockers.length} unresolved approval blocker(s).`);
  return {
    ...brief,
    updatedAt: now,
    approval: {
      status: 'approved',
      requestedAt: brief.approval.requestedAt,
      approvedAt: now,
      approvedBy,
      approvedDigest: brief.digest
    }
  };
}

export function requestCreativeBriefRevision(
  brief: CreativeBrief,
  now: string,
  reason: string
): CreativeBrief {
  if (!['approval-pending', 'approved'].includes(brief.approval.status))
    throw new Error(`Cannot request revision from ${brief.approval.status} state.`);
  if (!reason.trim()) throw new Error('Revision reason is required.');
  return {
    ...brief,
    updatedAt: now,
    approval: { status: 'revision-requested', revisionReason: reason }
  };
}

export function toDesignPlanBrief(
  brief: CreativeBrief,
  options: CompatibilityOptions = {}
): DesignPlanBrief {
  if ((options.requireApproval ?? true) && brief.approval.status !== 'approved')
    throw new Error('Compatibility conversion requires an approved creative brief.');
  const pages = brief.content.pageMap.pages
    .map(
      (page) =>
        `${page.name} (${page.route}): ${page.userGoal}; ${page.primaryMessage}; sections: ${page.requiredSections.join(', ')}`
    )
    .join('\n');
  const prompt = [
    brief.content.purpose.summary,
    brief.content.positioning?.summary,
    brief.content.emotionalResponse
      ? `Desired response: ${brief.content.emotionalResponse.summary}`
      : undefined,
    `Page map:\n${pages}`,
    `Content requirements: ${brief.content.pageContent.summary}`,
    brief.content.hero ? `Opening: ${brief.content.hero.summary}` : undefined,
    brief.content.navigation ? `Navigation: ${brief.content.navigation.summary}` : undefined
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
  const result: DesignPlanBrief = {
    prompt,
    audience: brief.content.audience.summary,
    constraints: brief.content.constraints,
    references: brief.content.references,
    websiteType:
      brief.content.pageMap.kind === 'single-page' ? 'single-page website' : 'multi-page website',
    preferences: brief.content.preferences,
    avoid: brief.content.antiPatterns
  };
  if (options.compositionSeed !== undefined)
    return { ...result, compositionSeed: options.compositionSeed };
  return result;
}

export const convertCreativeBriefToDesignPlanBrief = toDesignPlanBrief;
