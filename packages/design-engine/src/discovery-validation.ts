import { failure, success, type Result } from '@universal/shared';
import type { ContractValidationError } from './contracts.ts';
import {
  DISCOVERY_ANSWER_MODES,
  DISCOVERY_CONTRACT_VERSION,
  DISCOVERY_TOPICS,
  type CreativeBrief,
  type BriefApproval,
  type DecisionProvenance,
  type DiscoveryAnswer,
  type DiscoveryInterpretation,
  type DiscoverySession,
  type DiscoveryValue,
  type PageMap,
  type PageMapEntry
} from './discovery-contracts.ts';
import { digestCreativeBrief } from './discovery-digest.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);
const invalid = (path: string, message: string): Result<never, ContractValidationError> =>
  failure({ path, message });
const highImpactTopics = new Set(['purpose', 'audience', 'page-map', 'page-content']);

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => structurallyEqual(item, right[index]))
    );
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && structurallyEqual(left[key], right[key])
    )
  );
}

function validateApproval(
  value: unknown,
  path: string
): Result<BriefApproval, ContractValidationError> {
  if (!isRecord(value)) return invalid(path, 'Approval state must be an object.');
  if (
    !['discovering', 'brief-ready', 'approval-pending', 'approved', 'revision-requested'].includes(
      String(value.status)
    )
  )
    return invalid(`${path}.status`, 'Approval status is invalid.');
  for (const field of [
    'requestedAt',
    'approvedAt',
    'approvedBy',
    'approvedDigest',
    'revisionReason'
  ] as const)
    if (value[field] !== undefined && !nonEmpty(value[field]))
      return invalid(`${path}.${field}`, `${field} must be a non-empty string.`);
  if (value.status === 'approval-pending' && !nonEmpty(value.requestedAt))
    return invalid(`${path}.requestedAt`, 'Pending approval requires a request timestamp.');
  if (
    value.status === 'approved' &&
    (!nonEmpty(value.approvedAt) || !nonEmpty(value.approvedBy) || !nonEmpty(value.approvedDigest))
  )
    return invalid(path, 'Approved state requires approver, timestamp, and digest.');
  if (value.status === 'revision-requested' && !nonEmpty(value.revisionReason))
    return invalid(`${path}.revisionReason`, 'Revision-requested state requires a reason.');
  return success(value as unknown as BriefApproval);
}

export function validateDiscoveryValue(
  value: unknown,
  path = 'value'
): Result<DiscoveryValue, ContractValidationError> {
  if (!isRecord(value) || !nonEmpty(value.summary))
    return invalid(path, 'Discovery values require a non-empty summary.');
  if (value.details !== undefined && !stringArray(value.details))
    return invalid(`${path}.details`, 'Discovery value details must contain non-empty strings.');
  return success(value as unknown as DiscoveryValue);
}

export function validatePageMapEntry(
  value: unknown,
  path = 'page'
): Result<PageMapEntry, ContractValidationError> {
  if (!isRecord(value)) return invalid(path, 'Page map entry must be an object.');
  for (const field of [
    'id',
    'route',
    'name',
    'userGoal',
    'primaryMessage',
    'navigationRelationship',
    'uniqueResponsibility'
  ] as const) {
    if (!nonEmpty(value[field]))
      return invalid(`${path}.${field}`, `Page map ${field} is required.`);
  }
  if (!String(value.route).startsWith('/'))
    return invalid(`${path}.route`, 'Page routes must start with /.');
  for (const field of [
    'requiredSections',
    'requiredContent',
    'secondaryActions',
    'sharedElements',
    'pageSpecificElements'
  ] as const) {
    if (!stringArray(value[field]))
      return invalid(`${path}.${field}`, `Page map ${field} must be a string array.`);
  }
  if (value.primaryAction !== undefined && !nonEmpty(value.primaryAction))
    return invalid(`${path}.primaryAction`, 'Primary action must be a non-empty string.');
  return success(value as unknown as PageMapEntry);
}

