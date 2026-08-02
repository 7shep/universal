# Art Director Bridge: connecting Studio to the real design-mcp server

Date: 2026-08-02
Status: Approved for planning

## Problem

Studio cannot produce a real generated site. Clicking "Generate React site" fails with
`Runtime generation requires the canonical approved Design Plan v2.`

The cause is a gap between two working halves:

- `RuntimeGenerationLifecycleClient.startOnce` requires `project.enginePlan`
  (`apps/studio/src/runtime-client.ts:180`).
- Only `createMcpArtDirectorClient` sets `enginePlan` (`apps/studio/src/studio-client.ts:763`).
  The fixture `LocalArtDirectorClient` never does.
- Studio adopts the MCP client only when `hostBridgeAvailable()` returns true
  (`apps/studio/src/main.tsx:38-45`), which requires the runtime to hold an `ArtDirectorBridge`.
- `packages/local-runtime/src/cli.ts` never constructs one. `ArtDirectorBridge` is fully
  implemented and tested but has never been instantiated outside tests, and
  `@universal/local-runtime` does not depend on the MCP SDK.

A second defect compounds it: `main.tsx:39` probes the bridge before any bootstrap has run, so the
probe 401s and Studio latches to the fixture client permanently. Even a correctly wired bridge would
never be detected.

This spec covers only making real generation work. Live-updating preview, a unified Studio/Preview
surface, and chat-driven iteration are separate follow-on projects.

## Goals

- A prompt entered in Studio produces a real Design Plan v2 from the design-mcp server.
- "Generate React site" produces an actual project that Preview can display.
- A runtime whose design-mcp is unbuilt still boots, and Studio degrades to the fixture cleanly.

## Non-goals

- No live model provider. `provider-config.ts:24` stays on the deterministic generator;
  design-mcp reads no API keys.
- No changes to `ArtDirectorBridge`, `http-server.ts`, or `host-transport.ts` logic.
- No new MCP operations. The eight-operation allowlist is unchanged.
- No concurrent art-direction sessions (see Constraints).

## Approach

The runtime spawns design-mcp itself as a stdio child process, and probes at startup whether that is
possible.

Two alternatives were considered and rejected. Connecting to an externally managed server would
require adding a non-stdio transport to design-mcp, which exposes only `StdioServerTransport`
(`packages/design-mcp/src/index.ts:206`). Importing the tool handlers in-process would collapse the
trust boundary the bridge exists to enforce, and design-mcp is a separately published package.

Startup probing was chosen over always constructing the bridge, and over an opt-in env var, because
`hostBridgeAvailable()` already exists so Studio can degrade gracefully. An honest `available` signal
makes that mechanism work as designed; a file-existence check is cheap and catches the realistic
failure of a never-built `dist/`.

## Architecture

One new module, one changed file, two new dependencies.

### New: `packages/local-runtime/src/art-director-session.ts`

```
resolveArtDirectorEntry(override?: string): string | undefined
createStdioArtDirectorSessionFactory(entry: string): ArtDirectorSessionFactory
```

`resolveArtDirectorEntry` locates the design-mcp entry by resolving
`@7shep/universal-mcp/package.json` through `createRequire(import.meta.url)`, joining `dist/index.js`,
and confirming the file exists. It returns `undefined` when the package is unbuilt. The `override`
parameter exists so the negative case is testable without deleting build output. Package-relative
resolution is safe: design-mcp declares no `exports` field.

`createStdioArtDirectorSessionFactory` returns the `ArtDirectorSessionFactory` that
`ArtDirectorBridge` already expects. Each invocation spawns `node <entry>` over the MCP SDK's
`StdioClientTransport`, wraps the `Client` in the existing `ArtDirectorMcpSession` interface
(`call`, `close`), and forwards `UNIVERSAL_WORKSPACE_ROOT` and `UNIVERSAL_REPOSITORY_ROOT` so the
child writes to the same workspace as the runtime (`packages/design-mcp/src/runtime-build-mcp.ts:210-214`).

The module turns a path into a session and nothing more. Operations, allowlisting, retry, and session
ownership stay in the bridge.

### Changed: `packages/local-runtime/src/cli.ts`

```ts
const entry = resolveArtDirectorEntry();
const artDirector = entry
  ? new ArtDirectorBridge({ createSession: createStdioArtDirectorSessionFactory(entry) })
  : undefined;
const server = new RuntimeHttpServer({
  service,
  allowedOrigins: [studioOrigin, previewOrigin],
  ...(artDirector ? { artDirector } : {})
});
```

`shutdown()` also closes the bridge, and the startup JSON line gains an `artDirector` field so the
operator can see whether it is live.

### Changed: `apps/studio/src/runtime-client.ts` and `main.tsx`

