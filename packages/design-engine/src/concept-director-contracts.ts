import type { CreativeBrief } from './discovery-contracts.ts';

export const CONCEPT_DIMENSIONS = [
  'centralIdea',
  'narrativeStructure',
  'composition',
  'navigationPhilosophy',
  'typographyIntent',
  'imageryIntent',
  'interactionPhilosophy',
  'responsiveBehavior'
] as const;

export type ConceptDimension = (typeof CONCEPT_DIMENSIONS)[number];

export const CONCEPT_SCORE_CRITERIA = [
  'approvedBriefFit',
  'firstReadClarity',
  'distinctiveness',
  'compositionalStrength',
  'typographyIntent',
  'imageryIntent',
  'contentStorytelling',
  'accessibility',
  'responsiveViability',
  'genericPatternResistance'
] as const;

export type ConceptScoreCriterion = (typeof CONCEPT_SCORE_CRITERIA)[number];

export const CONCEPT_SCORE_WEIGHTS: Readonly<Record<ConceptScoreCriterion, number>> = {
  approvedBriefFit: 18,
  firstReadClarity: 12,
  distinctiveness: 12,
  compositionalStrength: 10,
  typographyIntent: 8,
  imageryIntent: 8,
  contentStorytelling: 10,
  accessibility: 9,
  responsiveViability: 8,
  genericPatternResistance: 5
};

export interface ConceptCandidate {
  id: string;
  title: string;
  centralIdea: string;
  narrativeStructure: string;
  composition: string;
  navigationPhilosophy: string;
  typographyIntent: string;
  imageryIntent: string;
  interactionPhilosophy: string;
  responsiveBehavior: string;
  accessibilityIntent: string;
  briefAlignment: readonly string[];
  strengths: readonly string[];
  weaknesses: readonly string[];
  risks: readonly string[];
  rejectedDefaults: readonly string[];
}

/**
 * Providers are deliberately untrusted. Their response is unknown until the
 * director validates and normalizes it, and any provider-authored scores are ignored.
 */
export interface ConceptDevelopmentProvider {
  developConcepts(request: ConceptDevelopmentRequest): Promise<unknown>;
}

export interface ConceptDevelopmentRequest {
  brief: CreativeBrief;
  candidateCount: number;
}

export interface ConceptCriterionScore {
  score: number;
  weight: number;
  weightedScore: number;
  rationale: string;
}

export interface ConceptEvaluation {
  candidateId: string;
  criteria: Readonly<Record<ConceptScoreCriterion, ConceptCriterionScore>>;
  totalScore: number;
  eligible: boolean;
  disqualifications: readonly string[];
  strengths: readonly string[];
  weaknesses: readonly string[];
  risks: readonly string[];
  rejectedDefaults: readonly string[];
}

export interface ConceptDirectionSelection {
  briefId: string;
  briefVersion: number;
  approvedBriefDigest: string;
  candidates: readonly ConceptCandidate[];
  evaluations: readonly ConceptEvaluation[];
  recommendedCandidateId: string;
  selectionRationale: string;
}

export interface ConceptDirectorOptions {
  candidateCount?: number | undefined;
}
