import { compareIdentifiers, roundScore } from './deterministic.ts';
import type {
  BenchmarkArm,
  PairedComparison,
  PairedComparisonReport,
  RegressionEntry,
  RegressionOptions,
  RegressionReport,
  RegressionStatus,
  UnblindedSubmissionScore
} from './types.ts';

function assertCompatibleScores(scores: readonly UnblindedSubmissionScore[]): {
  suiteVersion: string;
  rubricId: string;
  rubricVersion: string;
} {
  const first = scores[0];
  if (!first) throw new Error('At least one score is required.');
  for (const score of scores) {
    if (score.suiteVersion !== first.suiteVersion)
      throw new Error('Cannot combine scores from different suite versions.');
    if (score.rubricId !== first.rubricId || score.rubricVersion !== first.rubricVersion)
      throw new Error('Cannot combine scores from different rubrics.');
  }
  return {
    suiteVersion: first.suiteVersion,
    rubricId: first.rubricId,
    rubricVersion: first.rubricVersion
  };
}

function mean(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : roundScore(values.reduce((total, value) => total + value, 0) / values.length);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const right = ordered[middle];
  if (right === undefined) return null;
  if (ordered.length % 2 === 1) return roundScore(right);
  const left = ordered[middle - 1];
  return left === undefined ? null : roundScore((left + right) / 2);
}

function key(briefId: string, arm: BenchmarkArm): string {
  return `${briefId}\u0000${arm}`;
}

function indexUnique(
  scores: readonly UnblindedSubmissionScore[]
): Map<string, UnblindedSubmissionScore> {
  const result = new Map<string, UnblindedSubmissionScore>();
  for (const score of scores) {
    const scoreKey = key(score.briefId, score.arm);
    if (result.has(scoreKey))
      throw new Error(`Duplicate score for brief "${score.briefId}" and arm "${score.arm}".`);
    result.set(scoreKey, score);
  }
  return result;
}

/** Compare arm scores per brief using only normalized evaluable scores. */
export function createPairedComparisonReport(
  scores: readonly UnblindedSubmissionScore[]
): PairedComparisonReport {
  const metadata = assertCompatibleScores(scores);
  const indexed = indexUnique(scores);
  const briefIds = [...new Set(scores.map((score) => score.briefId))].sort(compareIdentifiers);
  const pairs: PairedComparison[] = briefIds.map((briefId) => {
    const unguided = indexed.get(key(briefId, 'unguided'));
    const guided = indexed.get(key(briefId, 'universal_guided'));
    const unguidedScore = unguided?.normalizedScore ?? null;
    const guidedScore = guided?.normalizedScore ?? null;
    if (!unguided || !guided)
      return {
        briefId,
        unguidedBlindId: unguided?.blindId,
        guidedBlindId: guided?.blindId,
        unguidedScore,
        guidedScore,
        delta: null,
        winner: 'not_comparable',
        comparable: false,
        rationale: 'Both benchmark arms are required for a paired comparison.'
      };
    if (
      unguided.comparability !== 'comparable' ||
      guided.comparability !== 'comparable' ||
      !unguided.isolation?.comparable ||
      !guided.isolation?.comparable
    )
      return {
        briefId,
        unguidedBlindId: unguided.blindId,
        guidedBlindId: guided.blindId,
        unguidedScore: null,
        guidedScore: null,
        delta: null,
        winner: 'not_comparable',
        comparable: false,
        rationale: 'Both arms require verified execution isolation provenance.'
      };
    if (unguidedScore === null || guidedScore === null)
      return {
        briefId,
        unguidedBlindId: unguided.blindId,
        guidedBlindId: guided.blindId,
        unguidedScore,
        guidedScore,
        delta: null,
        winner: 'not_comparable',
        comparable: false,
        rationale: 'At least one arm has no evaluable criteria.'
      };
    const delta = roundScore(guidedScore - unguidedScore);
    return {
      briefId,
      unguidedBlindId: unguided.blindId,
      guidedBlindId: guided.blindId,
      unguidedScore,
      guidedScore,
      delta,
      winner: delta > 0 ? 'universal_guided' : delta < 0 ? 'unguided' : 'tie',
      comparable: true
    };
  });
  const comparable = pairs.filter(
    (pair): pair is PairedComparison & { delta: number } => pair.comparable && pair.delta !== null
  );
  const deltas = comparable.map((pair) => pair.delta);
  return {
    format: 'universal.design-benchmark.paired-comparison',
    formatVersion: '1',
    ...metadata,
    pairs,
    summary: {
      pairCount: pairs.length,
      comparablePairCount: comparable.length,
      guidedWins: comparable.filter((pair) => pair.winner === 'universal_guided').length,
      unguidedWins: comparable.filter((pair) => pair.winner === 'unguided').length,
      ties: comparable.filter((pair) => pair.winner === 'tie').length,
      meanDelta: mean(deltas),
      medianDelta: median(deltas)
    }
  };
}

