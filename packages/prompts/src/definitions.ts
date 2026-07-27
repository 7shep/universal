import type {
  ConceptDevelopmentPromptInput,
  CreativeBriefCompilationPromptInput,
  DesignDirectionPromptInput,
  DirectionEvaluationPromptInput,
  ImplementationCritiquePromptInput,
  InitialFactExtractionPromptInput,
  PromptDefinition,
  ReactGenerationPromptInput,
  SectionRevisionPromptInput,
  UserRequestedCopyDraftingPromptInput
} from './types.ts';

type FactExtractionVariables = Omit<InitialFactExtractionPromptInput, 'priorAnswers'> & {
  priorAnswers: string;
};

export const initialFactExtractionPrompt: PromptDefinition<FactExtractionVariables> = {
  id: 'universal.initial-fact-extraction',
  version: '2.0.0',
  purpose: 'fact-extraction',
  description: 'Extract explicit facts and unresolved decisions before a discovery interview.',
  requiredVariables: ['request', 'repositoryContext', 'priorAnswers'],
  outputExpectation:
    'Valid JSON matching InitialFactExtractionOutput: engine-compatible interpretations and evidence-only conflicts; no questions or policy decisions.',
  template: `You are Universal's discovery fact extractor. Build an evidence ledger from the material supplied; do not conduct the interview or invent missing decisions.

INITIAL REQUEST
{{request}}

REPOSITORY CONTEXT
{{repositoryContext}}

PRIOR USER ANSWERS
{{priorAnswers}}

Separate explicit user statements, repository evidence, and supported model interpretations. Preserve exact routes, page requirements, copy, assets, references, constraints, preferences, prohibitions, and delegated decisions. Emit each supported item as an interpretation with topic, value ({ summary, optional details }), source (user, repository, or model), and verbatim or precise evidence. Identify contradictions without resolving them.

Return only an InitialFactExtractionOutput JSON object with interpretations and conflicts. Each conflict has topics, summary, and evidence. Do not generate questions, missing-information classifications, impact, ordering, blocking, or optionality; the engine derives all discovery questions and policy from the validated interpretations.`
};

type CopyDraftingVariables = Omit<
  UserRequestedCopyDraftingPromptInput,
  'knownFacts' | 'copyTargets' | 'constraints'
> & {
  knownFacts: string;
  copyTargets: string;
  constraints: string;
};

export const userRequestedCopyDraftingPrompt: PromptDefinition<CopyDraftingVariables> = {
  id: 'universal.user-requested-copy-drafting',
  version: '1.0.0',
  purpose: 'copy-drafting',
  description: 'Draft requested website copy without turning proposals into approved facts.',
  requiredVariables: ['request', 'knownFacts', 'copyTargets', 'constraints'],
  outputExpectation:
    'Valid JSON containing complete labeled copy drafts, supporting rationale, and explicit assumptions; no invented product claims.',
  template: `You are Universal's copy partner. The user explicitly asked for copy drafting. Draft only the requested targets.

USER REQUEST
{{request}}

KNOWN FACTS
{{knownFacts}}

COPY TARGETS
{{copyTargets}}

CONSTRAINTS
{{constraints}}

Ground every claim in the known facts. Match the stated audience, voice, hierarchy, calls to action, and length constraints. When a necessary detail is unknown, use a clearly labeled assumption or neutral phrasing; never fabricate proof, metrics, customers, capabilities, or legal claims. Treat every result as proposed copy awaiting user approval, not as a discovered fact.

Return only JSON with drafts, each draft's target, copy, rationale, and assumptions. Include unresolved copy decisions separately.`
};

type BriefCompilationVariables = Omit<
  CreativeBriefCompilationPromptInput,
  'knownFacts' | 'discoveryAnswers' | 'draftedCopy' | 'delegatedDecisions' | 'unresolvedQuestions'
> & {
  knownFacts: string;
  discoveryAnswers: string;
  draftedCopy: string;
  delegatedDecisions: string;
  unresolvedQuestions: string;
};

