import {
  conceptDevelopmentPrompt,
  creativeBriefCompilationPrompt,
  designDirectionPrompt,
  directionEvaluationPrompt,
  implementationCritiquePrompt,
  initialFactExtractionPrompt,
  reactGenerationPrompt,
  sectionRevisionPrompt,
  userRequestedCopyDraftingPrompt
} from './definitions.ts';
import { PromptAssemblyError, renderPrompt } from './render.ts';
import { bullets, serializeAccessibility, serializePlan } from './serialize.ts';
import type {
  ConceptDevelopmentPromptInput,
  CreativeBriefCompilationPromptInput,
  DesignDirectionPromptInput,
  DirectionEvaluationPromptInput,
  ImplementationCritiquePromptInput,
  InitialFactExtractionPromptInput,
  ReactGenerationPromptInput,
  RenderedPrompt,
  SectionRevisionPromptInput,
  UserRequestedCopyDraftingPromptInput
} from './types.ts';

const required = (value: string, path: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new PromptAssemblyError(`Missing required prompt input at ${path}.`);
  return value.trim();
};

const requiredList = (values: readonly string[], path: string): readonly string[] => {
  if (!Array.isArray(values) || values.length === 0)
    throw new PromptAssemblyError(`Missing required prompt input at ${path}.`);
  return values.map((value, index) => required(value, `${path}[${index}]`));
};

const optionalText = (value: string | undefined, path: string, fallback: string): string => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string')
    throw new PromptAssemblyError(`Prompt input at ${path} must be a string.`);
  return value.trim() || fallback;
};

const optionalList = (values: readonly string[] | undefined, path: string): readonly string[] => {
  if (values === undefined) return [];
  if (!Array.isArray(values))
    throw new PromptAssemblyError(`Prompt input at ${path} must be an array.`);
  return values.map((value, index) => required(value, `${path}[${index}]`));
};

const optionalNonEmptyList = (
  values: readonly string[] | undefined,
  path: string
): readonly string[] | undefined => {
  if (values === undefined) return undefined;
  return requiredList(values, path);
};

const numberedBlocks = (values: readonly string[], path: string): string =>
  requiredList(values, path)
    .map((value, index) => `--- ${index + 1} ---\n${value}`)
    .join('\n\n');

export function buildInitialFactExtractionPrompt(
  input: InitialFactExtractionPromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(initialFactExtractionPrompt, {
    request: required(input.request, 'request'),
    repositoryContext: optionalText(
      input.repositoryContext,
      'repositoryContext',
      'No repository context supplied.'
    ),
    priorAnswers: bullets(
      optionalList(input.priorAnswers, 'priorAnswers'),
      '- No prior answers supplied.'
    )
  });
}

export function buildUserRequestedCopyDraftingPrompt(
  input: UserRequestedCopyDraftingPromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(userRequestedCopyDraftingPrompt, {
    request: required(input.request, 'request'),
    knownFacts: bullets(requiredList(input.knownFacts, 'knownFacts')),
    copyTargets: bullets(requiredList(input.copyTargets, 'copyTargets')),
    constraints: bullets(optionalList(input.constraints, 'constraints'))
  });
}

export function buildCreativeBriefCompilationPrompt(
  input: CreativeBriefCompilationPromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(creativeBriefCompilationPrompt, {
    initialRequest: required(input.initialRequest, 'initialRequest'),
    knownFacts: bullets(requiredList(input.knownFacts, 'knownFacts')),
    discoveryAnswers: bullets(requiredList(input.discoveryAnswers, 'discoveryAnswers')),
    draftedCopy: bullets(
      optionalList(input.draftedCopy, 'draftedCopy'),
      '- No draft copy supplied.'
    ),
    delegatedDecisions: bullets(
      optionalList(input.delegatedDecisions, 'delegatedDecisions'),
      '- No decisions explicitly delegated.'
    ),
    unresolvedQuestions: bullets(
      optionalList(input.unresolvedQuestions, 'unresolvedQuestions'),
      '- No unresolved questions recorded.'
    )
  });
}

