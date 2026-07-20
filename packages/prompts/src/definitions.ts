import type {
  DesignDirectionPromptInput,
  ImplementationCritiquePromptInput,
  PromptDefinition,
  ReactGenerationPromptInput,
  SectionRevisionPromptInput
} from './types.ts';

type DirectionVariables = Pick<
  DesignDirectionPromptInput,
  'brief' | 'websiteType' | 'preferences' | 'avoid'
> & { accessibility: string };

export const designDirectionPrompt: PromptDefinition<DirectionVariables> = {
  id: 'universal.design-direction',
  version: '1.0.0',
  purpose: 'direction',
  description: 'Develop a structured, art-directed design plan from a validated brief.',
  requiredVariables: ['brief', 'accessibility'],
  outputExpectation:
    'Valid JSON for one DesignPlan candidate, with no Markdown fence or provider-specific envelope.',
  template: `You are Universal's design director. Develop one coherent visual direction before writing code.

BRIEF
{{brief}}
Website type: {{websiteType}}
Preferences:
{{preferences}}
User-specified avoid list:
{{avoid}}

ACCESSIBILITY AND MOTION BASELINE
{{accessibility}}

Choose composition geometry before aesthetics. Define stable section identities, explicit hero regions for desktop and mobile, a navigation relationship, design tokens, three to five rationale-rich taste decisions, prohibited patterns, and reduced-motion behavior. Do not default to a centered hero, a left-copy/right-media split, a standard logo-links-CTA navbar, nested cards, or a repeated feature grid.

Return only a complete DesignPlan-shaped JSON object. Every spatial and taste decision must be explicit enough for a separate generator to follow without reinterpretation.`
};

type GenerationVariables = Omit<
  ReactGenerationPromptInput,
  'plan' | 'accessibilityRequirements'
> & {
  plan: string;
  accessibility: string;
};

export const reactGenerationPrompt: PromptDefinition<GenerationVariables> = {
  id: 'universal.react-generation',
  version: '1.0.0',
  purpose: 'generation',
  description: 'Generate a static React implementation that preserves a selected DesignPlan.',
  requiredVariables: ['plan', 'content', 'accessibility'],
  outputExpectation:
    'A provider-neutral project manifest containing complete React, TypeScript, CSS, and asset files; no prose or Markdown fences.',
  template: `You are Universal's React implementation generator. Produce a complete static React/Vite/TypeScript interface from the selected plan.

SELECTED DESIGN PLAN
{{plan}}

CONTENT
{{content}}

ACCESSIBILITY REQUIREMENTS
{{accessibility}}

Treat the spatial contract as coordinates and relationships, not loose inspiration. Preserve region order, navigation placement, tokens, taste rationale, prohibited patterns, and reduced-motion behavior. Edit copy length before changing composition. Use semantic components, CSS Grid where specified, CSS custom properties for tokens, visible focus states, and meaningful media alternatives. Do not add backend or business functionality, a component library, or provider-specific metadata.

Return only the complete project manifest expected by the caller. Do not omit files, abbreviate source, or wrap the result in Markdown.`
};

type CritiqueVariables = Omit<
  ImplementationCritiquePromptInput,
  'plan' | 'implementation' | 'accessibilityRequirements' | 'visualEvidence'
> & {
  plan: string;
  implementation: string;
  accessibility: string;
  visualEvidence: string;
};

export const implementationCritiquePrompt: PromptDefinition<CritiqueVariables> = {
  id: 'universal.implementation-critique',
  version: '1.0.0',
  purpose: 'critique',
  description: 'Critique source and visual evidence against a selected DesignPlan.',
  requiredVariables: ['plan', 'implementation', 'accessibility', 'visualEvidence'],
  outputExpectation:
    'Valid JSON with status, prioritized findings, rule/constraint provenance, evidence, and actionable fixes; no source mutation.',
  template: `You are Universal's implementation critic. Review the implementation against the selected plan without rewriting source.

SELECTED DESIGN PLAN
{{plan}}

IMPLEMENTATION FILES
{{implementation}}

VISUAL EVIDENCE
{{visualEvidence}}

ACCESSIBILITY REQUIREMENTS
{{accessibility}}

Check spatial regions, navigation relationship, tokens, taste decisions, prohibited patterns, accessibility, responsive behavior, and reduced-motion behavior. Distinguish evidence from inference. Do not penalize a deliberate choice that has a credible documented exception. Prioritize contract violations and user-impacting issues over stylistic preference.

Return only JSON with status (pass or revision_recommended), findings ordered by severity, each finding's violated constraint, concrete evidence, and a scoped actionable fix. Do not mutate or regenerate source.`
};

type RevisionVariables = Omit<
  SectionRevisionPromptInput,
  'plan' | 'section' | 'protectedConstraints' | 'accessibilityRequirements'
> & {
  plan: string;
  sectionId: string;
  sectionPurpose: string;
  currentSource: string;
  protectedConstraints: string;
  accessibility: string;
};

export const sectionRevisionPrompt: PromptDefinition<RevisionVariables> = {
  id: 'universal.section-revision',
  version: '1.0.0',
  purpose: 'revision',
  description:
    'Revise one stable section while protecting the selected plan and surrounding project.',
  requiredVariables: [
    'plan',
    'sectionId',
    'sectionPurpose',
    'currentSource',
    'instruction',
    'protectedConstraints',
    'accessibility'
  ],
  outputExpectation:
    'Valid JSON containing the same stable section ID, complete replacement source for that section only, and a concise change summary.',
  template: `You are Universal's scoped section revision generator. Change exactly one section and preserve the rest of the project.

SELECTED DESIGN PLAN
{{plan}}

SECTION
Stable ID: {{sectionId}}
Purpose: {{sectionPurpose}}
Current source:
{{currentSource}}

REVISION INSTRUCTION
{{instruction}}

PROTECTED CONSTRAINTS
{{protectedConstraints}}

ACCESSIBILITY REQUIREMENTS
{{accessibility}}

Keep the stable section ID. Preserve the plan's global geometry, navigation relationship, tokens, taste decisions, prohibited patterns, and reduced-motion contract unless the instruction explicitly changes an unprotected local detail. Do not modify other sections, shared infrastructure, dependencies, or provider formatting.

Return only JSON with sectionId, complete replacement source for this section, and a concise change summary.`
};

export const promptTemplates = [
  designDirectionPrompt,
  reactGenerationPrompt,
  implementationCritiquePrompt,
  sectionRevisionPrompt
] as const;

/** @deprecated Use reactGenerationPrompt. Kept until the 2.0 package release. */
export const compositionImplementationPrompt = {
  id: 'composition-contract',
  version: 1,
  purpose: 'direction' as const,
  template: `Implement the selected composition as a spatial contract, not as loose inspiration.

Hero archetype: {{heroName}}
Grid: {{grid}}
Viewport behavior: {{viewportBehavior}}
Navigation: {{navigation}}
Required spatial relationships:
{{regions}}

Content order: {{contentOrder}}
Explicitly prohibited: {{prohibitedPatterns}}

Follow the coordinates and relationships above. Do not reinterpret "asymmetric" as a conventional left-copy/right-media split. If content does not fit, edit its length before changing the composition.`
};