function regressionStatus(delta: number, threshold: number): RegressionStatus {
  if (delta < -threshold) return 'regressed';
  if (delta > threshold) return 'improved';
  return 'unchanged';
}

/** Compare two suite runs and explicitly retain missing or unevaluable cases. */
export function createRegressionReport(
  baseline: readonly UnblindedSubmissionScore[],
  current: readonly UnblindedSubmissionScore[],
  options: RegressionOptions
): RegressionReport {
  if (!Number.isFinite(options.regressionThreshold) || options.regressionThreshold < 0)
    throw new RangeError('regressionThreshold must be a non-negative finite number.');
  const baselineMetadata = assertCompatibleScores(baseline);
  const currentMetadata = assertCompatibleScores(current);
  if (baselineMetadata.suiteVersion !== currentMetadata.suiteVersion)
    throw new Error('Regression reports require matching suite versions.');
  if (
    baselineMetadata.rubricId !== currentMetadata.rubricId ||
    baselineMetadata.rubricVersion !== currentMetadata.rubricVersion
  )
    throw new Error('Regression reports require the same rubric id and version.');
  const baselineIndex = indexUnique(baseline);
  const currentIndex = indexUnique(current);
  const keys = [...new Set([...baselineIndex.keys(), ...currentIndex.keys()])].sort(
    compareIdentifiers
  );
  const entries: RegressionEntry[] = keys.map((scoreKey) => {
    const previous = baselineIndex.get(scoreKey);
    const next = currentIndex.get(scoreKey);
    const present = next ?? previous;
    if (!present) throw new Error('Internal regression report key mismatch.');
    const base = previous?.normalizedScore ?? null;
    const now = next?.normalizedScore ?? null;
    if (!previous)
      return {
        briefId: present.briefId,
        arm: present.arm,
        baselineScore: null,
        currentScore: now,
        delta: null,
        status: 'added',
        rationale: 'No baseline score exists.'
      };
    if (!next)
      return {
        briefId: present.briefId,
        arm: present.arm,
        baselineScore: base,
        currentScore: null,
        delta: null,
        status: 'removed',
        rationale: 'No current score exists.'
      };
    if (
      previous.comparability !== 'comparable' ||
      next.comparability !== 'comparable' ||
      !previous.isolation?.comparable ||
      !next.isolation?.comparable
    )
      return {
        briefId: present.briefId,
        arm: present.arm,
        baselineScore: null,
        currentScore: null,
        delta: null,
        status: 'not_comparable',
        rationale: 'Both runs require verified execution isolation provenance.'
      };
    if (base === null || now === null)
      return {
        briefId: present.briefId,
        arm: present.arm,
        baselineScore: base,
        currentScore: now,
        delta: null,
        status: 'not_comparable',
        rationale: 'At least one run has no evaluable criteria.'
      };
    const delta = roundScore(now - base);
    return {
      briefId: present.briefId,
      arm: present.arm,
      baselineScore: base,
      currentScore: now,
      delta,
      status: regressionStatus(delta, options.regressionThreshold)
    };
  });
  const compared = entries.filter(
    (entry): entry is RegressionEntry & { delta: number } => entry.delta !== null
  );
  return {
    format: 'universal.design-benchmark.regression',
    formatVersion: '1',
    baselineSuiteVersion: baselineMetadata.suiteVersion,
    currentSuiteVersion: currentMetadata.suiteVersion,
    rubricId: currentMetadata.rubricId,
    rubricVersion: currentMetadata.rubricVersion,
    regressionThreshold: options.regressionThreshold,
    entries,
    summary: {
      comparedCount: compared.length,
      improvedCount: entries.filter((entry) => entry.status === 'improved').length,
      unchangedCount: entries.filter((entry) => entry.status === 'unchanged').length,
      regressedCount: entries.filter((entry) => entry.status === 'regressed').length,
      notComparableCount: entries.filter((entry) => entry.status === 'not_comparable').length,
      addedCount: entries.filter((entry) => entry.status === 'added').length,
      removedCount: entries.filter((entry) => entry.status === 'removed').length,
      meanDelta: mean(compared.map((entry) => entry.delta))
    }
  };
}