export function buildConceptDevelopmentPrompt(
  input: ConceptDevelopmentPromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  const conceptCount = input.conceptCount ?? 3;
  if (!Number.isSafeInteger(conceptCount) || conceptCount < 2 || conceptCount > 5)
    throw new PromptAssemblyError('Prompt input conceptCount must be an integer from 2 to 5.');
  return renderPrompt(conceptDevelopmentPrompt, {
    approvedBrief: required(input.approvedBrief, 'approvedBrief'),
    conceptCount: String(conceptCount),
    protectedConstraints: bullets(requiredList(input.protectedConstraints, 'protectedConstraints'))
  });
}

const defaultEvaluationCriteria = [
  'Fit to the approved brief',
  'Clarity and hierarchy',
  'Distinctiveness and resistance to generic AI patterns',
  'Compositional, typographic, and imagery strength',
  'Accessibility and responsive viability'
] as const;

export function buildDirectionEvaluationPrompt(
  input: DirectionEvaluationPromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(directionEvaluationPrompt, {
    approvedBrief: required(input.approvedBrief, 'approvedBrief'),
    concepts: numberedBlocks(input.concepts, 'concepts'),
    evaluationCriteria: bullets(
      optionalNonEmptyList(input.evaluationCriteria, 'evaluationCriteria') ??
        defaultEvaluationCriteria
    )
  });
}
export function buildDesignDirectionPrompt(input: DesignDirectionPromptInput): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(designDirectionPrompt, {
    brief: required(input.brief, 'brief'),
    websiteType: input.websiteType?.trim() || 'Not specified.',
    preferences: bullets(input.preferences ?? []),
    avoid: bullets(input.avoid ?? []),
    accessibility: serializeAccessibility(
      input.accessibilityRequirements,
      input.reducedMotionBehavior
    )
  });
}

export function buildReactGenerationPrompt(input: ReactGenerationPromptInput): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  return renderPrompt(reactGenerationPrompt, {
    plan: serializePlan(input.plan),
    content: required(input.content, 'content'),
    accessibility: serializeAccessibility(
      input.accessibilityRequirements,
      input.plan.tasteDirection.reducedMotionBehavior
    )
  });
}

export function buildImplementationCritiquePrompt(
  input: ImplementationCritiquePromptInput
): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  if (!Array.isArray(input.implementation) || input.implementation.length === 0)
    throw new PromptAssemblyError('Missing required prompt input at implementation.');
  const implementation = input.implementation
    .map(
      (file) =>
        `--- ${required(file.path, 'implementation[].path')} ---\n${required(file.content, `implementation.${file.path}.content`)}`
    )
    .join('\n\n');
  return renderPrompt(implementationCritiquePrompt, {
    plan: serializePlan(input.plan),
    implementation,
    visualEvidence: bullets(
      input.visualEvidence ?? [],
      '- No visual evidence supplied; report visual claims as unverified.'
    ),
    accessibility: serializeAccessibility(
      input.accessibilityRequirements,
      input.plan.tasteDirection.reducedMotionBehavior
    )
  });
}

export function buildSectionRevisionPrompt(input: SectionRevisionPromptInput): RenderedPrompt {
  if (!input || typeof input !== 'object')
    throw new PromptAssemblyError('Missing required prompt input.');
  if (!input.section || typeof input.section !== 'object')
    throw new PromptAssemblyError('Missing required prompt input at section.');
  if (!Array.isArray(input.protectedConstraints) || input.protectedConstraints.length === 0)
    throw new PromptAssemblyError('Missing required prompt input at protectedConstraints.');
  return renderPrompt(sectionRevisionPrompt, {
    plan: serializePlan(input.plan),
    sectionId: required(input.section.id, 'section.id'),
    sectionPurpose: required(input.section.purpose, 'section.purpose'),
    currentSource: required(input.section.currentSource, 'section.currentSource'),
    instruction: required(input.instruction, 'instruction'),
    protectedConstraints: bullets(input.protectedConstraints),
    accessibility: serializeAccessibility(
      input.accessibilityRequirements,
      input.plan.tasteDirection.reducedMotionBehavior
    )
  });
}
