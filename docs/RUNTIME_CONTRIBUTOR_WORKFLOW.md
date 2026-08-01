# Generation and local-runtime contributor workflow

This is the implemented Phase 3 path: an approved Design Plan v2 becomes an allowlisted React project, an immutable local revision, a locked production build, and an isolated preview. It does not provide hosted deployment or arbitrary application generation.

## Clean checkout

Install Git, Node.js 22 or newer, and Corepack. The root `package.json` pins `packageManager: "pnpm@11.7.0"`; Corepack reads that field and dispatches the exact pnpm release. The `engines.pnpm` range is a compatibility floor, not a substitute for the pin.

```powershell
# Windows PowerShell
corepack enable
git clone https://github.com/7shep/universal.git
Set-Location universal
pnpm --version
pnpm install --frozen-lockfile
```

```sh
# macOS and Linux
corepack enable
git clone https://github.com/7shep/universal.git
cd universal
pnpm --version
pnpm install --frozen-lockfile
```

`pnpm --version` should be `11.7.0`. If Corepack cannot create its shim in a protected Node installation, run it from an elevated Windows terminal or reinstall Node for the current user. Do not work around this with a global, unpinned pnpm.

### Playwright / Chromium boundary

PR #75 pins `playwright@^1.62.0` in `@universal/local-runtime` and provides the runtime script below. Run it after the repository install to download the matching Chromium binary for the trusted capture adapter.

```sh
pnpm --filter @universal/local-runtime playwright:install
```

`PlaywrightRenderedQaCapture` is the production capture adapter: it accepts loopback preview URLs only, blocks outbound requests and service workers, emulates reduced motion, and writes revision-scoped screenshots atomically. The adapter remains injectable for tests; use the pinned Chromium path for real rendered QA.

## Run and validate

Studio uses port `5173`; Preview uses `5174`; the runtime selects an ephemeral `127.0.0.1` port and prints its origin plus a one-time bootstrap token.

```sh
pnpm --filter @universal/studio dev
pnpm --filter @universal/preview dev
pnpm --filter @universal/local-runtime start
```

Use focused checks while working:

```sh
pnpm --filter @universal/local-runtime test
pnpm --filter @7shep/universal-mcp test
pnpm --filter @universal/design-benchmark test
```

The runtime test covers materialization, supervision, recovery, HTTP, security, Chromium capture, rendered QA, acceptance/export, asset policy, and Windows containment. The MCP test builds its package first. The benchmark uses deterministic fixtures and negative mutations; it does not launch a browser.

Run the complete repository gate before a cross-workspace change:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test
```

## Trusted-runtime boundary

Generated files and browser applications are untrusted. `@universal/local-runtime` is trusted: it owns provider configuration and secrets, the fixed template and lockfile, workspace writes, install/build commands, records, and preview serving. This is a privilege boundary, not an OS or container sandbox.

Generators may submit only allowed `src/` React/TypeScript/CSS/text files and approved image assets. They cannot replace manifests, lockfiles, scripts, entrypoints, Vite/TypeScript configuration, or dependencies. The runtime validates paths and quotas, materializes outside the checkout, runs `pnpm install --offline --frozen-lockfile --ignore-scripts`, and invokes its fixed build command without a shell. Preview exposes only successful static output on a separate loopback origin in a scripts-only iframe with outbound connections blocked by CSP.

## Revisions, rendered QA, and evidence

```text
approved brief + selected direction + Design Plan v2
  -> prepare_react_generation
  -> build_react_project
  -> immutable revision + locked build + deterministic review
  -> PreviewDescriptor for the latest successful build
```

`prepare_react_generation` supplies the exact source contract. `build_react_project` validates the source again, creates `<workspace>/projects/<project>/revisions/<revision>/`, and rejects an existing revision path. A failed newer build does not replace the prior successful preview. Runtime state, diagnostics, revision records, and reviews are persisted at `<workspace>/runtime-state.json`; by default the workspace is `~/.universal/workspaces` (`%USERPROFILE%\.universal\workspaces` on Windows).

The built-in review is deterministic source/policy review and can return `pass` or `revision_recommended`; it does not inspect pixels. `runRenderedQaWithPlaywright()` builds and captures every approved route at the default 1440×1000 desktop and 390×844 mobile viewports. It records screenshot digests, route/viewport metrics, machine findings, and separate human findings in a revision-scoped evidence directory. The lifecycle may evaluate one bounded child revision, then accepts it only when it passes, reduces errors, and introduces no route-specific regression.

Acceptance and export are separate privileged actions. `RuntimeService.acceptRevision(revisionId, acceptedBy)` requires an explicitly identified acceptance and records metadata without changing the immutable revision. `RuntimeService.exportAcceptedRevision({ acceptance, destination, requestedBy })` requires a second authorization, accepts only an absolute destination under a configured runtime root, stages the copy atomically, and embeds `.universal/provenance.json` with project, revision, plan, review, acceptance, and export provenance. Generated source never selects the destination.

## Troubleshooting

| Problem                                      | Safe response                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pnpm resolves the wrong version              | Run `corepack enable`, open a new shell, then run `pnpm --version`. It must be `11.7.0`; remove competing shims from `PATH` rather than changing the lockfile.                                                                                                                                                                                               |
| Offline runtime install cannot find packages | The runtime intentionally refuses network access. First run root `pnpm install --frozen-lockfile` with normal network access to populate the pnpm store, then retry. Do not remove `--offline` or edit the template lockfile.                                                                                                                                |
| Playwright cache is inaccessible             | Run `pnpm --filter @universal/local-runtime playwright:install` from a shell that can write Playwright's browser cache. If the cache is managed or inaccessible, configure access through the environment that owns it, then rerun the same pinned-package script; do not install a different global Playwright version.                                     |
| Port 5173 or 5174 is occupied                | Windows: `Get-NetTCPConnection -LocalPort 5173,5174 -ErrorAction SilentlyContinue \| Select-Object LocalPort,OwningProcess`, then `Stop-Process -Id <pid>`. macOS/Linux: `lsof -nP -iTCP:5173 -sTCP:LISTEN`(repeat for`5174`), then `kill <pid>`.                                                                                                            |
| Installer lock is stale                      | Wait for active builds. The lock is `universal-pnpm-install.lock` in the OS temp directory and the runtime removes locks older than ten minutes. After confirming no runtime is active, remove only that file: Windows `Remove-Item (Join-Path $env:TEMP 'universal-pnpm-install.lock')`; macOS/Linux `rm -f "${TMPDIR:-/tmp}/universal-pnpm-install.lock"`. |
| Build fails                                  | Read structured install/build diagnostics in the MCP result or runtime state. Fix the allowed source and submit a new revision; never modify an immutable revision.                                                                                                                                                                                          |
| Windows leaves a child process               | The runtime uses `taskkill /T /F` while the root PID is alive; descendants orphaned before that point cannot be targeted safely. If one remains after it exits, first identify it with `Get-Process -Id <pid>`, then run `Stop-Process -Id <pid> -Force`; do not kill unrelated Node processes by name.                                                      |

See [Phase 3 runtime](PHASE3_RUNTIME.md), [MCP reference](MCP_REFERENCE.md), and [architecture](ARCHITECTURE.md) for the normative details.
