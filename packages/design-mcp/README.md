# @7shep/universal-mcp

An AI art director for React interfaces, exposed as a local Model Context Protocol server.

```bash
npx -y @7shep/universal-mcp
```

Requires Node 22 or newer. The server speaks MCP over stdio and reads no model credentials of its
own — generation is host-authored, meaning your MCP client's model writes the source and this server
validates, materializes, and builds it.

See [docs/MCP_RELEASE.md](../../docs/MCP_RELEASE.md) for client configuration, environment
variables, what the tarball contains, and the release and rollback process, and
[docs/MCP_REFERENCE.md](../../docs/MCP_REFERENCE.md) for every tool input and output.

This is a pre-1.0 alpha: tool names, inputs, outputs, and session shapes may change in any release.

## Art Director workflow

Phase 2 is exposed as a digest-bound, serialized session workflow:

```text
start_art_direction
  -> get_discovery_questions
  -> submit_discovery_answers
  -> get_creative_brief
  -> approve_creative_brief
  -> develop_art_direction
  -> get_selected_direction
  -> create_design_plan_v2
```

`revise_creative_brief` revises a reviewed brief and invalidates digest-bound downstream artifacts.
`get_art_direction_session` validates and inspects a serialized session.

A current `plan-created` session can continue through the credential-free MCP host-generation path:

```text
prepare_react_generation
  -> host model authors allowed source files
  -> build_react_project
  -> trusted immutable workspace and production build
  -> pnpm run dev on 127.0.0.1
```

The host model supplies source only. The runtime retains ownership of dependencies, scripts,
configuration, materialization, build supervision, and the local Vite command.

Each operation returns the complete serialized `ArtDirectorSession`; pass that
exact string to the next operation. Optional `requestId` values make mutation
retries idempotent and reject conflicting reuse. Concept Director and Plan
Compiler services are injected behind transport-neutral interfaces. The MCP
boundary does not select or configure model providers.

`create_design_plan` remains the lower-level Phase 1 compatibility API. It does
not start discovery, infer approval, or delegate to the Phase 2 workflow. Callers
that need provenance, explicit approval, concept selection, or Design Plan v2
must use the Art Director operations.

See [`docs/MCP_REFERENCE.md`](../../docs/MCP_REFERENCE.md) for every request and response shape,
phase preconditions, idempotent retry behavior, and error codes.