export function validatePageMap(
  value: unknown,
  path = 'pageMap'
): Result<PageMap, ContractValidationError> {
  if (!isRecord(value) || !['single-page', 'multi-page'].includes(String(value.kind)))
    return invalid(path, 'Page map must declare single-page or multi-page kind.');
  if (!Array.isArray(value.pages) || value.pages.length === 0)
    return invalid(`${path}.pages`, 'Page map needs at least one page.');
  if (value.kind === 'single-page' && value.pages.length !== 1)
    return invalid(`${path}.pages`, 'A single-page map must contain exactly one page.');
  if (value.kind === 'multi-page' && value.pages.length < 2)
    return invalid(`${path}.pages`, 'A multi-page map must contain at least two pages.');
  const routes = new Set<string>();
  const ids = new Set<string>();
  for (const [index, page] of value.pages.entries()) {
    const validated = validatePageMapEntry(page, `${path}.pages.${index}`);
    if (!validated.ok) return validated;
    if (routes.has(validated.value.route))
      return invalid(`${path}.pages.${index}.route`, 'Page routes must be unique.');
    if (ids.has(validated.value.id))
      return invalid(`${path}.pages.${index}.id`, 'Page ids must be unique.');
    routes.add(validated.value.route);
    ids.add(validated.value.id);
  }
  return success(value as unknown as PageMap);
}

export function validateDiscoveryInterpretation(
  value: unknown,
  path = 'interpretation'
): Result<DiscoveryInterpretation, ContractValidationError> {
  if (!isRecord(value)) return invalid(path, 'Discovery interpretation must be an object.');
  if (!DISCOVERY_TOPICS.includes(value.topic as never))
    return invalid(`${path}.topic`, 'Discovery topic is invalid.');
  if (!['user', 'model', 'repository'].includes(String(value.source)))
    return invalid(`${path}.source`, 'Interpretation source is invalid.');
  if (!nonEmpty(value.evidence))
    return invalid(`${path}.evidence`, 'Interpretation evidence is required.');
  const discovered = validateDiscoveryValue(value.value, `${path}.value`);
  if (!discovered.ok) return discovered;
  return success(value as unknown as DiscoveryInterpretation);
}

export function validateDiscoveryAnswer(
  value: unknown,
  path = 'answer'
): Result<DiscoveryAnswer, ContractValidationError> {
  if (!isRecord(value)) return invalid(path, 'Discovery answer must be an object.');
  if (!nonEmpty(value.questionId))
    return invalid(`${path}.questionId`, 'Answer questionId is required.');
  if (!DISCOVERY_TOPICS.includes(value.topic as never))
    return invalid(`${path}.topic`, 'Discovery topic is invalid.');
  if (!DISCOVERY_ANSWER_MODES.includes(value.mode as never))
    return invalid(`${path}.mode`, 'Discovery answer mode is invalid.');
  if (!nonEmpty(value.answeredAt))
    return invalid(`${path}.answeredAt`, 'Answer timestamp is required.');
  if (['exact', 'preference'].includes(String(value.mode)) && value.value === undefined)
    return invalid(`${path}.value`, `${String(value.mode)} answers require a value.`);
  if (value.value !== undefined) {
    const discovered = validateDiscoveryValue(value.value, `${path}.value`);
    if (!discovered.ok) return discovered;
  }
  return success(value as unknown as DiscoveryAnswer);
}

export function validateDecisionProvenance(
  value: unknown,
  path = 'decision'
): Result<DecisionProvenance, ContractValidationError> {
  if (!isRecord(value)) return invalid(path, 'Decision provenance must be an object.');
  if (!nonEmpty(value.id)) return invalid(`${path}.id`, 'Decision id is required.');
  if (!DISCOVERY_TOPICS.includes(value.topic as never))
    return invalid(`${path}.topic`, 'Decision topic is invalid.');
  if (!['user', 'model', 'repository', 'policy'].includes(String(value.source)))
    return invalid(`${path}.source`, 'Decision source is invalid.');
  if (
    !['explicit', 'preferred', 'delegated', 'drafted', 'assumed'].includes(
      String(value.disposition)
    )
  )
    return invalid(`${path}.disposition`, 'Decision disposition is invalid.');
  if (!nonEmpty(value.evidence))
    return invalid(`${path}.evidence`, 'Decision evidence is required.');
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 1)
    return invalid(`${path}.revision`, 'Decision revision must be a positive integer.');
  if (typeof value.requiresConfirmation !== 'boolean')
    return invalid(`${path}.requiresConfirmation`, 'requiresConfirmation must be boolean.');
  if (value.answerMode !== undefined && !DISCOVERY_ANSWER_MODES.includes(value.answerMode as never))
    return invalid(`${path}.answerMode`, 'Decision answer mode is invalid.');
  const modelDisposition = value.disposition === 'assumed' || value.disposition === 'drafted';
  if ((value.source === 'model') !== modelDisposition)
    return invalid(
      `${path}.disposition`,
      'Model decisions must be assumed or drafted, and those dispositions require model source.'
    );
  const expectedConfirmation =
    highImpactTopics.has(String(value.topic)) && (value.source === 'model' || modelDisposition);
  if (value.requiresConfirmation !== expectedConfirmation)
    return invalid(
      `${path}.requiresConfirmation`,
      `requiresConfirmation must be ${String(expectedConfirmation)} for this provenance.`
    );
  if (value.id !== `decision:${String(value.topic)}:${String(value.revision)}`)
    return invalid(`${path}.id`, 'Decision id must match its topic and revision.');
  const discovered = validateDiscoveryValue(value.value, `${path}.value`);
  if (!discovered.ok) return discovered;
  return success(value as unknown as DecisionProvenance);
}

