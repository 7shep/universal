export const ART_DIRECTION_BENCHMARK_DIMENSIONS = [
  'discovery_coverage',
  'no_silent_high_impact_assumptions',
  'concept_differentiation',
  'brief_fit',
  'generic_pattern_resistance',
  'approval_and_provenance_integrity'
] as const;

export type ArtDirectionBenchmarkDimension = (typeof ART_DIRECTION_BENCHMARK_DIMENSIONS)[number];

export interface ArtDirectionDecisionEvidence {
  id: string;
  topic: string;
  source: string;
  disposition: string;
  requiresConfirmation: boolean;
}

export interface ArtDirectionBriefEvidence {
  id: string;
  version: number;
  digest: string;
  approval: {
    status: string;
    approvedDigest?: string | undefined;
    approvedBy?: string | undefined;
  };
  decisions: readonly ArtDirectionDecisionEvidence[];
  pageIds: readonly string[];
}

export interface ArtDirectionCandidateEvidence {
  id: string;
  centralIdea: string;
  narrativeStructure: string;
  composition: string;
  navigationPhilosophy: string;
  typographyIntent: string;
  imageryIntent: string;
  interactionPhilosophy: string;
  responsiveBehavior: string;
  rejectedDefaults: readonly string[];
}

export interface ArtDirectionEvaluationEvidence {
  candidateId: string;
  eligible: boolean;
  criteria: {
    approvedBriefFit: { score: number };
    genericPatternResistance: { score: number };
  };
}

export interface ArtDirectionBenchmarkEvidence {
  brief: ArtDirectionBriefEvidence;
  concepts: {
    approvedBriefDigest: string;
    digest: string;
    candidates: readonly ArtDirectionCandidateEvidence[];
    evaluations: readonly ArtDirectionEvaluationEvidence[];
    recommendedCandidateId: string;
  };
  selectedDirection: {
    approvedBriefDigest: string;
    conceptDigest: string;
    candidateId: string;
    digest: string;
  };
  plan: {
    contractVersion: string;
    digest: string;
    source: {
      briefId: string;
      briefVersion: number;
      briefDigest: string;
      approvedDigest: string;
      directionId: string;
    };
    pageIds: readonly string[];
    decisionProvenance: readonly {
      sourceKind: string;
      sourceId: string;
      approved: boolean;
    }[];
  };
}

export interface ArtDirectionDimensionResult {
  dimension: ArtDirectionBenchmarkDimension;
  status: 'pass' | 'fail';
  rationale: string;
  details: readonly string[];
}

export interface ArtDirectionBenchmarkReport {
  format: 'universal.design-benchmark.art-direction';
  formatVersion: '1';
  passed: boolean;
  dimensions: readonly ArtDirectionDimensionResult[];
}

const REQUIRED_DISCOVERY_TOPICS = [
  'audience',
  'hero',
  'color',
  'navigation',
  'page-map',
  'page-content',
  'imagery'
] as const;
const HIGH_IMPACT_TOPICS = ['purpose', 'audience', 'page-map', 'page-content'] as const;
const CONCEPT_DIMENSIONS = [
  'centralIdea',
  'narrativeStructure',
  'composition',
  'navigationPhilosophy',
  'typographyIntent',
  'imageryIntent',
  'interactionPhilosophy',
  'responsiveBehavior'
] as const;
const GENERIC_PATTERNS = [
  /\bclean modern\b/i,
  /\bbento grid\b/i,
  /\bfloating cards?\b/i,
  /\bgeneric saas\b/i,
  /\bdashboard mockup\b/i,
  /\bglassmorphism\b/i
] as const;

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((token) => token.length > 2)
  );
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 1;
  return [...a].filter((token) => b.has(token)).length / union.size;
}

function result(
  dimension: ArtDirectionBenchmarkDimension,
  details: readonly string[],
  success: string,
  failure: string
): ArtDirectionDimensionResult {
  return {
    dimension,
    status: details.length === 0 ? 'pass' : 'fail',
    rationale: details.length === 0 ? success : failure,
    details
  };
}

