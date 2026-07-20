# `@universal/prompts`

Provider-neutral, typed prompt assembly for Universal's direction, generation, critique, and scoped
revision flows. Core definitions render plain text and output expectations; provider adapters own chat
roles, message arrays, tool declarations, and response-format settings.

## Saved references and migration

Persist `{ id, version }`, never a template body or array position. IDs remain stable for a prompt's
purpose; any intentional text or contract change publishes a new semantic version and keeps the old
definition while saved data may still reference it. Add an entry to `promptDeprecations` before
removal, with a replacement and `removeAfter` package version. Consumers may call
`migratePromptReference` when loading saved references and `getPrompt` when exact replay is required.

Deprecated versions remain readable for at least one minor release. Breaking input or output changes
require a new major prompt version. Golden fixtures are reviewed like public contract changes.
