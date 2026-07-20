export type PromptPurpose = 'direction' | 'generation' | 'critique' | 'revision';

export interface PromptReference {
  readonly id: string;
  readonly version: string;
}

export interface PromptDefinition<Input extends object = object> extends PromptReference {
  readonly purpose: PromptPurpose;
  readonly description: string;
  readonly requiredVariables: readonly (keyof Input & string)[];
  readonly outputExpectation: string;
  readonly template: string;
}

export interface RenderedPrompt extends PromptReference {
  readonly purpose: PromptPurpose;
  readonly outputExpectation: string;
  readonly text: string;
}

export interface SpatialRegionInput {
  readonly slot: string;
  readonly desktop: string;
  readonly mobile: string;
}

export interface NavigationInput {
  readonly id: string;
  readonly name: string;
  readonly placement: string;
  readonly relationshipToHero: string;
  readonly density: string;
  readonly desktop: string;
  readonly mobile: string;
  readonly prohibitedPatterns: readonly string[];
}

export interface DesignTokensInput {
  readonly colors: Readonly<Record<string, string>>;
  readonly typography: {
    readonly displayStyle: string;
    readonly bodyStyle: string;
    readonly displayScale: readonly string[];
  };
  readonly spacing: { readonly sectionPadding: string; readonly contentGap: string };
  readonly shape: { readonly smallRadius: string; readonly largeRadius: string };
}

export interface TasteDecisionInput {
  readonly category: string;
  readonly choice: string;
  readonly rationale: string;
  readonly source: string;
  readonly confidence: number;
}

export interface DesignPlanPromptInput {
  readonly concept: string;
  readonly artDirection: string;
  readonly brandAttributes: readonly string[];
  readonly pageStructure: readonly {
    readonly id: string;
    readonly pattern: string;
    readonly description: string;
  }[];
  readonly heroComposition: {
    readonly id: string;
    readonly name: string;
    readonly intent: string;
    readonly grid: string;
    readonly viewportBehavior: string;
    readonly contentOrder: readonly string[];
    readonly regions: readonly SpatialRegionInput[];
    readonly prohibitedPatterns: readonly string[];
  };
  readonly navigation: NavigationInput;
  readonly designTokens: DesignTokensInput;
  readonly preferredVisualTreatments: readonly string[];
  readonly tasteDirection: {
    readonly profileId: string;
    readonly profileVersion: string;
    readonly designThesis: string;
    readonly decisions: readonly TasteDecisionInput[];
    readonly typographyRationale: string;
    readonly colorRationale: string;
    readonly visualTreatmentRationale: string;
    readonly navigationRationale: string;
    readonly signatureInteraction?:
      { readonly concept: string; readonly purpose: string } | undefined;
    readonly motionRationale: string;
    readonly reducedMotionBehavior: string;
    readonly rejectedDefaultPatterns: readonly string[];
    readonly exceptions: readonly { readonly pattern: string; readonly rationale: string }[];
  };
  readonly motionDirection?:
    | {
        readonly signature: string;
        readonly technique: string;
        readonly layers: readonly string[];
        readonly behavior: readonly string[];
        readonly performance: readonly string[];
        readonly reducedMotion: string;
      }
    | undefined;
  readonly prohibitedPatterns: readonly string[];
  readonly implementationNotes: readonly string[];
}

export interface DesignDirectionPromptInput {
  readonly brief: string;
  readonly websiteType?: string | undefined;
  readonly preferences?: readonly string[] | undefined;
  readonly avoid?: readonly string[] | undefined;
  readonly accessibilityRequirements: readonly string[];
  readonly reducedMotionBehavior: string;
}

export interface ReactGenerationPromptInput {
  readonly plan: DesignPlanPromptInput;
  readonly content: string;
  readonly accessibilityRequirements: readonly string[];
}

export interface ImplementationCritiquePromptInput {
  readonly plan: DesignPlanPromptInput;
  readonly implementation: readonly { readonly path: string; readonly content: string }[];
  readonly accessibilityRequirements: readonly string[];
  readonly visualEvidence?: readonly string[] | undefined;
}

export interface SectionRevisionPromptInput {
  readonly plan: DesignPlanPromptInput;
  readonly section: {
    readonly id: string;
    readonly purpose: string;
    readonly currentSource: string;
  };
  readonly instruction: string;
  readonly protectedConstraints: readonly string[];
  readonly accessibilityRequirements: readonly string[];
}