function validateDecisionCollection(
  value: unknown,
  path: string
): Result<readonly DecisionProvenance[], ContractValidationError> {
  if (!Array.isArray(value)) return invalid(path, 'Decisions must be an array.');
  const ids = new Set<string>();
  const revisions = new Set<string>();
  for (const [index, decision] of value.entries()) {
    const decisionPath = `${path}.${index}`;
    const result = validateDecisionProvenance(decision, decisionPath);
    if (!result.ok) return result;
    if (ids.has(result.value.id))
      return invalid(`${decisionPath}.id`, 'Decision ids must be unique.');
    const revisionKey = `${result.value.topic}:${result.value.revision}`;
    if (revisions.has(revisionKey))
      return invalid(`${decisionPath}.revision`, 'Decision revisions must be unique per topic.');
    ids.add(result.value.id);
    revisions.add(revisionKey);
  }
  return success(value as readonly DecisionProvenance[]);
}
export function validateDiscoverySession(
  value: unknown
): Result<DiscoverySession, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Discovery session must be an object.');
  if (value.contractVersion !== DISCOVERY_CONTRACT_VERSION)
    return invalid('contractVersion', 'Unsupported discovery contract version.');
  for (const field of ['id', 'prompt', 'createdAt', 'updatedAt'] as const)
    if (!nonEmpty(value[field])) return invalid(field, `${field} is required.`);
  if (!Array.isArray(value.interpretations))
    return invalid('interpretations', 'Interpretations must be an array.');
  for (const [index, interpretation] of value.interpretations.entries()) {
    const result = validateDiscoveryInterpretation(interpretation, `interpretations.${index}`);
    if (!result.ok) return result;
  }
  if (!Array.isArray(value.answers)) return invalid('answers', 'Answers must be an array.');
  for (const [index, answer] of value.answers.entries()) {
    const result = validateDiscoveryAnswer(answer, `answers.${index}`);
    if (!result.ok) return result;
  }
  const decisions = validateDecisionCollection(value.decisions, 'decisions');
  if (!decisions.ok) return decisions;
  if (value.pageMap !== undefined) {
    const result = validatePageMap(value.pageMap);
    if (!result.ok) return result;
  }
  const approval = validateApproval(value.approval, 'approval');
  if (!approval.ok) return approval;
  if (value.brief === undefined) {
    if (approval.value.status !== 'discovering')
      return invalid('approval.status', 'A session without a brief must be discovering.');
  } else {
    const brief = validateCreativeBrief(value.brief);
    if (!brief.ok) {
      const nestedPath = brief.error.path === '$' ? 'brief' : `brief.${brief.error.path}`;
      return invalid(nestedPath, brief.error.message);
    }
    if (brief.value.id !== `brief:${String(value.id)}`)
      return invalid('brief.id', 'Brief id must match its discovery session.');
    if (!structurallyEqual(approval.value, brief.value.approval))
      return invalid('approval', 'Session and brief approval states must match.');
    if (value.updatedAt !== brief.value.updatedAt)
      return invalid('updatedAt', 'Session and brief timestamps must match while a brief exists.');
    if (!structurallyEqual(decisions.value, brief.value.decisions))
      return invalid('brief.decisions', 'Session and brief decisions must match.');
    if (
      value.pageMap === undefined ||
      !structurallyEqual(value.pageMap, brief.value.content.pageMap)
    )
      return invalid('brief.content.pageMap', 'Session and brief page maps must match.');
  }
  return success(value as unknown as DiscoverySession);
}