Extract bootstrap from `RuntimeGenerationLifecycleClient` into a module-scoped, memoized
`ensureRuntimeSession(config)`. `main.tsx` awaits it before calling `hostBridgeAvailable`; the
generation client awaits the same promise instead of its private `bootstrapped` flag.

Memoization also fixes an observed defect. The bootstrap token is single-use
(`http-server.ts:149`), but React StrictMode double-mounts created two clients that each tried to
redeem it, producing a spurious `POST /api/v1/bootstrap 401` on a freshly started runtime. One shared
promise means exactly one redemption per page load.

### New dependencies on `@universal/local-runtime`

- `@modelcontextprotocol/sdk` at `^1.12.0`, matching design-mcp.
- `@7shep/universal-mcp` at `workspace:*`, for resolution.

### Unchanged

`ArtDirectorBridge`, `http-server.ts`, and `host-transport.ts` need no logic changes.
`process-supervisor.ts` handles one-shot build commands, not long-lived stdio children; the SDK's
transport manages the process instead.

## Data flow

```
Studio wizard step
  -> HostArtDirectorTransport.post('create-design-plan-v2', ...)   host-transport.ts:65
  -> POST /api/v1/art-director/create-design-plan-v2               http-server.ts:203
  -> ArtDirectorBridge.run(operation, body)                        allowlist + session ownership
  -> session.call('create_design_plan_v2', args)                   new module; spawns or reuses child
  -> design-mcp over stdio
  -> { session, state, data } returns up the same path
  -> validateDesignPlanV2 -> project.enginePlan set                studio-client.ts:752-763
  -> "Generate React site" -> POST /api/v1/projects/generate       runtime-client.ts:191
  -> build -> descriptor -> Preview renders
```

Only the hop into the child process is new.

## Error handling

| Failure | Behavior |
|---|---|
| design-mcp `dist/` not built | Probe returns `undefined`; no bridge; `available: false`; Studio uses the fixture as today; runtime boots normally. |
| Child spawn or transport dies | Bridge drops the session and retries once (`art-director-bridge.ts:250-256`); MCP operations are idempotent by request id. |
| Persistent child failure | `INTERNAL_FAILURE` becomes a `HostBridgeError` carrying `retryable`; Studio surfaces it and the step can be retried. |
| MCP tool rejects the call | `RuntimeFailure` passes through with its code and path intact. |
| Call exceeds 60s | Existing bridge timeout aborts the call and drops the session. |
| Runtime shutdown | `shutdown()` closes the bridge, which closes the session and exits the child. |

A build that exists at startup but is broken at spawn time still fails mid-flow rather than at boot.
Startup probing reduces the confusing case without eliminating it. A structured error at the point of
use is preferable to a lying `available: true`.

## Constraints

`ArtDirectorBridge` holds a single `current` session per runtime
(`packages/local-runtime/src/art-director-bridge.ts:158`). Starting art direction on a second project
overwrites the first, and the earlier session cannot be resumed. This is acceptable for a
single-user local tool and is recorded here so it is not rediscovered as a defect.

## Testing

### New: `packages/local-runtime/test/art-director-session.test.ts`

- `resolveArtDirectorEntry` returns a path when the entry exists and `undefined` when it does not,
  exercised through the `override` parameter.
- One real-subprocess integration test: spawn the actual design-mcp child, run
  `start_art_direction` through a real `ArtDirectorBridge`, assert a non-empty session is returned,
  then `close()` and assert the child exits. The test skips when `dist/` is unbuilt.

This integration test is the point of the suite. Every existing bridge test passes against a
`FakeSession`, which is why "never constructed in production" went unnoticed.

### Extended

- `packages/local-runtime/test/http-server.test.ts`: `available: true` with a bridge, `false`
  without; art-director routes still require a session.
- `apps/studio/src/runtime-client.test.ts`: `ensureRuntimeSession` redeems the token exactly once
  across concurrent callers and returns the same promise on repeat calls.
- Studio ordering: the capability probe runs after the session exists, asserted as a call sequence
  against a mocked fetch. Ordering is the fix, so it needs a test that fails if it is reversed.

`trust-boundary.test.ts` and `security.test.ts` must keep passing untouched. If they do not, the
allowlist boundary moved and the change should stop for review.

### Manual verification

The full path (prompt to real Design Plan v2 to generated site in Preview) requires a live runtime and
a browser, so it stays a manual step. Automated suites and real wiring have already disagreed once on
this feature; the manual run is what confirms the goal is met.

## Follow-on work

1. Live-updating preview: render pipeline phases and swap the frame from `/api/v1/events`.
2. Unified surface: embed Preview inside Studio, which requires revisiting the ADR 0001 origin
   separation.
3. Chat-driven iteration: a chat bar issuing revisions against an existing project, likely mapping to
   `revise_creative_brief` plus a new revision and rebuild.
