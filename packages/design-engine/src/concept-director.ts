import type { CreativeBrief } from './discovery-contracts.ts';
import { validateCreativeBrief } from './discovery-validation.ts';
import {
  CONCEPT_DIMENSIONS,
  CONCEPT_SCORE_CRITERIA,
  CONCEPT_SCORE_WEIGHTS,
  type ConceptCandidate,
  type ConceptCriterionScore,
  type ConceptDevelopmentProvider,
  type ConceptDirectionSelection,
  type ConceptDirectorOptions,
  type ConceptEvaluation,
  type ConceptScoreCriterion
} from './concept-director-contracts.ts';

const MINIMUM_CANDIDATES = 3;
const MINIMUM_DIFFERENT_DIMENSIONS = 4;
const TOKEN_SIMILARITY_THRESHOLD = 0.68;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmpty);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2)
  );
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function validateCandidate(value: unknown, index: number): ConceptCandidate {
  if (!isRecord(value)) throw new Error(`Concept candidate ${index + 1} must be an object.`);
  const stringFields = ['id', 'title', ...CONCEPT_DIMENSIONS, 'accessibilityIntent'] as const;
  for (const field of stringFields) {
    if (!nonEmpty(value[field]))
      throw new Error(`Concept candidate ${index + 1}.${field} must be a non-empty string.`);
  }
  const arrayFields = [
    'briefAlignment',
    'strengths',
    'weaknesses',
    'risks',
    'rejectedDefaults'
  ] as const;
  for (const field of arrayFields) {
    if (!stringArray(value[field]) || value[field].length === 0)
      throw new Error(`Concept candidate ${index + 1}.${field} must contain non-empty strings.`);
  }
  return {
    id: String(value.id).trim(),
    title: String(value.title).trim(),
    centralIdea: String(value.centralIdea).trim(),
    narrativeStructure: String(value.narrativeStructure).trim(),
    composition: String(value.composition).trim(),
    navigationPhilosophy: String(value.navigationPhilosophy).trim(),
    typographyIntent: String(value.typographyIntent).trim(),
    imageryIntent: String(value.imageryIntent).trim(),
    interactionPhilosophy: String(value.interactionPhilosophy).trim(),
    responsiveBehavior: String(value.responsiveBehavior).trim(),
    accessibilityIntent: String(value.accessibilityIntent).trim(),
    briefAlignment: [...(value.briefAlignment as string[])],
    strengths: [...(value.strengths as string[])],
    weaknesses: [...(value.weaknesses as string[])],
    risks: [...(value.risks as string[])],
    rejectedDefaults: [...(value.rejectedDefaults as string[])]
  };
}

export function validateConceptProviderOutput(
  output: unknown,
  expectedCount: number
): readonly ConceptCandidate[] {
  if (!isRecord(output) || !Array.isArray(output.candidates))
    throw new Error('Concept provider output must contain a candidates array.');
  if (output.candidates.length !== expectedCount)
    throw new Error(
      `Concept provider returned ${output.candidates.length} candidates; expected ${expectedCount}.`
    );
  const candidates = output.candidates.map(validateCandidate);
  const ids = new Set(candidates.map((candidate) => candidate.id));
  if (ids.size !== candidates.length) throw new Error('Concept candidate ids must be unique.');
  return candidates;
}

export function getDifferingConceptDimensions(
  left: ConceptCandidate,
  right: ConceptCandidate
): readonly (typeof CONCEPT_DIMENSIONS)[number][] {
  return CONCEPT_DIMENSIONS.filter(
    (dimension) => similarity(left[dimension], right[dimension]) < TOKEN_SIMILARITY_THRESHOLD
  );
}

export function assertMeaningfulConceptDifferentiation(
  candidates: readonly ConceptCandidate[]
): void {
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex]!;
      const right = candidates[rightIndex]!;
      const differences = getDifferingConceptDimensions(left, right);
      if (
        differences.length < MINIMUM_DIFFERENT_DIMENSIONS ||
        !differences.includes('centralIdea')
      ) {
        const reason = differences.includes('centralIdea')
          ? `only ${differences.length} direction dimensions differ`
          : 'the central idea is not meaningfully distinct';
        throw new Error(
          `Concepts ${left.id} and ${right.id} are minor stylistic variants; ` + `${reason}.`
        );
      }
    }
  }
}

