# Universal design MCP

## Art Director workflow

Phase 2 is exposed as a digest-bound, serialized session workflow:

`start_art_direction` ? discovery questions and answers ? creative brief review ?
explicit brief approval ? concept development ? selected direction ? Design Plan v2.

Each operation returns the complete serialized `ArtDirectorSession`; pass that
exact string to the next operation. Optional `requestId` values make mutation
retries idempotent and reject conflicting reuse. Concept Director and Plan
Compiler services are injected behind transport-neutral interfaces. The MCP
boundary does not select or configure model providers.

`create_design_plan` remains the lower-level Phase 1 compatibility API. It does
not start discovery, infer approval, or delegate to the Phase 2 workflow. Callers
that need provenance, explicit approval, concept selection, or Design Plan v2
must use the Art Director operations.
