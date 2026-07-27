import type { CorpusBenchmarkArm } from './schema.ts';

export type BenchmarkArm = CorpusBenchmarkArm;

export type CriterionEvidenceKind = 'source' | 'rendered' | 'source-and-rendered';

export interface ScoringCriterion {
  id: string;
  label: string;
  description: string;
  maxScore: number;
  evidenceKind: CriterionEvidenceKind;
  scoringGuidance: readonly string[];
}

export interface ScoringRubric {
  id: string;
  version: string;
  criteria: readonly ScoringCriterion[];
}

export interface SourceEvidenceReference {
  id: string;
  path: string;
  digest: string;
  startLine?: number | undefined;
  endLine?: number | undefined;
  excerpt?: string | undefined;
}

export interface RenderedEvidenceArtifact {
  id: string;
  artifactPath: string;
  digest: string;
  viewport: string;
  capturedAt?: string | undefined;
}

/**
 * A scorer-facing submission intentionally excludes its experimental arm.
 * Keep arm allocation in a separate BlindAllocation record until scoring is complete.
 */
export interface BlindSubmission {
  blindId: string;
  briefId: string;
  suiteVersion: string;
  sourceEvidence: readonly SourceEvidenceReference[];
  renderedEvidence: readonly RenderedEvidenceArtifact[];
}

export interface BlindAllocation {
  blindId: string;
  arm: BenchmarkArm;
}

export interface BlindScoringPacket {
  format: 'universal.design-benchmark.blind-scoring';
  formatVersion: '1';
  rubric: ScoringRubric;
  submissions: readonly BlindSubmission[];
}

export interface CriterionJudgment {
  criterionId: string;
  score: number;
  rationale: string;
  evidenceIds: readonly string[];
}

export type CriterionScore =
  | {
      criterionId: string;
      status: 'scored';
      score: number;
      maxScore: number;
      rationale: string;
      evidenceIds: readonly string[];
    }
  | {
      criterionId: string;
      status: 'not_evaluable';
      score: null;
      maxScore: number;
      rationale: string;
      evidenceIds: readonly [];
    };

export interface SubmissionScore {
  blindId: string;
  briefId: string;
  suiteVersion: string;
  rubricId: string;
  rubricVersion: string;
  criteria: readonly CriterionScore[];
  earnedScore: number;
  evaluableMaxScore: number;
  rubricMaxScore: number;
  normalizedScore: number | null;
  evaluableFraction: number;
}

export interface UnblindedSubmissionScore extends SubmissionScore {
  arm: BenchmarkArm;
}

export type PairWinner = BenchmarkArm | 'tie' | 'not_comparable';

export interface PairedComparison {
  briefId: string;
  unguidedBlindId?: string | undefined;
  guidedBlindId?: string | undefined;
  unguidedScore: number | null;
  guidedScore: number | null;
  delta: number | null;
  winner: PairWinner;
  comparable: boolean;
  rationale?: string | undefined;
}

export interface PairedComparisonReport {
  format: 'universal.design-benchmark.paired-comparison';
  formatVersion: '1';
  suiteVersion: string;
  rubricId: string;
  rubricVersion: string;
  pairs: readonly PairedComparison[];
  summary: {
    pairCount: number;
    comparablePairCount: number;
    guidedWins: number;
    unguidedWins: number;
    ties: number;
    meanDelta: number | null;
    medianDelta: number | null;
  };
}

export interface RegressionOptions {
  /** A drop larger than this many normalized-score points is a regression. */
  regressionThreshold: number;
}

export type RegressionStatus =
  'improved' | 'unchanged' | 'regressed' | 'not_comparable' | 'added' | 'removed';

export interface RegressionEntry {
  briefId: string;
  arm: BenchmarkArm;
  baselineScore: number | null;
  currentScore: number | null;
  delta: number | null;
  status: RegressionStatus;
  rationale?: string | undefined;
}

export interface RegressionReport {
  format: 'universal.design-benchmark.regression';
  formatVersion: '1';
  baselineSuiteVersion: string;
  currentSuiteVersion: string;
  rubricId: string;
  rubricVersion: string;
  regressionThreshold: number;
  entries: readonly RegressionEntry[];
  summary: {
    comparedCount: number;
    improvedCount: number;
    unchangedCount: number;
    regressedCount: number;
    notComparableCount: number;
    addedCount: number;
    removedCount: number;
    meanDelta: number | null;
  };
}
