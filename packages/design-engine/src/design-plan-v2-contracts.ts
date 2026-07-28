import type { PageMap } from './discovery-contracts.ts';

export const DESIGN_PLAN_V2_VERSION = '2.0.0' as const;
export const DIRECTION_EVALUATION_VERSION = '1.0.0' as const;

export type DecisionSourceKind =
  'user-decision' | 'supplied-evidence' | 'approved-assumption' | 'universal-recommendation';

export type HighImpactArea = 'page' | 'navigation' | 'hero' | 'brand' | 'content';

export interface PlanDecisionProvenance {
  id: string;
  sourceKind: DecisionSourceKind;
  sourceId: string;
  evidence: string;
  approved: boolean;
}

export interface TraceableDecision<Value> {
  value: Value;
  rationale: string;
  provenanceIds: readonly string[];
}

export interface CreativeDirectionV2 {
  id: string;
  label: string;
  conceptSpine: string;
  emotionalObjective: string;
  recommendation: string;
}

/**
 * Policy-owned selection record. A provider may help score directions, but only
 * this digest-bound record is accepted by the compiler.
 */
export interface SelectedDirectionEvaluation {
  contractVersion: typeof DIRECTION_EVALUATION_VERSION;
  id: string;
  status: 'selected';
  briefId: string;
  briefVersion: number;
  briefDigest: string;
  selectedDirection: CreativeDirectionV2;
  rationale: string;
  score: number;
  unresolvedDependencies: readonly string[];
  evaluatedAt: string;
  digest: string;
}

export interface PageNarrative {
  pageId: string;
  role: string;
  entryState: string;
  exitState: string;
}

export interface NavigationSignature {
  mode: string;
  hierarchy: string;
  desktopBehavior: string;
  mobileBehavior: string;
  relationshipToHero: string;
}

export interface CompositionSignatureV2 {
  layoutFamily: string;
  heroStrategy: string;
  gridStrategy: string;
  rhythm: string;
  sectionSequence: readonly string[];
}

export interface SectionIntention {
  id: string;
  pageId: string;
  requiredSection: string;
  intention: string;
  contentRequirements: readonly string[];
  rationale: string;
  provenanceIds: readonly string[];
}

export interface TypographySystem {
  display: string;
  body: string;
  roles: readonly string[];
  scaleStrategy: string;
}

export interface ColorRole {
  role: string;
  value: string;
  usage: string;
}

export interface ColorSystem {
  roles: readonly ColorRole[];
  contrastStrategy: string;
}

export interface ImageryDirection {
  subject: string;
  treatment: string;
  sourcing: string;
  accessibility: string;
}

export interface IconographyDirection {
  style: string;
  usage: string;
  accessibility: string;
}

export type ResponsiveTarget = 'navigation' | 'hero' | 'sections' | 'typography' | 'imagery';

export interface ResponsiveTransformation {
  target: ResponsiveTarget;
  desktop: string;
  mobile: string;
  preserve: string;
}

export interface MotionStrategy {
  principles: readonly string[];
  reducedMotion: string;
}

export interface ProtectedInvariant {
  id: string;
  area: HighImpactArea;
  statement: string;
  rationale: string;
  provenanceIds: readonly string[];
}

export interface PlanAssumption {
  id: string;
  statement: string;
  impact: 'low' | 'medium' | 'high';
  provenanceIds: readonly string[];
}

export interface DelegatedDecision {
  id: string;
  scope: string;
  guardrails: readonly string[];
  provenanceIds: readonly string[];
}

/** Strictly validated JSON shape requested from any compilation provider. */
export interface DesignPlanV2Draft {
  conceptSpine: TraceableDecision<string>;
  emotionalObjective: TraceableDecision<string>;
  pageNarrative: TraceableDecision<readonly PageNarrative[]>;
  navigationSignature: TraceableDecision<NavigationSignature>;
  compositionSignature: TraceableDecision<CompositionSignatureV2>;
  sectionIntentions: readonly SectionIntention[];
  typographySystem: TraceableDecision<TypographySystem>;
  colorSystem: TraceableDecision<ColorSystem>;
  imageryDirection: TraceableDecision<ImageryDirection>;
  iconographyDirection: TraceableDecision<IconographyDirection>;
  responsiveTransformations: TraceableDecision<readonly ResponsiveTransformation[]>;
  motionStrategy: TraceableDecision<MotionStrategy>;
  protectedInvariants: readonly ProtectedInvariant[];
  prohibitedPatterns: TraceableDecision<readonly string[]>;
  assumptions: readonly PlanAssumption[];
  delegatedDecisions: readonly DelegatedDecision[];
  decisionProvenance: readonly PlanDecisionProvenance[];
}

export interface DesignPlanV2Source {
  briefId: string;
  briefVersion: number;
  briefDigest: string;
  approvedDigest: string;
  evaluationId: string;
  evaluationDigest: string;
  directionId: string;
}

export interface DesignPlanV2 extends DesignPlanV2Draft {
  contractVersion: typeof DESIGN_PLAN_V2_VERSION;
  id: string;
  compiledAt: string;
  source: DesignPlanV2Source;
  pageMap: PageMap;
  digest: string;
}

export interface DesignPlanV2ValidationError {
  path: string;
  message: string;
}
