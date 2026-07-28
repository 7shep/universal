# Phase 3 local runtime

Universal Phase 3 turns an explicitly approved Design Plan v2 into a generated React/Vite project, builds it in a runtime-owned workspace, and serves only the immutable production output to Preview.

## Trust boundary and ownership

The browser applications are unprivileged. Studio sends an approved, digest-bound generation request and renders authoritative runtime records. Preview accepts a project ID, queries the runtime for a `PreviewDescriptor`, verifies that the descriptor matches the project's latest successful build and revision, and loads it in an iframe with `sandbox="allow-scripts"`.

The trusted Node.js process lives in `@universal/local-runtime`. It owns provider configuration, secrets, state persistence, materialization, dependency installation, process supervision, implementation review, preview serving, and recovery. `@universal/generation` owns provider-neutral request/result contracts, validation, the generator port, and the deterministic provider. `@universal/runtime-contracts` owns JSON-safe runtime records and validators.

See [ADR 0001](adr/0001-local-runtime-architecture.md) for the trust model and [ADR 0002](adr/0002-phase3-runtime-protocol-narrowing.md) for Phase 3 protocol choices.

## Local setup

Install the repository dependencies with the root lockfile, then run the browser apps and runtime in separate terminals:

```bash
pnpm install --frozen-lockfile
pnpm --filter @universal/studio dev
pnpm --filter @universal/preview dev
pnpm --filter @universal/local-runtime start
```

The runtime binds an ephemeral port on `127.0.0.1` only. The CLI prints a one-time bootstrap token and runtime origin. Configure the Studio/Preview runtime bootstrap object through the host page as documented by their `window.__UNIVERSAL_RUNTIME__` declarations. There is no public preview URL and no hosted backend.

The standalone runtime defaults to the credential-free deterministic provider. The MCP server also supports a credential-free host-model submission adapter: Codex authors allowlisted source after `prepare_react_generation`, and `build_react_project` passes that source through the same generator validation and runtime pipeline. A live adapter is optional and must be injected by trusted runtime code. Setting `UNIVERSAL_GENERATION_PROVIDER=live` without an installed adapter fails closed. Provider API keys and model names are read only by the runtime process; Studio, Preview, generated source, lifecycle records, child processes, and preview responses never receive them. Output and errors are secret-scanned and redacted.

## Bootstrap and session model

1. The runtime creates a random one-time bootstrap token.
2. Studio sends it once to `POST /api/v1/bootstrap` with an exact allowlisted `Origin`.
3. The runtime invalidates the token and sets an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1`.
4. Every API request must use the exact runtime `Host`; mutating requests must also carry an allowlisted `Origin`.
5. Studio queries `/api/v1/state`, `/api/v1/operations/:id`, and `/api/v1/events?after=`. Runtime records, not client timers or event delivery, are authoritative.

Commands use an `Idempotency-Key`. A replay with the same canonical request returns the original operation; reuse with different input returns `IDEMPOTENCY_CONFLICT`.

## Generation and build lifecycle

The accepted path is:

```text
approved brief + selected direction + Design Plan v2
  -> ProjectGenerationRequest 1.0.0
  -> provider-neutral ReactGenerator
  -> validated GeneratedProject 1.0.0
  -> immutable materialization
  -> offline locked install
  -> production build
  -> deterministic implementation review
  -> ready PreviewDescriptor
