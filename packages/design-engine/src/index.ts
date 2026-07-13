import type { Composition } from '@design-studio/composition-library';
import type { DesignFinding } from '@design-studio/design-linter';

export interface DesignBrief {
  prompt: string;
  audience?: string;
  constraints: readonly string[];
  references: readonly DesignReference[];
}

export interface DesignReference {
  url?: string;
  description: string;
  role: 'inspiration' | 'anti-reference';
}

export interface DesignSpecification {
  direction: string;
  composition: Composition;
  rationale: readonly string[];
}

export interface DesignDirection {
  specification: DesignSpecification;
  findings: readonly DesignFinding[];
}

export interface DesignEngine {
  develop(brief: DesignBrief): Promise<DesignDirection>;
}

/** TODO: Compose prompt, model adapter, composition selector, and linter here. */
export const createDesignEngine = (): DesignEngine => ({
  async develop(): Promise<DesignDirection> {
    throw new Error('Design Engine is not implemented yet.');
  }
});
