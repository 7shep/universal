import {
  type DecisionProvenance,
  type DiscoveryImpact,
  type DiscoveryPolicyResult,
  type DiscoveryQuestion,
  type DiscoverySession,
  type DiscoveryTopic,
  type MissingInformation
} from './discovery-contracts.ts';
import { validatePageMap } from './discovery-validation.ts';

interface TopicPolicy {
  topic: DiscoveryTopic;
  impact: DiscoveryImpact;
  group: DiscoveryQuestion['group'];
  order: number;
  prompt: string;
  rationale: string;
  dependsOn?: readonly DiscoveryTopic[] | undefined;
  requiredForBrief?: boolean | undefined;
}

const TOPIC_POLICY: readonly TopicPolicy[] = [
  {
    topic: 'purpose',
    impact: 'high',
    group: 'strategy',
    order: 10,
    prompt: 'What must this project accomplish for the organization or product?',
    rationale: 'Purpose determines the page narrative and success criteria.',
    requiredForBrief: true
  },
  {
    topic: 'audience',
    impact: 'high',
    group: 'strategy',
    order: 20,
    prompt: 'Who is the primary audience, and what do they need when they arrive?',
    rationale: 'Audience needs determine hierarchy, language, and interaction priorities.',
    requiredForBrief: true
  },
  {
    topic: 'positioning',
    impact: 'medium',
    group: 'strategy',
    order: 30,
    prompt: 'How should this project be positioned against its alternatives?',
    rationale: 'Positioning prevents a visually polished but interchangeable result.'
  },
  {
    topic: 'emotional-response',
    impact: 'medium',
    group: 'strategy',
    order: 40,
    prompt: 'What should someone feel in the first few seconds?',
    rationale: 'The emotional objective guides art direction without prescribing a style.'
  },
  {
    topic: 'page-map',
    impact: 'high',
    group: 'structure',
    order: 50,
    prompt: 'Which pages are needed, or should this be one page?',
    rationale: 'A page map prevents missing routes and gives every page a clear job.',
    dependsOn: ['purpose'],
    requiredForBrief: true
  },
  {
    topic: 'page-content',
    impact: 'high',
    group: 'content',
    order: 60,
    prompt: 'For each page, which sections, content, states, and actions are required?',
    rationale: 'Required content must drive composition rather than fill a template.',
    dependsOn: ['page-map'],
    requiredForBrief: true
  },
  {
    topic: 'hero',
    impact: 'medium',
    group: 'content',
    order: 70,
    prompt: 'What must the opening communicate, and is any headline or support copy fixed?',
    rationale: 'The opening establishes the first-read message and content hierarchy.',
    dependsOn: ['purpose']
  },
  {
    topic: 'navigation',
    impact: 'medium',
    group: 'structure',
    order: 80,
    prompt: 'What navigation is needed, and where should each item lead?',
    rationale: 'Navigation must reflect the page map and user journey.',
    dependsOn: ['page-map']
  },
  {
    topic: 'constraints',
    impact: 'medium',
    group: 'constraints',
    order: 90,
    prompt:
      'Which accessibility, responsive, platform, technical, or design-system constraints apply?',
    rationale: 'Constraints can materially limit otherwise attractive directions.'
  },
  {
    topic: 'brand-assets',
    impact: 'medium',
    group: 'visual-direction',
    order: 100,
    prompt: 'Which logos, brand assets, or existing design-system elements must be used?',
    rationale: 'Existing assets affect both visual direction and implementation.'
  },
  {
    topic: 'references',
    impact: 'low',
    group: 'visual-direction',
    order: 110,
    prompt: 'Are there references you like, and what specifically should inform the work?',
    rationale: 'Specific reference qualities are more useful than imitation.'
  },
  {
    topic: 'anti-patterns',
    impact: 'medium',
    group: 'visual-direction',
    order: 120,
    prompt: 'What must the result avoid, including anti-references or generic AI patterns?',
    rationale: 'Explicit exclusions protect the intended identity.'
  },
  {
    topic: 'color',
    impact: 'low',
    group: 'visual-direction',
    order: 130,
    prompt: 'Are any colors required or prohibited, or should Universal propose the palette?',
    rationale: 'Color constraints matter, but can often be safely delegated.'
  },
  {
    topic: 'typography',
    impact: 'low',
    group: 'visual-direction',
    order: 140,
    prompt: 'Are there typography requirements or preferences?',
    rationale: 'Typography preferences refine a direction after strategy is clear.'
  },
  {
    topic: 'imagery',
    impact: 'low',
    group: 'visual-direction',
    order: 150,
    prompt: 'What imagery, illustration, photography, or icon direction is available or preferred?',
    rationale: 'Media direction should reflect real content and available assets.'
  }
];

