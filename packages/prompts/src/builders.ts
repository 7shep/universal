import {
  designDirectionPrompt,
  implementationCritiquePrompt,
  reactGenerationPrompt,
  sectionRevisionPrompt
} from './definitions.ts';
import { PromptAssemblyError, renderPrompt } from './render.ts';
import { bullets, serializeAccessibility, serializePlan } from './serialize.ts';
import type {
  DesignDirectionPromptInput,
  ImplementationCritiquePromptInput,
  ReactGenerationPromptInput,
  RenderedPrompt,
  SectionRevisionPromptInput
} from './types.ts';

const required = (value: string, path: string): string => {
  if (typeof value !== 'string' || !value.trim())
    throw new PromptAssemblyError(`Missing required prompt input at ${path}.`);
  return value.trim();
};

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
