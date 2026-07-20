import { promptTemplates, reactGenerationPrompt } from './definitions.ts';
import { PromptAssemblyError } from './render.ts';
import type { PromptReference } from './types.ts';

export interface PromptDeprecation {
  readonly reference: PromptReference;
  readonly replacement: PromptReference;
  readonly removeAfter: string;
  readonly note: string;
}

export const promptDeprecations: readonly PromptDeprecation[] = [
  {
    reference: { id: 'composition-contract', version: '1' },
    replacement: { id: reactGenerationPrompt.id, version: reactGenerationPrompt.version },
    removeAfter: '2.0.0',
    note: 'The legacy interpolation fragment is superseded by the complete typed generation prompt.'
  }
];

const sameReference = (left: PromptReference, right: PromptReference): boolean =>
  left.id === right.id && left.version === right.version;

export type RegisteredPromptDefinition = (typeof promptTemplates)[number];

export function getPrompt(reference: PromptReference): RegisteredPromptDefinition {
  const definition = promptTemplates.find((candidate) => sameReference(candidate, reference));
  if (!definition) {
    const versions = promptTemplates
      .filter((candidate) => candidate.id === reference.id)
      .map((candidate) => candidate.version);
    const hint = versions.length
      ? ` Available version(s): ${versions.join(', ')}.`
      : ' No prompt with that stable ID is registered.';
    throw new PromptAssemblyError(
      `Unknown prompt reference ${reference.id}@${reference.version}.${hint}`,
      reference
    );
  }
  return definition;
}

export function migratePromptReference(reference: PromptReference): PromptReference {
  const deprecation = promptDeprecations.find((entry) => sameReference(entry.reference, reference));
  if (deprecation) return deprecation.replacement;
  getPrompt(reference);
  return reference;
}
