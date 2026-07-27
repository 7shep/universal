import {
  DISCOVERY_CONTRACT_VERSION,
  type BriefApproval,
  type CreativeBriefRevisionInput,
  type CreativeBrief,
  type DecisionDisposition,
  type DecisionProvenance,
  type DiscoveryAnswer,
  type DiscoveryInterpretation,
  type DiscoverySession,
  type DiscoverySource,
  type DiscoveryTopic,
  type DiscoveryValue,
  type PageMap,
  type StartDiscoveryInput
} from './discovery-contracts.ts';
import {
  approveCreativeBrief,
  createCreativeBrief,
  requestCreativeBriefApproval,
  requestCreativeBriefRevision,
  reviseCreativeBrief
} from './creative-brief.ts';
import { evaluateDiscoveryPolicy } from './discovery-policy.ts';
import {
  validateDiscoveryAnswer,
  validateDiscoveryInterpretation,
  validateDiscoverySession,
  validatePageMap
} from './discovery-validation.ts';

const highImpact = new Set<DiscoveryTopic>(['purpose', 'audience', 'page-map', 'page-content']);

function revisionFor(session: DiscoverySession, topic: DiscoveryTopic): number {
  return session.decisions.filter((decision) => decision.topic === topic).length + 1;
}

function decision(
  session: DiscoverySession,
  topic: DiscoveryTopic,
  value: DiscoveryValue,
  source: DiscoverySource,
  disposition: DecisionDisposition,
  evidence: string,
  answerMode?: DiscoveryAnswer['mode']
): DecisionProvenance {
  const revision = revisionFor(session, topic);
  const requiresConfirmation =
    highImpact.has(topic) && (disposition === 'drafted' || disposition === 'assumed');
  return {
    id: `decision:${topic}:${revision}`,
    topic,
    value,
    source,
    disposition,
    ...(answerMode ? { answerMode } : {}),
    evidence,
    revision,
    requiresConfirmation
  };
}

function interpretationDecision(
  session: DiscoverySession,
  interpretation: DiscoveryInterpretation
): DecisionProvenance {
  const disposition: DecisionDisposition =
    interpretation.source === 'user'
      ? 'explicit'
      : interpretation.source === 'model'
        ? 'assumed'
        : 'explicit';
  return decision(
    session,
    interpretation.topic,
    interpretation.value,
    interpretation.source,
    disposition,
    interpretation.evidence
  );
}

function assertSession(session: DiscoverySession): DiscoverySession {
  const validation = validateDiscoverySession(session);
  if (!validation.ok)
    throw new Error(
      `Invalid discovery session at ${validation.error.path}: ${validation.error.message}`
    );
  return session;
}

export function startDiscoverySession(input: StartDiscoveryInput): DiscoverySession {
  if (!input.id.trim() || !input.prompt.trim() || !input.now.trim())
    throw new Error('Discovery session id, prompt, and timestamp are required.');
  let session: DiscoverySession = {
    contractVersion: DISCOVERY_CONTRACT_VERSION,
    id: input.id,
    prompt: input.prompt,
    createdAt: input.now,
    updatedAt: input.now,
    interpretations: [],
    answers: [],
    decisions: [],
    approval: { status: 'discovering' }
  };
  for (const interpretation of input.interpretations ?? [])
    session = addDiscoveryInterpretation(session, interpretation, input.now);
  if (input.pageMap)
    session = setDiscoveryPageMap(session, input.pageMap, {
      now: input.now,
      source: 'user',
      evidence: 'Page map supplied when discovery started.'
    });
  return assertSession(session);
}

export function addDiscoveryInterpretation(
  session: DiscoverySession,
  interpretation: DiscoveryInterpretation,
  now: string
): DiscoverySession {
  if (session.approval.status === 'approved')
    throw new Error('Reopen the approved brief before adding discovery evidence.');
  const validation = validateDiscoveryInterpretation(interpretation);
  if (!validation.ok)
    throw new Error(
      `Invalid discovery interpretation at ${validation.error.path}: ${validation.error.message}`
    );
  const next = {
    ...session,
    updatedAt: now,
    interpretations: [...session.interpretations, interpretation],
    decisions: [...session.decisions, interpretationDecision(session, interpretation)]
  };
  return assertSession(next);
}