```

Request validation binds brief ID/version/digest/approval digest, selected-direction ID/evaluation digest, plan ID/version/digest, page map, creative rationale, typography, composition, interaction, responsive, accessibility, provenance, and invariants. Stale or forged bindings fail before a provider is called.

The deterministic provider emits the checked-in luxury-keyboard fixture and remains the default for Studio development, the original golden journey, and benchmark evidence. For arbitrary MCP work, the MCP host model authors source from the exact plan-created session; the submitted source is treated as untrusted provider output and cannot bypass validation, materialization, locked installation, build supervision, or review. Neither path requires provider credentials.

## MCP-host generation and local Vite

`prepare_react_generation` and `build_react_project` join the Art Director workflow to the trusted
runtime without a provider API key. The MCP server derives a stable project binding from Design Plan
v2 and an immutable revision identity from the sorted source payload plus the caller's stable
`requestId`. It serializes builds against the shared runtime record store.

Successful builds return the immutable workspace and production output paths. The fixed template
also owns `pnpm run dev`, defined as `vite --host 127.0.0.1`; callers may run it from the returned
workspace for local inspection. The generated source never controls the command, host, dependency
set, configuration, or workspace destination. This local Vite server is a developer convenience,
not the CSP-isolated Preview security boundary.

## Proportional React architecture gate

`prepare_react_generation` returns a non-configurable `architecturePolicy` derived from Design Plan v2 page count, approved routes, required sections, and plan-declared shared elements. Multi-route work is asked to use route-specific page modules and reusable shared interface modules; substantial single-page work is asked to compose cohesive section or feature modules. Small sites may remain compact. Folder and filename preferences alone never fail a build, and tiny wrapper components do not count as meaningful extraction.

After TypeScript and Vite succeed, the trusted runtime uses the TypeScript compiler API to analyze component declarations, imports and JSX usage, route-to-page mappings, App composition, props typing, shared regions, duplicated JSX subtrees, inline collections, module responsibilities, and stylesheet distribution. Blocking checks reject App-only nontrivial implementations, missing multi-route page modules or route mappings, duplicated plan-declared shared regions, multiple full pages inside App, untyped configurable exported/reused components, and substantial copy-pasted JSX. Advisory checks report large inline content collections, weak stylesheet separation, overloaded modules, and borderline App complexity.

Architecture checks emit stable `ARCH_*` IDs, severity, actionable messages, and JSON-safe evidence in the implementation review. Errors produce review-stage build diagnostics and prevent a new preview from becoming ready. Warnings remain visible without failing an otherwise valid build. Generated source and MCP callers cannot configure or disable the policy. A successful build therefore covers compilation, runtime trust constraints, and a minimum maintainable repository architecture; it is still not a substitute for human code review or rendered visual judgment.

## Workspace and dependency policy

The CLI workspace defaults to `~/.universal/workspaces`; tests use temporary directories. Revisions are stored under:

```text
<workspace>/projects/<opaque-project-id>/revisions/<opaque-revision-id>/
```

Revision directories are immutable. Materialization rejects absolute, drive-qualified, UNC, traversal, ambiguous, colliding, and link-escaping paths. Writes use a staging directory, exclusive temporary files, file synchronization, and atomic rename. Abandoned staging directories can be removed with `cleanAbandonedStaging`; ready revisions are retained because they may be the last known good preview. Automated age-based retention is deferred to Phase 4.

Providers may write only allowlisted React, TypeScript, CSS, text, and approved image assets. They cannot replace `package.json`, lockfiles, Vite/TypeScript config, `index.html`, runtime entrypoints, scripts, or preview policy. File-count, per-file, asset-count, and total-byte quotas are enforced twice: at provider validation and materialization.

The fixed template pins React, Vite, TypeScript, and the React plugin. Installation is `pnpm install --offline --frozen-lockfile --ignore-scripts`; the build invokes the runtime-owned Vite script without a shell. Arbitrary packages, provider scripts, provider configuration, and arbitrary commands are unsupported.

## Process supervision and recovery

Install/build processes receive a minimal environment without provider credentials. Output is bounded and redacted. Cancellation, timeout, and shutdown abort the operation, terminate the process tree, and wait for settlement. On restart, active operations/builds are marked `interrupted`; persisted data is validated before use. Ready build outputs are reattached when present.

A failed or cancelled newer revision never replaces `latestSuccessfulBuildId`. Studio shows the newer diagnostic while Preview keeps serving the prior immutable artifact.

Common stable codes include `INVALID_REQUEST`, `STALE_ARTIFACT`, `IDEMPOTENCY_CONFLICT`, `QUOTA_EXCEEDED`, `GENERATION_FAILURE`, `MATERIALIZATION_FAILURE`, `INSTALL_FAILURE`, `BUILD_FAILURE`, `PREVIEW_UNAVAILABLE`, `CANCELLED_OPERATION`, `INTERRUPTED_OPERATION`, `INVALID_ORIGIN`, and `UNAUTHORIZED_REQUEST`. Retry only errors marked `retryable`; changing approved creative bindings requires a new project or explicit future migration workflow.

## Preview isolation

Each ready build is served from a distinct ephemeral loopback origin. The server exposes static `dist` files only, applies `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and a CSP whose `connect-src` is `'none'`. It has no runtime API. Preview never accepts an arbitrary URL and does not reveal a descriptor before the build is ready. Client-side routes fall back to `index.html`; traversal remains rejected.

This is strong browser-origin and process-supervision isolation, not an OS/container sandbox. Generated JavaScript still executes in a browser sandboxed iframe. Stronger filesystem/process containment and cross-platform junction coverage remain future hardening.

## Verification

Run focused checks:

```bash
pnpm --filter @universal/generation test
pnpm --filter @universal/runtime-contracts test
pnpm --filter @universal/local-runtime test
pnpm --filter @universal/studio test
pnpm --filter @universal/preview test
```

Run the deterministic full journey:

```bash
pnpm --filter @universal/design-mcp test
```

Run the rendered benchmark, including a negative mutation for every Phase 3 dimension:

```bash
pnpm --filter @universal/design-benchmark test
```

The benchmark stores digest-bound desktop/mobile representation evidence. Machine checks cover contracts, builds, page coverage, structural typography, responsive fit, accessibility essentials, reduced motion, prohibited patterns, isolation, and last-known-good behavior. Selected-direction fidelity and composition quality remain explicitly named human-review evidence; DOM strings are not presented as proof of subjective visual quality.

Optional credential-gated provider testing is adapter-specific and is not part of the offline green gate. The repository does not claim a production live-provider adapter, hosted sandbox, public URL, Linux/macOS end-to-end matrix, or deployment workflow in Phase 3.
