import {
  createDesignEngine,
  type CreateDesignPlanInput,
  type DesignEngine,
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
  engine: DesignEngine = createDesignEngine()
): DesignMcpAdapter => ({
  createDesignPlan: (input) => engine.develop(input)
});

const defaultAdapter = createDesignMcpAdapter();

export const createDesignPlan = (input: CreateDesignPlanInput): Promise<DesignPlan> =>
  defaultAdapter.createDesignPlan(input);
