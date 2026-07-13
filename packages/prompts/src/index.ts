export interface PromptTemplate {
  id: string;
  version: number;
  purpose: 'direction' | 'critique' | 'revision';
  template: string;
}

/** TODO: Add validated templates and a prompt version migration policy. */
export const promptTemplates: readonly PromptTemplate[] = [];

export const interpolatePrompt = (template: string, values: Record<string, string>): string =>
  template.replace(/{{(.*?)}}/g, (_, key: string) => values[key.trim()] ?? `{{${key}}}`);
