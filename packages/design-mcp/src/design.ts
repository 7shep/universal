import {
  createDesignOrchestrator,
  type CreateDesignPlanInput,
  type DesignOrchestrator,
  type DesignPlan
} from '@universal/design-engine';

export {
  DESIGN_RULE_CATEGORIES,
  getDesignRules,
  type CreateDesignPlanInput,
  type DesignPlan,
  type DesignRuleCategory,
  type DesignRules,
  type MotionDirection
} from '@universal/design-engine';
export { getActiveTasteProfile } from '@universal/design-taste';

/** Small transport-facing adapter so MCP can inject and test engine delegation. */
export interface DesignMcpAdapter {
  createDesignPlan(input: CreateDesignPlanInput): Promise<DesignPlan>;
}

export const createDesignMcpAdapter = (
  orchestrator: DesignOrchestrator = createDesignOrchestrator()
): DesignMcpAdapter => ({
  async createDesignPlan(input) {
    const { recentSignatures = [], ...brief } = input;
    const result = await orchestrator.developPlan({
      brief,
      session: { compositionHistory: recentSignatures }
    });
    return result.plan;
  }
});

const defaultAdapter = createDesignMcpAdapter();

export const createDesignPlan = (input: CreateDesignPlanInput): Promise<DesignPlan> =>
  defaultAdapter.createDesignPlan(input);
