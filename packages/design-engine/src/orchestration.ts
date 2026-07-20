import {
  validateCompositionSignature,
  type CompositionSignature
} from '@universal/composition-library';
import type { Result } from '@universal/shared';
import {
  validateDesignPlan,
  validateDesignPlanBrief,
  type ContractValidationError,
  type DesignPlan,
  type DesignPlanBrief
} from './contracts.ts';
import { developDeterministicDesignPlan } from './planning.ts';

export const DESIGN_ORCHESTRATION_API_VERSION = '1.0.0';
const HISTORY_LIMIT = 12;

/** Caller-owned state passed into and returned from every plan development. */
export interface DesignPlanSession {
  compositionHistory: readonly CompositionSignature[];
}

export interface DevelopDesignPlanRequest {
  brief: DesignPlanBrief;
  session: DesignPlanSession;
}

export interface DevelopDesignPlanResult {
  plan: DesignPlan;
  session: DesignPlanSession;
}

export interface DesignPlanProviderContext {
  recentSignatures: readonly CompositionSignature[];
}

export interface DesignPlanProvider {
  develop(input: DesignPlanBrief, context: DesignPlanProviderContext): Promise<unknown> | unknown;
}

export interface DesignOrchestratorDependencies {
  provider?: DesignPlanProvider | undefined;
}

/** The one public domain API used by MCP, local runtime, Studio, and tests. */
export interface DesignOrchestrator {
  readonly version: typeof DESIGN_ORCHESTRATION_API_VERSION;
  developPlan(request: DevelopDesignPlanRequest): Promise<DevelopDesignPlanResult>;
  validatePlan(value: unknown): Result<DesignPlan, ContractValidationError>;
}

export const emptyDesignPlanSession = (): DesignPlanSession => ({ compositionHistory: [] });

export const createDeterministicDesignPlanProvider = (): DesignPlanProvider => ({
  develop(input, context): DesignPlan {
    return developDeterministicDesignPlan(input, context.recentSignatures);
  }
});

export function createDesignOrchestrator(
  dependencies: DesignOrchestratorDependencies = {}
): DesignOrchestrator {
  const provider = dependencies.provider ?? createDeterministicDesignPlanProvider();
  return {
    version: DESIGN_ORCHESTRATION_API_VERSION,
    validatePlan: validateDesignPlan,
    async developPlan(request): Promise<DevelopDesignPlanResult> {
      const brief = validateDesignPlanBrief(request.brief);
      if (!brief.ok)
        throw new Error(`Invalid design brief at ${brief.error.path}: ${brief.error.message}`);
      const history = request.session.compositionHistory.slice(-HISTORY_LIMIT);
      for (const [index, signature] of history.entries()) {
        const validation = validateCompositionSignature(
          signature,
          `session.compositionHistory.${index}`
        );
        if (!validation.ok) {
          const issue = validation.errors[0]!;
          throw new Error(`Invalid design session at ${issue.path}: ${issue.message}`);
        }
      }
      const candidate = await provider.develop(brief.value, { recentSignatures: history });
      const validation = validateDesignPlan(candidate);
      if (!validation.ok)
        throw new Error(
          `Planning provider returned an invalid design plan at ${validation.error.path}: ${validation.error.message}`
        );
      return {
        plan: validation.value,
        session: {
          compositionHistory: [...history, validation.value.compositionSignature].slice(
            -HISTORY_LIMIT
          )
        }
      };
    }
  };
}

/** Transitional factory alias; new callers should use createDesignOrchestrator. */
export type DesignEngine = DesignOrchestrator;
export const createDesignEngine = createDesignOrchestrator;
