import { compareIdentifiers, roundScore } from './deterministic.ts';
import type {
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
  }
}

/** Build a deterministic scorer packet that contains no arm labels. */
export function createBlindScoringPacket(
  rubric: ScoringRubric,
  submissions: readonly BlindSubmission[]
): BlindScoringPacket {
  validateRubric(rubric);
  assertUnique(
    submissions.map((submission) => submission.blindId),
    'blind submission'
  );
  return {
    format: 'universal.design-benchmark.blind-scoring',
    formatVersion: '1',
    rubric: {
      ...rubric,
      criteria: [...rubric.criteria].sort((left, right) => compareIdentifiers(left.id, right.id))
    },
    submissions: [...submissions]
      .sort((left, right) => compareIdentifiers(left.blindId, right.blindId))
      .map((submission) => ({
        ...submission,
        sourceEvidence: [...submission.sourceEvidence].sort((left, right) =>
          compareIdentifiers(left.id, right.id)
        ),
        renderedEvidence: [...submission.renderedEvidence].sort((left, right) =>
          compareIdentifiers(left.id, right.id)
        )
      }))
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
      evaluableMaxScore === 0 ? null : roundScore((earnedScore / evaluableMaxScore) * 100),
    evaluableFraction: rubricMaxScore === 0 ? 0 : roundScore(evaluableMaxScore / rubricMaxScore)
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