function briefText(brief: CreativeBrief): string {
  const content = brief.content;
  return [
    content.purpose.summary,
    ...(content.purpose.details ?? []),
    content.audience.summary,
    ...(content.audience.details ?? []),
    content.positioning?.summary ?? '',
    content.emotionalResponse?.summary ?? '',
    content.pageContent.summary,
    ...(content.pageContent.details ?? []),
    content.hero?.summary ?? '',
    content.navigation?.summary ?? '',
    content.typography?.summary ?? '',
    content.imagery?.summary ?? '',
    ...content.constraints,
    ...content.antiPatterns,
    ...content.preferences,
    ...content.pageMap.pages.flatMap((page) => [
      page.userGoal,
      page.primaryMessage,
      ...page.requiredSections,
      ...page.requiredContent
    ])
  ].join(' ');
}

function candidateText(candidate: ConceptCandidate): string {
  return [
    candidate.title,
    ...CONCEPT_DIMENSIONS.map((dimension) => candidate[dimension]),
    candidate.accessibilityIntent,
    ...candidate.briefAlignment,
    ...candidate.strengths,
    ...candidate.weaknesses,
    ...candidate.risks
  ].join(' ');
}

function briefFitScore(brief: CreativeBrief, candidate: ConceptCandidate): number {
  const meaningfulBriefTokens = [...tokens(briefText(brief))].filter((token) => token.length > 4);
  const directionTokens = tokens(
    [
      candidate.centralIdea,
      candidate.narrativeStructure,
      candidate.composition,
      candidate.navigationPhilosophy,
      candidate.typographyIntent,
      candidate.imageryIntent
    ].join(' ')
  );
  const conceptMatches = meaningfulBriefTokens.filter((token) => directionTokens.has(token)).length;
  const supportedAlignment = candidate.briefAlignment.filter((statement) => {
    const alignmentTokens = [...tokens(statement)].filter((token) => token.length > 4);
    const matches = alignmentTokens.filter((token) => meaningfulBriefTokens.includes(token)).length;
    return matches >= Math.max(2, Math.ceil(alignmentTokens.length / 2));
  }).length;
  return clampScore(1 + Math.min(8, conceptMatches * 0.8) + Math.min(1, supportedAlignment * 0.25));
}

function distinctivenessScore(
  candidate: ConceptCandidate,
  candidates: readonly ConceptCandidate[]
): number {
  const peers = candidates.filter((peer) => peer.id !== candidate.id);
  const averageDifferences =
    peers.reduce(
      (total, peer) => total + getDifferingConceptDimensions(candidate, peer).length,
      0
    ) / Math.max(1, peers.length);
  return clampScore(2 + averageDifferences);
}

