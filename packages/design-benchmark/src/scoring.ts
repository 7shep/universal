import {
  compareIdentifiers,
  roundScore,
  serializeDeterministically,
  sha256
} from './deterministic.ts';
import type {
  ArmSubmission,
  BlindAssignment,
  ScoringRubric,
  BlindAllocation,
  BlindScoringPacket,
  BlindSubmission,
  CriterionJudgment,
  CriterionScore,
  SubmissionScore,
  UnblindedSubmissionScore
} from './types.ts';

const requiresRenderedEvidence = (
  evidenceKind: 'source' | 'rendered' | 'source-and-rendered'
): boolean => evidenceKind !== 'source';

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.trim()) throw new Error(`${label} cannot contain an empty identifier.`);
    if (seen.has(value)) throw new Error(`Duplicate ${label} identifier "${value}".`);
    seen.add(value);
  }
}

function validateRubric(rubric: ScoringRubric): void {
  if (!rubric.id.trim() || !rubric.version.trim())
    throw new Error('Rubric id and version are required.');
  assertUnique(
    rubric.criteria.map((criterion) => criterion.id),
    'rubric criterion'
  );
  for (const criterion of rubric.criteria) {
    if (!Number.isFinite(criterion.maxScore) || criterion.maxScore <= 0)
      throw new Error(`Criterion "${criterion.id}" must have a positive finite maxScore.`);
    if (!Number.isFinite(criterion.weight) || criterion.weight < 0)
      throw new Error(`Criterion "${criterion.id}" must have a non-negative finite weight.`);
  }
  const sourceWeight = rubric.criteria
    .filter((criterion) => criterion.evidenceKind !== 'rendered')
    .reduce((total, criterion) => total + criterion.weight, 0);
  if (sourceWeight <= 0) throw new Error('Rubric must declare positive source weight.');
  if (
    !Number.isFinite(rubric.minimumEvaluableSourceWeight) ||
    rubric.minimumEvaluableSourceWeight < 0 ||
    rubric.minimumEvaluableSourceWeight > sourceWeight
  )
    throw new Error(
      'minimumEvaluableSourceWeight must be finite and within the declared source weight.'
    );
}

/** Build a deterministic scorer packet that contains no arm labels. */
export function createBlindScoringPacket(
  rubric: ScoringRubric,
  submissions: readonly BlindSubmission[],
  assignmentDigest: string
): BlindScoringPacket {
  validateRubric(rubric);
  if (!/^[a-f0-9]{64}$/.test(assignmentDigest))
    throw new Error('assignmentDigest must be a lowercase SHA-256 hex digest.');
  assertUnique(
    submissions.map((submission) => submission.blindId),
    'blind submission'
  );
  return {
    format: 'universal.design-benchmark.blind-scoring',
    formatVersion: '1',
    assignmentDigest,
    rubric: {
      id: rubric.id,
      version: rubric.version,
      minimumEvaluableSourceWeight: rubric.minimumEvaluableSourceWeight,
      criteria: [...rubric.criteria]
        .sort((left, right) => compareIdentifiers(left.id, right.id))
        .map((criterion) => ({
          id: criterion.id,
          label: criterion.label,
          description: criterion.description,
          maxScore: criterion.maxScore,
          weight: criterion.weight,
          evidenceKind: criterion.evidenceKind,
          scoringGuidance: [...criterion.scoringGuidance]
        }))
    },
    submissions: [...submissions]
      .sort((left, right) => compareIdentifiers(left.blindId, right.blindId))
      .map((submission): BlindSubmission => ({
        blindId: submission.blindId,
        briefId: submission.briefId,
        suiteVersion: submission.suiteVersion,
        sourceEvidence: [...submission.sourceEvidence]
          .sort((left, right) => compareIdentifiers(left.id, right.id))
          .map((evidence) => ({
            id: evidence.id,
            path: evidence.path,
            digest: evidence.digest,
            ...(evidence.startLine === undefined ? {} : { startLine: evidence.startLine }),
            ...(evidence.endLine === undefined ? {} : { endLine: evidence.endLine }),
            ...(evidence.excerpt === undefined ? {} : { excerpt: evidence.excerpt })
          })),
        renderedEvidence: [...submission.renderedEvidence]
          .sort((left, right) => compareIdentifiers(left.id, right.id))
          .map((evidence) => ({
            id: evidence.id,
            artifactPath: evidence.artifactPath,
            digest: evidence.digest,
            viewport: evidence.viewport,
            ...(evidence.capturedAt === undefined ? {} : { capturedAt: evidence.capturedAt })
          }))
      }))
  };
}

