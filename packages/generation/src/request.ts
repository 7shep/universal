import type { DesignPlanV2 } from '@universal/design-engine';
import {
  GENERATION_CONTRACT_VERSION,
  type GenerationContext,
  type ProjectGenerationRequest
} from './contracts.ts';
export function createGenerationContext(plan: DesignPlanV2): GenerationContext {
  return {
    pageMap: plan.pageMap,
    pageNarratives: plan.pageNarrative.value,
    typography: plan.typographySystem.value,
    colors: plan.colorSystem.value,
    composition: plan.compositionSignature.value,
    navigation: plan.navigationSignature.value,
    responsiveTransformations: plan.responsiveTransformations.value,
    motion: plan.motionStrategy.value,
    prohibitedPatterns: plan.prohibitedPatterns.value,
    decisionProvenanceIds: plan.decisionProvenance.map((item) => item.id),
    protectedInvariants: plan.protectedInvariants.map((item) => item.statement),
    implementationConstraints: [
      'React 19, Vite, and TypeScript only',
      'Static presentational behavior only',
      'Semantic HTML and keyboard-accessible controls',
      'Visible focus states and WCAG 2.2 AA contrast',
      'Responsive layouts for every approved page',
      'Honor prefers-reduced-motion',
      'No outbound network access',
      'No provider-authored dependencies, scripts, or configuration'
    ]
  };
}
export function createProjectGenerationRequest(input: {
  projectId: string;
  revisionId: string;
  designPlan: DesignPlanV2;
}): ProjectGenerationRequest {
  const plan = input.designPlan;
  return {
    contractVersion: GENERATION_CONTRACT_VERSION,
    projectId: input.projectId,
    revisionId: input.revisionId,
    brief: {
      id: plan.source.briefId,
      version: plan.source.briefVersion,
      digest: plan.source.briefDigest,
      approvalDigest: plan.source.approvedDigest
    },
    direction: { id: plan.source.directionId, digest: plan.source.evaluationDigest },
    plan: { id: plan.id, digest: plan.digest, contractVersion: plan.contractVersion },
    designPlan: plan,
    context: createGenerationContext(plan)
  };
}