function scoreCandidate(
  brief: CreativeBrief,
  candidate: ConceptCandidate,
  candidates: readonly ConceptCandidate[]
): ConceptEvaluation {
  const text = normalizeText(candidateText(candidate));
  const genericPatterns = [
    /\bglassmorphism\b/,
    /\bgradient\b/,
    /\bbento grid\b/,
    /\bfloating cards?\b/,
    /\bneon\b/,
    /\bblob\b/,
    /\bgeneric saas\b/,
    /\bclean modern\b/,
    /\bdashboard mockup\b/
  ];
  const accessRisks = [
    /\bhover only\b/,
    /\blow contrast\b/,
    /\btiny (?:text|type)\b/,
    /\bautoplay\b/,
    /\bscroll hijack\b/,
    /\bcolor alone\b/,
    /\bhidden navigation\b/
  ];
  const accessStrengths = [
    /\bkeyboard\b/,
    /\bfocus\b/,
    /\bcontrast\b/,
    /\breduced motion\b/,
    /\bsemantic\b/,
    /\breading order\b/,
    /\btouch target\b/
  ];
  const genericCount = countMatches(text, genericPatterns);
  const accessRiskCount = countMatches(text, accessRisks);
  const accessibility =
    5.5 +
    countMatches(normalizeText(candidate.accessibilityIntent), accessStrengths) * 0.9 -
    accessRiskCount * 2.5;

  const rawScores: Record<ConceptScoreCriterion, { score: number; rationale: string }> = {
    approvedBriefFit: {
      score: briefFitScore(brief, candidate),
      rationale: 'Measured from explicit alignment evidence and overlap with approved brief intent.'
    },
    firstReadClarity: {
      score: clampScore(
        5 +
          (candidate.centralIdea.length >= 35 && candidate.centralIdea.length <= 220 ? 2 : 0) +
          (candidate.narrativeStructure.length >= 45 ? 1.5 : 0)
      ),
      rationale: 'Rewards a concrete central idea and a sufficiently articulated reading sequence.'
    },
    distinctiveness: {
      score: distinctivenessScore(candidate, candidates),
      rationale: 'Computed from structural differences across the eight concept dimensions.'
    },
    compositionalStrength: {
      score: clampScore(
        4 +
          countMatches(normalizeText(candidate.composition), [
            /\bhierarchy\b/,
            /\bgrid\b/,
            /\basymmetr/,
            /\brhythm\b/,
            /\bsequence\b/,
            /\bscale\b/,
            /\bspace\b/
          ]) *
            1.1
      ),
      rationale: 'Rewards explicit hierarchy, spatial logic, rhythm, and scale decisions.'
    },
    typographyIntent: {
      score: clampScore(
        4 +
          countMatches(normalizeText(candidate.typographyIntent), [
            /\btypeface\b/,
            /\bserif\b/,
            /\bsans\b/,
            /\bmono\b/,
            /\bscale\b/,
            /\bmeasure\b/,
            /\bweight\b/,
            /\bleading\b/
          ]) *
            0.9
      ),
      rationale: 'Rewards purposeful type roles rather than a font-style label.'
    },
    imageryIntent: {
      score: clampScore(
        4 +
          countMatches(normalizeText(candidate.imageryIntent), [
            /\bphotograph/,
            /\billustrat/,
            /\bdiagram/,
            /\btexture/,
            /\bcrop/,
            /\bsubject/,
            /\blighting\b/,
            /\bcaption/
          ]) *
            0.9
      ),
      rationale: 'Rewards defined subject matter, treatment, and editorial purpose.'
    },
    contentStorytelling: {
      score: clampScore(
        4 +
          countMatches(normalizeText(candidate.narrativeStructure), [
            /\bproblem\b/,
            /\bproof\b/,
            /\boutcome\b/,
            /\bchapter\b/,
            /\breveal\b/,
            /\bstory\b/,
            /\bquestion\b/,
            /\bsequence\b/
          ]) *
            1.05
      ),
      rationale: 'Rewards an intentional content sequence with progression and proof.'
    },
    accessibility: {
      score: clampScore(accessibility),
      rationale:
        accessRiskCount === 0
          ? 'Accessibility intent includes usable interaction and presentation safeguards.'
          : `Detected ${accessRiskCount} explicit high-risk accessibility pattern(s).`
    },
    responsiveViability: {
      score: clampScore(
        4 +
          countMatches(normalizeText(candidate.responsiveBehavior), [
            /\bmobile\b/,
            /\bstack\b/,
            /\breflow\b/,
            /\breading order\b/,
            /\btouch\b/,
            /\bviewport\b/,
            /\bcontainer\b/,
            /\bprogressive\b/
          ]) *
            0.9
      ),
      rationale: 'Rewards an explicit transformation model rather than simple down-scaling.'
    },
    genericPatternResistance: {
      score: clampScore(7 + candidate.rejectedDefaults.length * 0.6 - genericCount * 1.8),
      rationale:
        genericCount === 0
          ? 'No generic AI-design pattern was detected and defaults are explicitly rejected.'
          : `Detected ${genericCount} generic AI-design pattern(s).`
    }
  };

  const criteria = Object.fromEntries(
    CONCEPT_SCORE_CRITERIA.map((criterion) => {
      const score = rawScores[criterion].score;
      const weight = CONCEPT_SCORE_WEIGHTS[criterion];
      const result: ConceptCriterionScore = {
        score,
        weight,
        weightedScore: Math.round(score * weight * 10) / 100,
        rationale: rawScores[criterion].rationale
      };
      return [criterion, result];
    })
  ) as unknown as ConceptEvaluation['criteria'];
  const totalScore =
    Math.round(
      CONCEPT_SCORE_CRITERIA.reduce(
        (total, criterion) => total + criteria[criterion].weightedScore,
        0
      ) * 10
    ) / 10;
  const disqualifications: string[] = [];
  if (criteria.approvedBriefFit.score < 4.5)
    disqualifications.push('Insufficient alignment with the approved creative brief.');
  if (criteria.accessibility.score < 4) disqualifications.push('Unacceptable accessibility risk.');
  return {
    candidateId: candidate.id,
    criteria,
    totalScore,
    eligible: disqualifications.length === 0,
    disqualifications,
    strengths: candidate.strengths,
    weaknesses: candidate.weaknesses,
    risks: candidate.risks,
    rejectedDefaults: candidate.rejectedDefaults
  };
}