export function evaluateArtDirectionBenchmark(
  evidence: ArtDirectionBenchmarkEvidence
): ArtDirectionBenchmarkReport {
  const decisionsByTopic = new Map(
    evidence.brief.decisions.map((decision) => [decision.topic, decision] as const)
  );
  const missingDiscovery = REQUIRED_DISCOVERY_TOPICS.filter(
    (topic) => !decisionsByTopic.has(topic)
  ).map((topic) => `Missing discovery decision: ${topic}.`);
  if (evidence.brief.pageIds.length === 0) missingDiscovery.push('Approved page map has no pages.');

  const silentAssumptions = HIGH_IMPACT_TOPICS.flatMap((topic) => {
    const decision = decisionsByTopic.get(topic);
    if (!decision) return [`Missing high-impact decision: ${topic}.`];
    if (decision.requiresConfirmation)
      return [`High-impact decision still needs confirmation: ${topic}.`];
    if (
      !['user', 'repository'].includes(decision.source) ||
      !['explicit', 'preferred'].includes(decision.disposition)
    )
      return [`High-impact decision is not explicit approved evidence: ${topic}.`];
    return [];
  });

  const differentiation: string[] = [];
  if (evidence.concepts.candidates.length < 3)
    differentiation.push('Fewer than three concepts were developed.');
  for (let left = 0; left < evidence.concepts.candidates.length; left += 1) {
    for (let right = left + 1; right < evidence.concepts.candidates.length; right += 1) {
      const a = evidence.concepts.candidates[left]!;
      const b = evidence.concepts.candidates[right]!;
      const differing = CONCEPT_DIMENSIONS.filter(
        (dimension) => similarity(a[dimension], b[dimension]) < 0.68
      );
      if (differing.length < 4 || !differing.includes('centralIdea'))
        differentiation.push(`${a.id} and ${b.id} are not meaningfully differentiated.`);
    }
  }

  const recommendedEvaluation = evidence.concepts.evaluations.find(
    (evaluation) => evaluation.candidateId === evidence.concepts.recommendedCandidateId
  );
  const briefFit: string[] = [];
  if (!recommendedEvaluation) briefFit.push('Recommended concept has no evaluation.');
  else {
    if (!recommendedEvaluation.eligible) briefFit.push('Recommended concept is ineligible.');
    if (recommendedEvaluation.criteria.approvedBriefFit.score < 4.5)
      briefFit.push('Recommended concept does not meet the brief-fit gate.');
  }

  const genericResistance: string[] = [];
  const recommendedCandidate = evidence.concepts.candidates.find(
    (candidate) => candidate.id === evidence.concepts.recommendedCandidateId
  );
  if (!recommendedCandidate) genericResistance.push('Recommended concept is missing.');
  else {
    const text = CONCEPT_DIMENSIONS.map((dimension) => recommendedCandidate[dimension]).join(' ');
    const detected = GENERIC_PATTERNS.filter((pattern) => pattern.test(text));
    if (detected.length > 0)
      genericResistance.push(`Recommended concept contains ${detected.length} generic pattern(s).`);
    if (recommendedCandidate.rejectedDefaults.length < 2)
      genericResistance.push('Recommended concept rejects fewer than two defaults.');
  }
  if (!recommendedEvaluation || recommendedEvaluation.criteria.genericPatternResistance.score < 5)
    genericResistance.push('Generic-pattern-resistance score is below the benchmark gate.');

  const integrity: string[] = [];
  const { brief, concepts, selectedDirection, plan } = evidence;
  if (
    brief.approval.status !== 'approved' ||
    !brief.approval.approvedBy ||
    brief.approval.approvedDigest !== brief.digest
  )
    integrity.push('Creative brief lacks explicit digest-current approval.');
  if (concepts.approvedBriefDigest !== brief.digest)
    integrity.push('Concepts are not bound to the approved brief digest.');
  if (
    selectedDirection.approvedBriefDigest !== brief.digest ||
    selectedDirection.conceptDigest !== concepts.digest ||
    selectedDirection.candidateId !== concepts.recommendedCandidateId
  )
    integrity.push('Selected direction is not bound to the approved concepts.');
  if (
    plan.contractVersion !== '2.0.0' ||
    plan.source.briefId !== brief.id ||
    plan.source.briefVersion !== brief.version ||
    plan.source.briefDigest !== brief.digest ||
    plan.source.approvedDigest !== brief.digest ||
    plan.source.directionId !== selectedDirection.candidateId
  )
    integrity.push('Design Plan v2 source bindings do not match the approved selection.');
  if (
    plan.pageIds.length !== brief.pageIds.length ||
    brief.pageIds.some((pageId) => !plan.pageIds.includes(pageId))
  )
    integrity.push('Design Plan v2 does not preserve the approved page map.');
  if (
    !plan.digest ||
    plan.decisionProvenance.length === 0 ||
    plan.decisionProvenance.some((item) => !item.approved || !item.sourceId || !item.sourceKind)
  )
    integrity.push('Design Plan v2 provenance is incomplete or unapproved.');

  const dimensions = [
    result(
      'discovery_coverage',
      missingDiscovery,
      'Audience, hero, palette, navigation, pages, content, and imagery are covered.',
      'Discovery coverage is incomplete.'
    ),
    result(
      'no_silent_high_impact_assumptions',
      silentAssumptions,
      'Every high-impact decision is explicit approved evidence.',
      'One or more high-impact decisions were silently assumed.'
    ),
    result(
      'concept_differentiation',
      differentiation,
      'At least three concepts differ across central idea and four or more dimensions.',
      'Concept set contains minor stylistic variants.'
    ),
    result(
      'brief_fit',
      briefFit,
      'The recommended eligible concept clears the policy-owned brief-fit gate.',
      'The recommended concept does not fit the approved brief.'
    ),
    result(
      'generic_pattern_resistance',
      genericResistance,
      'The recommended concept rejects defaults and clears the generic-pattern gate.',
      'The recommended concept relies on generic design patterns.'
    ),
    result(
      'approval_and_provenance_integrity',
      integrity,
      'Approval, concept, selection, page-map, and plan provenance bindings are intact.',
      'Approval or provenance bindings are inconsistent.'
    )
  ] as const;
  return {
    format: 'universal.design-benchmark.art-direction',
    formatVersion: '1',
    passed: dimensions.every((dimension) => dimension.status === 'pass'),
    dimensions
  };
}
