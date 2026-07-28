import type { DesignReference } from '@universal/shared';
import type { DesignPlanBrief } from './contracts.ts';

export const DISCOVERY_CONTRACT_VERSION = '1.0.0' as const;

export const DISCOVERY_ANSWER_MODES = [
  'exact',
  'preference',
  'unknown',
  'use-judgment',
  'draft'
] as const;

export type DiscoveryAnswerMode = (typeof DISCOVERY_ANSWER_MODES)[number];
export type DiscoveryImpact = 'high' | 'medium' | 'low';
export type DiscoverySource = 'user' | 'model' | 'repository' | 'policy';

export const DISCOVERY_TOPICS = [
  'purpose',
  'audience',
  'positioning',
  'emotional-response',
  'page-map',
  'page-content',
  'hero',
  'navigation',
  'color',
  'typography',
  'brand-assets',
  'imagery',
  'constraints',
  'references',
  'anti-patterns'
] as const;

export type DiscoveryTopic = (typeof DISCOVERY_TOPICS)[number];

export interface DiscoveryValue {
  summary: string;
  details?: readonly string[] | undefined;
}

/**
 * A structured interpretation is evidence, not policy. A model may produce this
 * shape, but it cannot decide that a topic is complete or approval is allowed.
 */
export interface DiscoveryInterpretation {
  topic: DiscoveryTopic;
  value: DiscoveryValue;
  source: Exclude<DiscoverySource, 'policy'>;
  evidence: string;
}

export interface DiscoveryAnswer {
  questionId: string;
  topic: DiscoveryTopic;
  mode: DiscoveryAnswerMode;
  value?: DiscoveryValue | undefined;
  answeredAt: string;
}

export type DecisionDisposition = 'explicit' | 'preferred' | 'delegated' | 'drafted' | 'assumed';

export interface DecisionProvenance {
  id: string;
  topic: DiscoveryTopic;
  value: DiscoveryValue;
  source: DiscoverySource;
  disposition: DecisionDisposition;
  answerMode?: DiscoveryAnswerMode | undefined;
  evidence: string;
  revision: number;
  requiresConfirmation: boolean;
}

export interface PageMapEntry {
  id: string;
  route: string;
  name: string;
  userGoal: string;
  primaryMessage: string;
  requiredSections: readonly string[];
  requiredContent: readonly string[];
  primaryAction?: string | undefined;
  secondaryActions: readonly string[];
  navigationRelationship: string;
  uniqueResponsibility: string;
  sharedElements: readonly string[];
  pageSpecificElements: readonly string[];
}

export interface PageMap {
  kind: 'single-page' | 'multi-page';
  pages: readonly PageMapEntry[];
}

export interface DiscoveryQuestion {
  id: string;
  topic: DiscoveryTopic;
  group: 'strategy' | 'structure' | 'content' | 'visual-direction' | 'constraints';
  impact: DiscoveryImpact;
  prompt: string;
  rationale: string;
  order: number;
}

export type MissingInformationReason =
  | 'unanswered'
  | 'awaiting-draft'
  | 'awaiting-recommendation'
  | 'incomplete-value'
  | 'confirmation-required';

export interface MissingInformation {
  topic: DiscoveryTopic;
  impact: DiscoveryImpact;
  reason: MissingInformationReason;
  questionId?: string | undefined;
  blocksApproval: boolean;
}

export interface CreativeBriefContent {
  projectName?: string | undefined;
  purpose: DiscoveryValue;
  audience: DiscoveryValue;
  positioning?: DiscoveryValue | undefined;
  emotionalResponse?: DiscoveryValue | undefined;
  pageMap: PageMap;
  pageContent: DiscoveryValue;
  hero?: DiscoveryValue | undefined;
  navigation?: DiscoveryValue | undefined;
  color?: DiscoveryValue | undefined;
  typography?: DiscoveryValue | undefined;
  brandAssets?: DiscoveryValue | undefined;
  imagery?: DiscoveryValue | undefined;
  constraints: readonly string[];
  references: readonly DesignReference[];
  antiPatterns: readonly string[];
  preferences: readonly string[];
}

export interface BriefRevision {
  version: number;
  revisedAt: string;
  reason: string;
  changedTopics: readonly DiscoveryTopic[];
  digest: string;
}

export type ApprovalStatus =
  'discovering' | 'brief-ready' | 'approval-pending' | 'approved' | 'revision-requested';

export interface BriefApproval {
  status: ApprovalStatus;
  requestedAt?: string | undefined;
  approvedAt?: string | undefined;
  approvedBy?: string | undefined;
  approvedDigest?: string | undefined;
  revisionReason?: string | undefined;
}

export interface CreativeBrief {
  contractVersion: typeof DISCOVERY_CONTRACT_VERSION;
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  content: CreativeBriefContent;
  decisions: readonly DecisionProvenance[];
  unresolved: readonly MissingInformation[];
  revisions: readonly BriefRevision[];
  digest: string;
  approval: BriefApproval;
}

export interface DiscoverySession {
  contractVersion: typeof DISCOVERY_CONTRACT_VERSION;
  id: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  interpretations: readonly DiscoveryInterpretation[];
  answers: readonly DiscoveryAnswer[];
  decisions: readonly DecisionProvenance[];
  pageMap?: PageMap | undefined;
  approval: BriefApproval;
  brief?: CreativeBrief | undefined;
}

export interface StartDiscoveryInput {
  id: string;
  prompt: string;
  now: string;
  interpretations?: readonly DiscoveryInterpretation[] | undefined;
  pageMap?: PageMap | undefined;
}

export interface DiscoveryPolicyResult {
  missing: readonly MissingInformation[];
  questions: readonly DiscoveryQuestion[];
  canPrepareBrief: boolean;
  canRequestApproval: boolean;
  canApprove: boolean;
}

export type DecisionRevisionInput = Omit<
  DecisionProvenance,
  'id' | 'revision' | 'requiresConfirmation'
>;

export interface CreativeBriefRevisionInput {
  reason: string;
  now: string;
  interpretations?: readonly DiscoveryInterpretation[] | undefined;
  decisions?: readonly DecisionRevisionInput[] | undefined;
  pageMap?: PageMap | undefined;
}

export interface CompatibilityOptions {
  requireApproval?: boolean | undefined;
  compositionSeed?: number | undefined;
}

export type CompatibleDesignPlanBrief = DesignPlanBrief;