function compareEvaluations(left: ConceptEvaluation, right: ConceptEvaluation): number {
  return (
    Number(right.eligible) - Number(left.eligible) ||
    right.totalScore - left.totalScore ||
    right.criteria.approvedBriefFit.score - left.criteria.approvedBriefFit.score ||
    right.criteria.accessibility.score - left.criteria.accessibility.score ||
    left.candidateId.localeCompare(right.candidateId)
  );
}

export function selectConceptDirection(
  brief: CreativeBrief,
  candidates: readonly ConceptCandidate[]
): ConceptDirectionSelection {
  assertApprovedBrief(brief);
  if (candidates.length < MINIMUM_CANDIDATES)
    throw new Error(
      `Concept direction selection requires at least ${MINIMUM_CANDIDATES} candidates.`
    );
  assertMeaningfulConceptDifferentiation(candidates);
  const evaluations = candidates.map((candidate) => scoreCandidate(brief, candidate, candidates));
  const ranked = [...evaluations].sort(compareEvaluations);
  const winner = ranked.find((evaluation) => evaluation.eligible);
  if (!winner) throw new Error('No concept candidate satisfies brief-fit and accessibility gates.');
  const runnerUp = ranked.find(
    (evaluation) => evaluation.eligible && evaluation.candidateId !== winner.candidateId
  );
  const candidate = candidates.find((item) => item.id === winner.candidateId)!;
  const selectionRationale = runnerUp
    ? `${candidate.title} is recommended at ${winner.totalScore}/100, ` +
      `${Math.round((winner.totalScore - runnerUp.totalScore) * 10) / 10} points ahead of ` +
      `${candidates.find((item) => item.id === runnerUp.candidateId)!.title}. ` +
      `It best balances approved-brief fit, clarity, accessibility, and structural distinctiveness. ` +
      `Its leading strength is ${candidate.strengths[0]}; the principal risk to manage is ${candidate.risks[0]}.`
    : `${candidate.title} is the only eligible direction at ${winner.totalScore}/100 after ` +
      `brief-fit and accessibility gates.`;
  return {
    briefId: brief.id,
    briefVersion: brief.version,
    approvedBriefDigest: brief.approval.approvedDigest!,
    candidates,
    evaluations,
    recommendedCandidateId: winner.candidateId,
    selectionRationale
  };
}

export function assertApprovedBrief(brief: CreativeBrief): void {
  const validation = validateCreativeBrief(brief);
  if (!validation.ok)
    throw new Error(
      `Concept development requires a digest-valid creative brief: ${validation.error.path} ${validation.error.message}`
    );
  if (brief.approval.status !== 'approved' || brief.approval.approvedDigest !== brief.digest)
    throw new Error('Concept development requires a current approved creative brief.');
}

export async function developConceptDirection(
  brief: CreativeBrief,
  provider: ConceptDevelopmentProvider,
  options: ConceptDirectorOptions = {}
): Promise<ConceptDirectionSelection> {
  assertApprovedBrief(brief);
  const candidateCount = options.candidateCount ?? MINIMUM_CANDIDATES;
  if (!Number.isSafeInteger(candidateCount) || candidateCount < MINIMUM_CANDIDATES)
    throw new Error(`candidateCount must be an integer of at least ${MINIMUM_CANDIDATES}.`);
  const output = await provider.developConcepts({ brief, candidateCount });
  const candidates = validateConceptProviderOutput(output, candidateCount);
  return selectConceptDirection(brief, candidates);
}
