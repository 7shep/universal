import type { Composition } from '@design-studio/composition-library';

export type FindingSeverity = 'info' | 'warning' | 'error';

export interface DesignFinding {
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  recommendation: string;
}

export interface DesignRule {
  id: string;
  evaluate(input: LintInput): readonly DesignFinding[];
}

export interface LintInput {
  composition: Composition;
  source?: string;
}

/** TODO: Register structural and rendered-output rules separately. */
export const lintDesign = (
  _input: LintInput,
  rules: readonly DesignRule[] = []
): readonly DesignFinding[] => {
  // TODO: Execute rules once concrete structural and rendered-output inputs exist.
  void rules;
  return [];
};