export function validateCreativeBrief(
  value: unknown
): Result<CreativeBrief, ContractValidationError> {
  if (!isRecord(value)) return invalid('$', 'Creative brief must be an object.');
  if (value.contractVersion !== DISCOVERY_CONTRACT_VERSION)
    return invalid('contractVersion', 'Unsupported discovery contract version.');
  for (const field of ['id', 'createdAt', 'updatedAt', 'digest'] as const)
    if (!nonEmpty(value[field])) return invalid(field, `${field} is required.`);
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1)
    return invalid('version', 'Creative brief version must be a positive integer.');
  if (!isRecord(value.content)) return invalid('content', 'Creative brief content is required.');
  for (const topic of ['purpose', 'audience', 'pageContent'] as const) {
    const result = validateDiscoveryValue(value.content[topic], `content.${topic}`);
    if (!result.ok) return result;
  }
  const pageMap = validatePageMap(value.content.pageMap, 'content.pageMap');
  if (!pageMap.ok) return pageMap;
  for (const field of ['constraints', 'antiPatterns', 'preferences'] as const)
    if (!stringArray(value.content[field]))
      return invalid(`content.${field}`, `${field} must be a string array.`);
  if (
    !Array.isArray(value.content.references) ||
    !value.content.references.every(
      (reference) =>
        isRecord(reference) &&
        nonEmpty(reference.description) &&
        ['inspiration', 'anti-reference'].includes(String(reference.role)) &&
        (reference.url === undefined || nonEmpty(reference.url))
    )
  )
    return invalid('content.references', 'Creative brief references are invalid.');
  const decisions = validateDecisionCollection(value.decisions, 'decisions');
  if (!decisions.ok) return decisions;
  if (!Array.isArray(value.unresolved))
    return invalid('unresolved', 'Unresolved information must be an array.');
  if (!Array.isArray(value.revisions)) return invalid('revisions', 'Revisions must be an array.');
  if (value.revisions.length !== Number(value.version) - 1)
    return invalid(
      'revisions',
      'Revision history must contain one entry per version after version 1.'
    );
  const revisionVersions = new Set<number>();
  for (const [index, revision] of value.revisions.entries()) {
    const path = `revisions.${index}`;
    if (!isRecord(revision)) return invalid(path, 'Brief revision must be an object.');
    if (!Number.isSafeInteger(revision.version) || Number(revision.version) < 2)
      return invalid(`${path}.version`, 'Revision version must be an integer of at least 2.');
    if (revision.version !== index + 2 || revisionVersions.has(Number(revision.version)))
      return invalid(`${path}.version`, 'Revision versions must be unique and sequential.');
    revisionVersions.add(Number(revision.version));
    for (const field of ['revisedAt', 'reason', 'digest'] as const)
      if (!nonEmpty(revision[field])) return invalid(`${path}.${field}`, `${field} is required.`);
    if (
      !Array.isArray(revision.changedTopics) ||
      !revision.changedTopics.every((topic) => DISCOVERY_TOPICS.includes(topic as never))
    )
      return invalid(`${path}.changedTopics`, 'Changed topics are invalid.');
  }
  const latestRevision = value.revisions.at(-1);
  if (isRecord(latestRevision) && latestRevision.digest !== value.digest)
    return invalid('revisions', 'Latest revision digest must match the current brief digest.');
  const expectedDigest = digestCreativeBrief(value as unknown as CreativeBrief);
  if (value.digest !== expectedDigest)
    return invalid('digest', 'Creative brief digest does not match its content and decisions.');
  const approval = validateApproval(value.approval, 'approval');
  if (!approval.ok) return approval;
  if (approval.value.status === 'approved' && approval.value.approvedDigest !== value.digest)
    return invalid(
      'approval.approvedDigest',
      'Approved digest must match the current brief digest.'
    );
  return success(value as unknown as CreativeBrief);
}
