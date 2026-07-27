# `@universal/prompts`

Provider-neutral, typed prompt assembly for Universal's discovery, copy drafting, creative-brief,
concept, direction, generation, critique, and scoped revision flows. Core definitions render plain text
and output expectations; provider adapters own chat roles, message arrays, tool declarations, and
response-format settings.

Discovery prompts extract evidence; deterministic engine policy owns question generation, impact,
optionality, ordering, deferral, and brief-approval gates. `InitialFactExtractionOutput` contains
`DiscoveryInterpretationOutput` values that are structurally compatible with the engine's
`DiscoveryInterpretation` contract, plus evidence-only conflicts.

`CreativeBriefCompilationOutput` is explicitly a provider draft, not an engine `CreativeBrief`.
Use `parseCreativeBriefCompilationOutput` at the provider boundary, then let the engine validate
interpretations and the page map and create the authoritative brief. Providers never own brief IDs,
timestamps, revisions, unresolved-policy results, digests, or approval state.

## Saved references and migration

Persist `{ id, version }`, never a template body or array position. IDs remain stable for a prompt's
purpose; any intentional text or contract change publishes a new semantic version and keeps the old
definition while saved data may still reference it. Add an entry to `promptDeprecations` before
removal, with a replacement and `removeAfter` package version. Consumers may call
`migratePromptReference` when loading saved references and `getPrompt` when exact replay is required.

Deprecated versions remain readable for at least one minor release. Breaking input or output changes
require a new major prompt version. Golden fixtures are reviewed like public contract changes.