/**
 * Deterministically blind exactly one submission per arm for every brief.
 * The digest commits to the hidden allocation without exposing it to scorers.
 */
export function createSeededBlindAssignment(
  rubric: ScoringRubric,
  candidates: readonly ArmSubmission[],
  scorerSeed: string
): BlindAssignment {
  if (!scorerSeed) throw new Error('scorerSeed is required.');
  const byBrief = new Map<string, ArmSubmission[]>();
  for (const candidate of candidates) {
    const group = byBrief.get(candidate.briefId) ?? [];
    group.push(candidate);
    byBrief.set(candidate.briefId, group);
  }
  const submissions: BlindSubmission[] = [];
  const allocations: BlindAllocation[] = [];
  for (const [briefId, group] of [...byBrief].sort(([left], [right]) =>
    compareIdentifiers(left, right)
  )) {
    if (
      group.length !== 2 ||
      new Set(group.map((candidate) => candidate.arm)).size !== 2 ||
      !group.some((candidate) => candidate.arm === 'unguided') ||
      !group.some((candidate) => candidate.arm === 'universal_guided')
    )
      throw new Error(`Brief "${briefId}" must provide exactly one candidate for each arm.`);
    const ordered = [...group].sort((left, right) => compareIdentifiers(left.arm, right.arm));
    const swap = Number.parseInt(sha256(`${briefId}\u0000${scorerSeed}`).slice(-2), 16) & 1;
    const assigned = swap === 0 ? ordered : [ordered[1]!, ordered[0]!];
    assigned.forEach((candidate, index) => {
      const blindId = `${briefId}-${index === 0 ? 'candidate-a' : 'candidate-b'}`;
      submissions.push({
        blindId,
        briefId,
        suiteVersion: candidate.suiteVersion,
        sourceEvidence: candidate.sourceEvidence,
        renderedEvidence: candidate.renderedEvidence
      });
      allocations.push({ blindId, arm: candidate.arm });
    });
  }
  const canonicalAllocations = [...allocations].sort((left, right) =>
    compareIdentifiers(left.blindId, right.blindId)
  );
  const assignmentDigest = sha256(
    serializeDeterministically(
      { version: 1, scorerSeedDigest: sha256(scorerSeed), allocations: canonicalAllocations },
      0
    )
  );
  return {
    packet: createBlindScoringPacket(rubric, submissions, assignmentDigest),
    allocations: canonicalAllocations,
    assignmentDigest
  };
}
/**
 * Apply human or machine judgments without inventing visual conclusions.
 * Rendered criteria are always `not_evaluable` until rendered evidence exists.
 */
