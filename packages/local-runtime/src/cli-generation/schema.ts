/**
 * The shape the CLI must return, mirroring `RawGeneratedProject`.
 *
 * Codex enforces this natively through `--output-schema`. Claude Code has no
 * schema flag -- `--output-format json` wraps the model's text in a result
 * envelope without constraining it -- so for that adapter the schema travels in
 * the prompt and `malformed-output` is a realistic outcome.
 */
export const RAW_PROJECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      minItems: 1,
      maxItems: 64,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'content', 'kind'],
        properties: {
          path: { type: 'string', description: 'Repository-relative, always under src/.' },
          content: { type: 'string' },
          kind: { type: 'string', enum: ['react', 'typescript', 'stylesheet', 'text'] }
        }
      }
    }
  }
} as const;

export const RAW_PROJECT_SCHEMA_TEXT = JSON.stringify(RAW_PROJECT_SCHEMA, null, 2);