export function answerDiscoveryQuestion(
  session: DiscoverySession,
  answer: DiscoveryAnswer
): DiscoverySession {
  if (session.approval.status === 'approved')
    throw new Error('Reopen the approved brief before answering discovery questions.');
  const validation = validateDiscoveryAnswer(answer);
  if (!validation.ok)
    throw new Error(
      `Invalid discovery answer at ${validation.error.path}: ${validation.error.message}`
    );
  if (answer.questionId !== `discovery:${answer.topic}`)
    throw new Error('Discovery answer questionId does not match its topic.');

  let decisions = session.decisions;
  if (answer.mode === 'exact' || answer.mode === 'preference') {
    decisions = [
      ...decisions,
      decision(
        session,
        answer.topic,
        answer.value!,
        'user',
        answer.mode === 'exact' ? 'explicit' : 'preferred',
        `User answered ${answer.questionId}.`,
        answer.mode
      )
    ];
  } else if (answer.mode === 'use-judgment') {
    decisions = [
      ...decisions,
      decision(
        session,
        answer.topic,
        answer.value ?? { summary: 'Universal may decide this during art direction.' },
        'user',
        'delegated',
        `User delegated ${answer.topic} to Universal.`,
        answer.mode
      )
    ];
  } else if (answer.mode === 'draft' && answer.value) {
    decisions = [
      ...decisions,
      decision(
        session,
        answer.topic,
        answer.value,
        'model',
        'drafted',
        `Draft requested by the user for ${answer.topic}.`,
        answer.mode
      )
    ];
  }

  return assertSession({
    ...session,
    updatedAt: answer.answeredAt,
    answers: [...session.answers, answer],
    decisions
  });
}

export interface SetPageMapOptions {
  now: string;
  source: Exclude<DiscoverySource, 'policy'>;
  evidence: string;
  disposition?: DecisionDisposition | undefined;
}

export function setDiscoveryPageMap(
  session: DiscoverySession,
  pageMap: PageMap,
  options: SetPageMapOptions
): DiscoverySession {
  const validation = validatePageMap(pageMap);
  if (!validation.ok)
    throw new Error(`Invalid page map at ${validation.error.path}: ${validation.error.message}`);
  const disposition = options.disposition ?? (options.source === 'model' ? 'drafted' : 'explicit');
  const mapDecision = decision(
    session,
    'page-map',
    {
      summary:
        pageMap.kind === 'single-page'
          ? `Single page: ${pageMap.pages[0]!.name}`
          : `${pageMap.pages.length} pages: ${pageMap.pages.map((page) => page.name).join(', ')}`,
      details: pageMap.pages.map((page) => `${page.route} — ${page.userGoal}`)
    },
    options.source,
    disposition,
    options.evidence
  );
  return assertSession({
    ...session,
    updatedAt: options.now,
    pageMap,
    decisions: [...session.decisions, mapDecision]
  });
}

function withBrief(
  session: DiscoverySession,
  brief: CreativeBrief,
  approval: BriefApproval,
  now: string
): DiscoverySession {
  return assertSession({ ...session, updatedAt: now, brief, approval });
}

export function prepareDiscoveryBrief(session: DiscoverySession, now: string): DiscoverySession {
  const brief = createCreativeBrief(session, now);
  return withBrief(session, brief, brief.approval, now);
}

export function requestDiscoveryApproval(session: DiscoverySession, now: string): DiscoverySession {
  const current = session.brief ?? createCreativeBrief(session, now);
  // Re-evaluate current session policy so stale brief state cannot bypass policy.
  const policy = evaluateDiscoveryPolicy(session);
  if (!policy.canRequestApproval)
    throw new Error('Deterministic discovery policy does not allow approval yet.');
  const brief = requestCreativeBriefApproval({ ...current, unresolved: policy.missing }, now);
  return withBrief(session, brief, brief.approval, now);
}

export function approveDiscoveryBrief(
  session: DiscoverySession,
  now: string,
  approvedBy = 'user'
): DiscoverySession {
  if (!session.brief) throw new Error('Prepare and request approval for a creative brief first.');
  const policy = evaluateDiscoveryPolicy(session);
  if (!policy.canApprove)
    throw new Error('Deterministic discovery policy does not allow approval.');
  const brief = approveCreativeBrief(session.brief, now, approvedBy);
  return withBrief(session, brief, brief.approval, now);
}

export function requestDiscoveryRevision(
  session: DiscoverySession,
  now: string,
  reason: string
): DiscoverySession {
  if (!session.brief) throw new Error('No creative brief exists to revise.');
  const brief = requestCreativeBriefRevision(session.brief, now, reason);
  return withBrief(session, brief, brief.approval, now);
}

export function reviseDiscoveryBrief(
  session: DiscoverySession,
  input: CreativeBriefRevisionInput
): DiscoverySession {
  if (!session.brief) throw new Error('No creative brief exists to revise.');
  const brief = reviseCreativeBrief(session.brief, input);
  return assertSession({
    ...session,
    updatedAt: input.now,
    interpretations: [...session.interpretations, ...(input.interpretations ?? [])],
    decisions: [...session.decisions, ...brief.decisions.slice(session.brief.decisions.length)],
    ...(input.pageMap ? { pageMap: input.pageMap } : {}),
    brief,
    approval: brief.approval
  });
}

export const createDiscoverySession = startDiscoverySession;
