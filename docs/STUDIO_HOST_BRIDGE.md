# Studio host bridge

Studio has a typed `ArtDirectorClient` and an MCP transport adapter, but a browser cannot open a
stdin/stdout pipe. The host bridge is the trusted component that can, and it is the only supported
way to run Studio against a real Art Director MCP session.

## Architecture

```text
Studio (browser, untrusted)
   │  HostArtDirectorTransport — 8 named operations, fetch, credentials: include
   ▼
Trusted local runtime (Node, loopback HTTP)
   │  POST /api/v1/art-director/<operation>
   │  ArtDirectorBridge — allowlist, validation, session ownership, timeout, retry
   ▼
Art Director MCP server (stdio child process)
```

Studio's `createMcpArtDirectorClient` is unchanged; only the transport under it is new. The bridge
runs inside the same trusted host that already owns generation, materialization, builds, and
previews, so it inherits that host's loopback binding, one-time bootstrap, `HttpOnly` session
cookie, `Host`/`Origin` checks, body-size quota, and structured `RuntimeError` responses.

## Trust boundary

Everything the browser sends is untrusted input.

| Concern                 | How the bridge holds the line                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool selection          | The URL path segment is looked up in a fixed eight-entry allowlist. A tool name from the request is never forwarded, and an unknown operation is rejected. Own-property lookup means `__proto__` and friends are not operations. |
| Argument shape          | Each operation declares its shape. Prompt, answers, page map, approver, and request id are validated; every other field is dropped rather than passed through.                                                                   |
| Session ownership       | The host holds the complete serialized session. The browser's copy is only ever compared, never trusted: a request echoing a different session is refused as `STALE_ARTIFACT` instead of silently replaying an old state.        |
| Concurrency             | Calls are serialized. The session is one mutable artifact, so overlapping mutations would race and one would be lost.                                                                                                            |
| Origin                  | The runtime's existing origin allowlist and `Host` check apply. The transport additionally refuses to be constructed against a non-loopback origin.                                                                              |
| Authentication          | The existing `HttpOnly` runtime session cookie. Unbootstrapped or unauthenticated requests are `UNAUTHORIZED_REQUEST`.                                                                                                           |
| Credentials             | The bridge reads none and forwards none. The MCP server is credential-free: generation is host-authored.                                                                                                                         |
| Commands and filesystem | The bridge exposes no path, no command, and no filesystem operation. Nothing in its eight operations takes one.                                                                                                                  |

**What this is not:** a general MCP proxy. Adding an operation is a deliberate change to the
allowlist in `packages/local-runtime/src/art-director-bridge.ts`, reviewed on its own merits.

## Failure handling

| Situation                           | Result                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| stdio session died or is unusable   | The session is closed and recreated once, then the call is retried. MCP operations are idempotent by request id, so a replay is safe. |
| Repeated transport failure          | One `INTERNAL_FAILURE` marked retryable, carrying the underlying message.                                                             |
| Session engine rejection            | Reported unchanged and never replayed — an `INVALID_SESSION` is an answer, not an outage.                                             |
| No response within the host timeout | `TIMEOUT`, retryable, and the session is discarded so nothing arrives late on a connection a later request would reuse.               |
| Caller aborted                      | `CANCELLED_OPERATION`, not retryable.                                                                                                 |
| Response missing the session        | `INTERNAL_FAILURE`, and the current session is left untouched.                                                                        |

The bridge does not assume the transport honours an abort signal; it stops waiting either way.

## The fixture client is preserved

`pnpm dev` is unchanged. Studio falls back to `createLocalArtDirectorClient()` unless the runtime
advertises a bridge at `GET /api/v1/art-director/operations`, so exploring the four-stage workflow
still needs no runtime, no stdio session, and no credentials. `apps/studio/src/studio-app.test.tsx`
continues to inject its own fake client.

## Running Studio against a real session

1. Build the MCP server:

   ```bash
   pnpm --filter @universal/design-mcp build
   ```

2. Start the trusted runtime with a bridge attached. The runtime host constructs it:

   ```ts
   import { ArtDirectorBridge, RuntimeHttpServer } from '@universal/local-runtime';

   const artDirector = new ArtDirectorBridge({ createSession: () => openStdioMcpSession() });
   const server = new RuntimeHttpServer({
     service,
     allowedOrigins: ['http://127.0.0.1:5173'],
     artDirector
   });
   ```

   `createSession` returns anything satisfying `ArtDirectorMcpSession` — one `call(tool, args,
signal)` and one `close()`. That injection point is what lets the tests run without a subprocess.

3. Start Studio and hand it the runtime origin and bootstrap token through
   `window.__UNIVERSAL_RUNTIME__`, exactly as the generation lifecycle client already expects.

4. Confirm the bridge is live:

   ```bash
   curl http://127.0.0.1:<port>/api/v1/art-director/operations
   ```

   `available: true` means Studio will use the real session; `false` means it stays on fixtures.

## Tests

`packages/local-runtime/test/art-director-bridge.test.ts` covers the happy path across the workflow,
the allowlist, dropped fields, an operation before any session, a stale session, transport failure
with a successful reconnect, persistent transport failure, a domain rejection that must not be
replayed, a response missing the session, timeout, cancellation, and serialized concurrent calls.
None of them start a subprocess.