export function scoreSubmission(
  submission: BlindSubmission,
  rubric: ScoringRubric,
  judgments: readonly CriterionJudgment[]
): SubmissionScore {
  validateRubric(rubric);
  assertUnique(
    judgments.map((judgment) => judgment.criterionId),
    'criterion judgment'
  );
  const rubricIds = new Set(rubric.criteria.map((criterion) => criterion.id));
  const unknown = judgments.find((judgment) => !rubricIds.has(judgment.criterionId));
  if (unknown) throw new Error(`Judgment references unknown criterion "${unknown.criterionId}".`);

  const sourceIds = new Set(submission.sourceEvidence.map((evidence) => evidence.id));
  const renderedIds = new Set(submission.renderedEvidence.map((evidence) => evidence.id));
  const allEvidenceIds = new Set([...sourceIds, ...renderedIds]);
  assertUnique([...allEvidenceIds], 'evidence');
  const byCriterion = new Map(judgments.map((judgment) => [judgment.criterionId, judgment]));

  const criteria: CriterionScore[] = [...rubric.criteria]
    .sort((left, right) => compareIdentifiers(left.id, right.id))
    .map((criterion): CriterionScore => {
      const judgment = byCriterion.get(criterion.id);
      const renderedRequired = requiresRenderedEvidence(criterion.evidenceKind);
      if (renderedRequired && renderedIds.size === 0)
        return {
          criterionId: criterion.id,
          status: 'not_evaluable',
          score: null,
          maxScore: criterion.maxScore,
          rationale: 'Rendered evidence is required but has not been supplied.',
          evidenceIds: []
        };
      if (!judgment)
        return {
          criterionId: criterion.id,
          status: 'not_evaluable',
          score: null,
          maxScore: criterion.maxScore,
          rationale: 'No judgment was supplied.',
          evidenceIds: []
        };
      if (
        !Number.isFinite(judgment.score) ||
        judgment.score < 0 ||
        judgment.score > criterion.maxScore
      )
        throw new RangeError(
          `Score for "${criterion.id}" must be between 0 and ${criterion.maxScore}.`
        );
      if (!judgment.rationale.trim())
        throw new Error(`Judgment for "${criterion.id}" requires a rationale.`);
      assertUnique(judgment.evidenceIds, `evidence reference for "${criterion.id}"`);
      const missingEvidence = judgment.evidenceIds.find((id) => !allEvidenceIds.has(id));
      if (missingEvidence)
        throw new Error(
          `Judgment for "${criterion.id}" references unknown evidence "${missingEvidence}".`
        );
      if (
        criterion.evidenceKind === 'source' &&
        !judgment.evidenceIds.some((id) => sourceIds.has(id))
      )
        throw new Error(`Judgment for "${criterion.id}" requires source evidence.`);
      if (renderedRequired && !judgment.evidenceIds.some((id) => renderedIds.has(id)))
        throw new Error(`Judgment for "${criterion.id}" requires rendered evidence.`);
      if (
        criterion.evidenceKind === 'source-and-rendered' &&
        !judgment.evidenceIds.some((id) => sourceIds.has(id))
      )
        throw new Error(`Judgment for "${criterion.id}" also requires source evidence.`);
      return {
        criterionId: criterion.id,
        status: 'scored',
        score: roundScore(judgment.score),
        maxScore: criterion.maxScore,
        rationale: judgment.rationale.trim(),
        evidenceIds: [...judgment.evidenceIds].sort(compareIdentifiers)
      };
    });

  const scored = criteria.filter(
    (criterion): criterion is Extract<CriterionScore, { status: 'scored' }> =>
      criterion.status === 'scored'
  );
  const earnedScore = roundScore(scored.reduce((total, criterion) => total + criterion.score, 0));
  const evaluableMaxScore = roundScore(
    scored.reduce((total, criterion) => total + criterion.maxScore, 0)
  );
  const rubricMaxScore = roundScore(
    rubric.criteria.reduce((total, criterion) => total + criterion.maxScore, 0)
  );
  const rubricById = new Map(rubric.criteria.map((criterion) => [criterion.id, criterion]));
  const weightedEarned = scored.reduce((total, criterion) => {
    const weight = rubricById.get(criterion.criterionId)?.weight ?? 0;
    return total + (criterion.score / criterion.maxScore) * weight;
  }, 0);
  const evaluableWeight = scored.reduce(
    (total, criterion) => total + (rubricById.get(criterion.criterionId)?.weight ?? 0),
    0
  );
  const evaluableSourceWeight = scored
    .filter((criterion) => rubricById.get(criterion.criterionId)?.evidenceKind !== 'rendered')
    .reduce((total, criterion) => total + (rubricById.get(criterion.criterionId)?.weight ?? 0), 0);
  const rubricWeight = rubric.criteria.reduce((total, criterion) => total + criterion.weight, 0);
  const sufficientCoverage =
    evaluableSourceWeight + Number.EPSILON >= rubric.minimumEvaluableSourceWeight;
  return {
    blindId: submission.blindId,
    briefId: submission.briefId,
    suiteVersion: submission.suiteVersion,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    criteria,
    earnedScore,
    evaluableMaxScore,
    rubricMaxScore,
    normalizedScore:
      evaluableWeight === 0 || !sufficientCoverage
        ? null
        : roundScore((weightedEarned / evaluableWeight) * 100),
    evaluableFraction: rubricWeight === 0 ? 0 : roundScore(evaluableWeight / rubricWeight),
    evaluableSourceWeight: roundScore(evaluableSourceWeight),
    minimumEvaluableSourceWeight: rubric.minimumEvaluableSourceWeight
  };
}

/** Join arm allocations only after blind scoring has completed. */
export function unblindScores(
  scores: readonly SubmissionScore[],
  allocations: readonly BlindAllocation[]
): readonly UnblindedSubmissionScore[] {
  assertUnique(
    allocations.map((allocation) => allocation.blindId),
    'blind allocation'
  );
  const allocationById = new Map(
    allocations.map((allocation) => [allocation.blindId, allocation.arm])
  );
  return [...scores]
    .sort((left, right) => compareIdentifiers(left.blindId, right.blindId))
    .map((score) => {
      const arm = allocationById.get(score.blindId);
      if (!arm) throw new Error(`No blind allocation exists for "${score.blindId}".`);
      return { ...score, arm };
    });
}
