# ADR 0004: Packaging and distribution scope for Phase 4

- Status: Accepted
- Date: 2026-07-31
- Decision owners: Universal maintainers
- Scope: How each part of the repository reaches a user's machine for the Phase 4 release gate

## Context

[ADR 0001](0001-local-runtime-architecture.md) deferred a desktop shell ("Electron or Tauri as the
first runtime boundary") because committing to one before the local runtime existed would have added
a platform constraint the repository did not yet need. The runtime, Studio, Preview, and design-mcp
server are now implemented and covered by the cross-platform CI matrix in
[RELEASE_READINESS.md](../RELEASE_READINESS.md). The roadmap's remaining Phase 4 item — "a scoped
packaging/distribution decision" — asks whether that deferral still holds now that there is a real
release gate.

Universal actually has two independently distributable surfaces, and they do not need the same
answer:

1. **The MCP server** (`packages/design-mcp`), the primary way a coding agent uses Universal today.
2. **Studio/Preview/local-runtime**, the browser UI and its privileged local process.

## Decision

Keep the two surfaces on different distribution models, and do not add desktop packaging in Phase 4.

**MCP server: publish to npm.** This is already implemented and documented in
[MCP_RELEASE.md](../MCP_RELEASE.md) — a scoped `@7shep/universal-mcp` package, a maintainer-triggered
`npm publish --tag alpha`, and a package-boundary smoke test that installs the packed tarball outside
the monorepo before any release. No change to this document is required.

**Studio/Preview/local-runtime: run from a source checkout, not a packaged artifact.** For Phase 4,
"distribution" means `git clone` plus the documented `pnpm install` and `pnpm dev` sequence in
[SETUP.md](../SETUP.md), validated by the cross-platform CI matrix. There is no installer, signed
binary, auto-update channel, or npm package for the Studio application itself. This is the same
deferral ADR 0001 made, restated as a decision rather than an open question, because the reasons have
not changed: the loopback HTTP/WebSocket protocol between Studio and the local runtime does not
require a desktop shell, and picking Electron or Tauri now would add code-signing, auto-update, and
per-OS installer surface area to a security boundary that Phase 4 is still hardening (process
supervision, workspace containment, revision retention).

## Consequences

- README's "Still in progress" row for "Packaging and one-command distribution" remains accurate
  after Phase 4 and should not be marked done; only the _decision_ about packaging is closed, not the
  work.
- A future phase that wants a double-clickable Studio app restarts from this ADR, not from ADR 0001's
  original open question. It will need its own ADR covering code-signing, auto-update, and how a
  packaged shell preserves the loopback-only, no-LAN-exposure guarantee in ADR 0001.
- The release gate in RELEASE_READINESS.md continues to validate the source-checkout path only. A
  packaged Studio build is explicitly out of scope for what a green CI matrix proves.
- Publishing the MCP server to npm does not eliminate its one remaining local-toolchain dependency:
  `build_react_project` still shells out to a global `pnpm install --offline --frozen-lockfile` (see
  `packages/local-runtime/src/process-supervisor.ts`), so an npm-only consumer's machine still needs
  pnpm resolvable on `PATH` for that one tool. This ADR is not the only place that should say so —
  the README's [System requirements](../../README.md#system-requirements) note and
  [MCP_REFERENCE.md's `build_react_project` section](../MCP_REFERENCE.md#build_react_project) call it
  out where a consumer will actually read it before running the tool.

## Alternatives considered

### Electron or Tauri desktop shell now

Rejected for Phase 4. The runtime's process-supervision and workspace-containment hardening is the
Phase 4 priority; a desktop shell adds a second, larger security surface (native IPC, auto-update,
code-signing key management) before that work is validated across all three operating systems.

### npm package for Studio/local-runtime, mirroring design-mcp

Rejected. Studio is a browser UI paired with a privileged local process, not a stdio tool; `npm
install -g` does not give a user a way to launch and keep a long-running local server plus a browser
tab in sync the way it does for a single MCP binary. This would need most of the same design a desktop
shell needs, without the benefit of a native installer.

### No decision (leave ADR 0001's deferral open)

Rejected. The roadmap explicitly calls out an unresolved packaging/distribution decision as a Phase 4
blocker; leaving it open after implementing the release gate it is supposed to complement would leave
Phase 4 permanently unfinished for a decision that costs nothing to make explicit now.