const impactRank: Record<DiscoveryImpact, number> = { high: 0, medium: 1, low: 2 };

function latestDecision(
  decisions: readonly DecisionProvenance[],
  topic: DiscoveryTopic
): DecisionProvenance | undefined {
  return [...decisions].reverse().find((decision) => decision.topic === topic);
}

function hasAnswer(session: DiscoverySession, topic: DiscoveryTopic): boolean {
  return session.answers.some((answer) => answer.topic === topic);
}

function topicResolved(session: DiscoverySession, topic: DiscoveryTopic): boolean {
  if (topic === 'page-map')
    return session.pageMap !== undefined && validatePageMap(session.pageMap).ok;
  return latestDecision(session.decisions, topic) !== undefined;
}

function missingReason(
  session: DiscoverySession,
  policy: TopicPolicy
): MissingInformation['reason'] {
  if (policy.topic === 'page-map' && session.pageMap !== undefined) return 'incomplete-value';
  const answer = [...session.answers].reverse().find((item) => item.topic === policy.topic);
  if (answer?.mode === 'draft') return 'awaiting-draft';
  if (answer?.mode === 'unknown') return 'awaiting-recommendation';
  return 'unanswered';
}

function questionFor(policy: TopicPolicy): DiscoveryQuestion {
  return {
    id: `discovery:${policy.topic}`,
    topic: policy.topic,
    group: policy.group,
    impact: policy.impact,
    prompt: policy.prompt,
    rationale: policy.rationale,
    order: policy.order
  };
}

/**
 * Deterministic trust boundary for discovery. This function never calls a model
 * and depends only on validated structured session state.
 */
export function evaluateDiscoveryPolicy(session: DiscoverySession): DiscoveryPolicyResult {
  const missing: MissingInformation[] = [];
  const questions: DiscoveryQuestion[] = [];

  for (const policy of TOPIC_POLICY) {
    const decision = latestDecision(session.decisions, policy.topic);
    if (topicResolved(session, policy.topic)) {
      if (decision?.requiresConfirmation) {
        missing.push({
          topic: policy.topic,
          impact: policy.impact,
          reason: 'confirmation-required',
          questionId: `discovery:${policy.topic}`,
          blocksApproval: policy.impact === 'high'
        });
      }
      continue;
    }

    const reason = missingReason(session, policy);
    const blocksApproval = policy.impact === 'high';
    missing.push({
      topic: policy.topic,
      impact: policy.impact,
      reason,
      questionId: `discovery:${policy.topic}`,
      blocksApproval
    });

    const dependenciesResolved = (policy.dependsOn ?? []).every((topic) =>
      topicResolved(session, topic)
    );
    // Do not repeat a question after an explicit unknown/draft response. The
    // caller should supply a recommendation or draft as a structured decision.
    if (dependenciesResolved && !hasAnswer(session, policy.topic))
      questions.push(questionFor(policy));
  }

  questions.sort(
    (left, right) =>
      impactRank[left.impact] - impactRank[right.impact] ||
      left.order - right.order ||
      left.id.localeCompare(right.id)
  );

  const coreComplete = TOPIC_POLICY.filter((policy) => policy.requiredForBrief).every((policy) =>
    topicResolved(session, policy.topic)
  );
  const approvalBlockers = missing.filter((item) => item.blocksApproval);
  const approvalPending = session.approval.status === 'approval-pending';

  return {
    missing,
    questions,
    canPrepareBrief: coreComplete,
    canRequestApproval: coreComplete && approvalBlockers.length === 0,
    canApprove: approvalPending && approvalBlockers.length === 0
  };
}

/** Returns the next adaptive batch, grouping adjacent questions when practical. */
export function getNextDiscoveryQuestions(
  session: DiscoverySession,
  limit = 3
): readonly DiscoveryQuestion[] {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('Discovery question limit must be a positive integer.');
  const ordered = evaluateDiscoveryPolicy(session).questions;
  if (ordered.length <= 1) return ordered.slice(0, limit);
  const first = ordered[0]!;
  const sameGroup = ordered.filter(
    (question) => question.group === first.group && question.impact === first.impact
  );
  const selected = sameGroup.length > 1 ? sameGroup : ordered;
  return selected.slice(0, limit);
}

export function detectMissingInformation(session: DiscoverySession): readonly MissingInformation[] {
  return evaluateDiscoveryPolicy(session).missing;
}

export const discoveryTopicPolicy = TOPIC_POLICY;