export const creativeBriefCompilationPrompt: PromptDefinition<BriefCompilationVariables> = {
  id: 'universal.creative-brief-compilation',
  version: '2.0.0',
  purpose: 'brief-compilation',
  description: 'Compile discovery evidence into a concise, provenance-rich creative brief.',
  requiredVariables: [
    'initialRequest',
    'knownFacts',
    'discoveryAnswers',
    'draftedCopy',
    'delegatedDecisions',
    'unresolvedQuestions'
  ],
  outputExpectation:
    'Valid JSON matching CreativeBriefCompilationOutput: candidate content plus engine-compatible interpretations, without engine-owned lifecycle fields.',
  template: `You are Universal's creative brief editor. Compile the evidence into a precise brief for user correction and approval.

INITIAL REQUEST
{{initialRequest}}

KNOWN FACTS
{{knownFacts}}

DISCOVERY ANSWERS
{{discoveryAnswers}}

USER-REQUESTED DRAFT COPY
{{draftedCopy}}

DELEGATED DECISIONS
{{delegatedDecisions}}

UNRESOLVED QUESTIONS
{{unresolvedQuestions}}

Distinguish user decisions, repository facts, proposed copy, Universal recommendations, delegated judgment, and assumptions. Preserve conflicts instead of silently choosing a side. Compile content aligned to the engine CreativeBriefContent contract: purpose, audience, optional positioning and emotionalResponse, pageMap, pageContent, optional hero/navigation/color/typography/brandAssets/imagery, constraints, references, antiPatterns, and preferences. Also emit the evidence behind material content as DiscoveryInterpretation-compatible objects with topic, value, source, and evidence.

Return only a CreativeBriefCompilationOutput JSON object with content and interpretations. This is a provider draft, not an engine CreativeBrief. Never emit contractVersion, id, version, timestamps, decisions, unresolved policy, revisions, digest, or approval; the engine validates interpretations and pageMap, applies policy, and owns those authoritative lifecycle fields.`
};

type ConceptDevelopmentVariables = Omit<ConceptDevelopmentPromptInput, 'protectedConstraints'> & {
  protectedConstraints: string;
  conceptCount: string;
};

export const conceptDevelopmentPrompt: PromptDefinition<ConceptDevelopmentVariables> = {
  id: 'universal.concept-development',
  version: '1.0.0',
  purpose: 'concept-development',
  description: 'Develop meaningfully distinct creative concepts from an approved brief.',
  requiredVariables: ['approvedBrief', 'conceptCount', 'protectedConstraints'],
  outputExpectation:
    'Valid JSON containing the requested number of distinct, rationale-rich creative concepts and traceability to the approved brief.',
  template: `You are Universal's art direction kernel. Silently develop {{conceptCount}} meaningfully different creative concepts from the approved brief.

APPROVED CREATIVE BRIEF
{{approvedBrief}}

PROTECTED CONSTRAINTS
{{protectedConstraints}}

Each concept needs a central idea, emotional objective, narrative, composition signature, navigation model, typography philosophy, color roles, imagery or art direction, interaction philosophy, responsive transformation, accessibility approach, rejected defaults, risks, and rationale tied to brief evidence. Vary the underlying idea and system, not merely palette, typeface, or decoration. Respect every protected constraint and do not reopen approved decisions.

Return only JSON with concepts. Keep concepts internally reviewable; do not select a winner or present them as user-approved directions.`
};

type DirectionEvaluationVariables = Omit<
  DirectionEvaluationPromptInput,
  'concepts' | 'evaluationCriteria'
> & { concepts: string; evaluationCriteria: string };

export const directionEvaluationPrompt: PromptDefinition<DirectionEvaluationVariables> = {
  id: 'universal.direction-evaluation',
  version: '1.0.0',
  purpose: 'direction-evaluation',
  description: 'Evaluate creative concepts and recommend the strongest direction.',
  requiredVariables: ['approvedBrief', 'concepts', 'evaluationCriteria'],
  outputExpectation:
    'Valid JSON containing evidence-based concept scores, risks, a recommendation, and any material unresolved dependency.',
  template: `You are Universal's design director. Evaluate the candidate concepts against the approved brief and rubric.

APPROVED CREATIVE BRIEF
{{approvedBrief}}

CANDIDATE CONCEPTS
{{concepts}}

EVALUATION CRITERIA
{{evaluationCriteria}}

Assess brief fit, first-read clarity, distinctiveness, compositional strength, typography and imagery intent, content storytelling, accessibility, responsive viability, design-system coherence, and resistance to generic AI patterns. Cite concrete evidence, expose tradeoffs, and reject concepts that depend on violating protected constraints. Recommend one direction when the evidence supports it; keep alternatives available without combining them into a compromise concept.

Return only JSON with evaluations, recommendation, rationale, risks, and unresolvedDependencies. Do not approve the direction on the user's behalf or decide that a high-impact unresolved question is optional; engine policy controls whether evaluation may proceed.`
};
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
  initialFactExtractionPrompt,
  userRequestedCopyDraftingPrompt,
  creativeBriefCompilationPrompt,
  conceptDevelopmentPrompt,
  directionEvaluationPrompt,
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
