# Publishing the Universal MCP server

The MCP server is published from `packages/design-mcp` as **`@7shep/universal-mcp`**. Everything
else in the monorepo is private and stays private.

## Install and connect

```bash
npm install -g @7shep/universal-mcp@alpha
# or, without installing:
npx -y @7shep/universal-mcp@alpha
```

Install the twenty workflow skills in the current project for the full experience:

```bash
npx -y @7shep/universal-mcp@alpha install-skills
```

The package exposes one binary, `universal-mcp`, which speaks MCP over stdio. Node 22 or newer is
required.

### Claude Code

```bash
claude mcp add universal -- npx -y @7shep/universal-mcp@alpha
```

### Codex, Claude Desktop, and other clients that read a config file

```json
{
  "mcpServers": {
    "universal": {
      "command": "npx",
      "args": ["-y", "@7shep/universal-mcp@alpha"]
    }
  }
}
```

Codex uses TOML; see [CODEX_MCP_SETUP.md](CODEX_MCP_SETUP.md) for that form and for verification
steps. Working from a clone instead of a release is still supported and is documented there.

### Environment

| Variable                    | Default                         | Purpose                                                  |
| --------------------------- | ------------------------------- | -------------------------------------------------------- |
| `UNIVERSAL_WORKSPACE_ROOT`  | `~/.universal/workspaces`       | Runtime-owned directory for generated project workspaces |
| `UNIVERSAL_REPOSITORY_ROOT` | the installed package directory | Checkout the runtime must refuse to materialize into     |

No model credentials are read by the server. The generation tools are host-authored: the MCP client's
own model writes the source, and the server validates, materializes, and builds it.

Rendered QA uses Playwright. It is a declared dependency, but the browser binary is not; run
`npx playwright install chromium` once if you use the rendered-review tools.

## What ships

`pnpm pack` produces a tarball containing only:

- `dist/index.js` — the bundled server, plus the deterministic provider's `.txt` sources
- `dist/skills/` — all twenty installable agent workflow skills
- `template/` — the fixed React/Vite/TypeScript project template the runtime materializes
- `server.json`, `README.md`, `LICENSE.MD`, `package.json`

Source, tests, build scripts, and `tsconfig.json` are excluded.

`scripts/bundle.mjs` bundles the private `@universal/*` packages into the entrypoint, because they
are not published. Only the declared `dependencies` stay external. The script fails the build if any
other import is left external, or if a runtime asset does not land where the bundled code will look
for it. `packages/design-mcp/test/package.test.mjs` then packs the tarball, extracts it to a
temporary directory outside the checkout, links only the declared dependencies, and starts the binary
— so "it works on my monorepo" cannot pass for "it works when installed".

Run those checks with:

```bash
pnpm --filter @7shep/universal-mcp test
```

## MCP Registry

`packages/design-mcp/server.json` is the draft entry for the official registry under the
`io.github.7shep/*` namespace, which the repository owner controls. It is checked in but not yet
submitted. Publishing to the registry additionally requires proving namespace ownership with the
registry CLI; that step is maintainer-triggered and is not automated here.

`packages/design-mcp/package.json`'s `version` is the single source of truth. The MCP handshake
version reported by `src/index.ts` is derived from it directly at build time, so it cannot drift.
`server.json`'s `version` and its npm package `version` are separate files and must be kept equal
to `package.json`'s `version` by hand; `pnpm check:mcp-version` (run in CI, and also enforced by
`scripts/bundle.mjs` on every `pack`/`publish`) fails the build if they disagree.

## Versioning

Pre-1.0, and currently on a `0.1.0-alpha.x` line. Until a stable release:

- **No API stability guarantee.** Tool names, inputs, outputs, and session shapes may change in any
  release. Sessions are digest-bound and versioned, so a session serialized by one version may be
  rejected by another.
- Breaking changes bump the pre-release segment and are described in the release notes.
- Once the tool surface stabilises, the first `1.0.0` release starts semantic-versioning guarantees
  and `alpha` is dropped.

## Releasing

Publishing is deliberately manual and maintainer-triggered. No workflow publishes on merge, and no
npm or registry credential is stored in the repository or in CI. A pull request never publishes.

1. Confirm the full gate is green on `main`.
2. Bump `version` in `packages/design-mcp/package.json` and the two `version` fields in
   `server.json`.
3. `pnpm --filter @7shep/universal-mcp test` — this packs and smoke-tests the tarball.
4. `pnpm --filter @7shep/universal-mcp pack` and inspect the tarball if the contents changed.
5. `pnpm --filter @7shep/universal-mcp publish --tag alpha` from a maintainer machine with an npm
   token that is not stored in the repository. Pre-1.0 releases must not take the `latest` tag.
6. Tag the commit `mcp-v<version>` and write release notes covering any breaking change.

### Rollback

npm unpublish is only available within 72 hours and is disruptive; prefer moving forward.

- **Bad release, good predecessor:** repoint the dist-tag —
  `npm dist-tag add @7shep/universal-mcp@<good-version> alpha`. Consumers on `npx` pick the previous
  version up immediately.
- **Then** publish a fixed version rather than leaving the tag pointing backwards.
- **Genuinely broken or accidentally published:** `npm deprecate @7shep/universal-mcp@<version>
"<reason>"` so installs warn, and unpublish only inside the 72-hour window.
- A version number is never reused.
