import type { PromptDefinition, RenderedPrompt } from './types.ts';

const PLACEHOLDER = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;

export class PromptAssemblyError extends Error {
  override readonly name = 'PromptAssemblyError';
  readonly reference: { readonly id: string; readonly version: string } | undefined;

  constructor(message: string, reference?: { readonly id: string; readonly version: string }) {
    super(message);
    this.reference = reference;
  }
}

const displayReference = (definition: Pick<PromptDefinition, 'id' | 'version'>): string =>
  `${definition.id}@${definition.version}`;

export function renderPrompt<Input extends object>(
  definition: PromptDefinition<Input>,
  values: { readonly [Key in keyof Input & string]: string }
): RenderedPrompt {
  const reference = { id: definition.id, version: definition.version };
  const missing = definition.requiredVariables.filter((key) => {
    const value = values[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new PromptAssemblyError(
      `Cannot render ${displayReference(definition)}: missing required variable(s): ${missing.join(', ')}.`,
      reference
    );
  }

  const text = definition.template.replace(PLACEHOLDER, (_placeholder, key: string) => {
    const value = values[key as keyof Input & string];
    if (typeof value !== 'string') {
      throw new PromptAssemblyError(
        `Cannot render ${displayReference(definition)}: template variable "${key}" was not supplied.`,
        reference
      );
    }
    return value;
  });

  const unresolved = [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
  if (unresolved.length > 0) {
    throw new PromptAssemblyError(
      `Cannot render ${displayReference(definition)}: unresolved placeholder(s): ${unresolved.join(', ')}. Escape or remove placeholder-like input text.`,
      reference
    );
  }

  return {
    ...reference,
    purpose: definition.purpose,
    outputExpectation: definition.outputExpectation,
    text
  };
}

/** @deprecated Prefer a typed prompt builder. Retained for MCP compatibility. */
export const interpolatePrompt = (template: string, values: Record<string, string>): string => {
  const keys = [...template.matchAll(PLACEHOLDER)]
    .map((match) => match[1])
    .filter(Boolean) as string[];
  const missing = [...new Set(keys)].filter((key) => !values[key]?.trim());
  if (missing.length > 0) {
    throw new PromptAssemblyError(
      `Cannot interpolate prompt: missing required variable(s): ${missing.join(', ')}.`
    );
  }
  const rendered = template.replace(PLACEHOLDER, (_placeholder, key: string) => values[key] ?? '');
  const unresolved = [...rendered.matchAll(PLACEHOLDER)].map((match) => match[1]);
  if (unresolved.length > 0) {
    throw new PromptAssemblyError(
      `Cannot interpolate prompt: unresolved placeholder(s): ${unresolved.join(', ')}.`
    );
  }
  return rendered;
};
