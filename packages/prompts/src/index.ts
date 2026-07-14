export interface PromptTemplate {
  id: string;
  version: number;
  purpose: 'direction' | 'critique' | 'revision';
  template: string;
}

/** TODO: Add validated templates and a prompt version migration policy. */
export const compositionImplementationPrompt: PromptTemplate = {
  id: 'composition-contract',
  version: 1,
  purpose: 'direction',
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

export const promptTemplates: readonly PromptTemplate[] = [compositionImplementationPrompt];

export const interpolatePrompt = (template: string, values: Record<string, string>): string =>
  template.replace(/{{(.*?)}}/g, (_, key: string) => values[key.trim()] ?? `{{${key}}}`);
