# ADR 0002: Phase 3 runtime protocol narrowing

- Status: Accepted
- Date: 2026-07-28
- Supersedes: implementation details of ADR 0001 where noted

## Context

ADR 0001 established the local runtime trust boundary before implementation. Phase 3 proved that the minimum trusted path can be smaller than the proposed serving and event topology while preserving the security properties: exact loopback boundaries, runtime-owned state, immutable revisions, fixed builds, and isolated previews.

## Decision

Phase 3 makes four narrow protocol choices:

1. Studio and Preview remain independently served Vite applications in development. The runtime does not serve their assets. Their origins are explicitly allowlisted.
2. The one-time exchange is `POST /api/v1/bootstrap`, not `/api/v1/session/bootstrap`. It still yields an `HttpOnly`, `SameSite=Strict`, path-scoped cookie and is invalidated after one use.
3. Lifecycle catch-up uses queryable `/api/v1/state`, operation resources, and monotonic `/api/v1/events?after=` polling. WebSocket delivery is deferred; records remain authoritative, so no success state depends on an event channel.
4. The workspace root contains opaque project/revision directories directly. It is configurable and runtime-owned, but Phase 3 does not add an additional session directory or automated age-based cleanup. Immutable successful revisions are retained for last-known-good recovery; abandoned staging cleanup is explicit.

The runtime binds `127.0.0.1` only. Preview remains a separate loopback origin and receives static build artifacts only. None of these choices relax provider-secret, filesystem, process, CSP, Host, Origin, or iframe boundaries from ADR 0001.

## Consequences

The implementation is smaller, deterministic, and fully testable without a browser push channel. Studio polls while an operation is active. Runtime-hosted production UI assets, WebSockets, dual-stack `::1`, automatic retention policy, operating-system credential stores, and a live provider adapter remain Phase 4 candidates. Adding any of them requires preserving the same authoritative-record and exact-origin rules.
