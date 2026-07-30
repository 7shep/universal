# Cross-platform release readiness

This repository has one GitHub Actions workflow with three credential-free jobs in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml). They use Node 22 and the exact
`pnpm@11.7.0` pin declared in the root `package.json`, install with the lockfile frozen, and do
not require provider, deployment, or publishing credentials.

## Matrix and workflow structure

| Job                            | Runner                 | Checks                                                                       |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `quality`                      | Ubuntu                 | `format:check`, `lint`, `typecheck`, `test`, and `build` for the repository  |
| `trusted-runtime-security`     | Ubuntu                 | The focused trusted runtime security, HTTP, workspace, and integration suite |
| `local-runtime-cross-platform` | Ubuntu, macOS, Windows | `pnpm --filter @universal/local-runtime test`                                |

The fast repository-quality jobs run once on Ubuntu. The focused local-runtime suite runs on all
three hosted operating systems because process cleanup, paths, filesystem containment, and
loopback behavior are operating-system-sensitive. Each workflow grants only `contents: read`,
cancels superseded runs for the same PR or ref, uses the pnpm store cache keyed by the lockfile,
and sets job timeouts. The matrix uses ordinary `run` commands, avoiding shell pipelines or
POSIX-only syntax that would not work in Windows PowerShell.

## Release command sequence

Use the repository-pinned tools and a clean checkout:

```text
corepack enable
pnpm --version
pnpm install --frozen-lockfile
pnpm --dir packages/local-runtime/template install --frozen-lockfile --ignore-scripts
# macOS and Linux
rm -rf packages/local-runtime/template/node_modules
# Windows PowerShell
Remove-Item -LiteralPath 'packages/local-runtime/template/node_modules' -Recurse -Force
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Ubuntu
pnpm --filter @universal/local-runtime exec playwright install --with-deps chromium
# macOS and Windows
pnpm --filter @universal/local-runtime playwright:install
pnpm --filter @universal/local-runtime test
git diff --check
```

The expected pnpm version is `11.7.0`; Node must be 22 or newer. On Windows, use `pnpm.cmd` in
place of `pnpm` if PowerShell execution policy blocks the shim. See [Setup](SETUP.md) for the
platform-specific Corepack and shell notes.

Before a release candidate is accepted, the pull request must also be green in all three
`local-runtime-cross-platform` jobs. CI performs fresh frozen-lockfile installs; this is the
CI-only portion when a contributor has tested only their local operating system.

The template install deliberately populates the same pnpm store that the runtime later uses for its
fixed offline install. In the cross-platform CI matrix, the workflow configures one runner-local
global store under `${{ runner.temp }}/pnpm-store` before `actions/setup-node` restores the pnpm
cache. Both the root and template lockfiles contribute to that cache key, and the root install,
template preparation, and spawned runtime pnpm process therefore resolve packages from the same
store on every operating system. This CI-only store override does not relax the runtime's
`--offline` or `--frozen-lockfile` guarantees. Remove only the generated
`packages/local-runtime/template/node_modules` directory before the runtime suite; do not change
the fixed template or its lockfile.

The browser-capture tests require the workspace-pinned Playwright Chromium revision. Install it with
--with-deps on Ubuntu; macOS and Windows install the same pinned Chromium without that flag.

## Local reproduction by operating system

On Windows (PowerShell), macOS, and Linux, run the command sequence above from the repository
root. The focused runtime command is the closest local match for the three-way matrix:

```text
pnpm --filter @universal/local-runtime test
```

A normal local reproduction may use pnpm's default store as long as the root install, template
preparation, and runtime test use the same pnpm configuration. To reproduce CI's isolated-store
behavior exactly, configure a disposable store directory globally for that test environment before
running either install, then confirm `pnpm store path` reports that same directory throughout the
sequence. Do not reuse a partially populated store when validating offline-install determinism.

The runner matrix is intentionally limited to the current hosted images and Node 22. It does not
claim coverage of every Node 22 patch release, CPU architecture, filesystem, shell, endpoint
security product, or browser version. Hosted Windows, macOS, and Linux coverage also cannot prove
behavior on a contributor's local configuration, network policy, or managed device.

The green matrix proves that the checked-in, offline deterministic test suite passed under the
pinned Node/pnpm setup on the three GitHub-hosted runners. It does not prove a production
live-provider integration, hosted deployment, package publishing, public preview safety, or
complete browser/OS isolation. Credential-gated provider tests and external-provider behavior are
explicitly outside this gate.

## Security boundary reminder

The local runtime supervises fixed commands, constrains generated project materialization, and
serves loopback previews. That process supervision is a privilege and containment boundary, but it
is **not** an operating-system or container sandbox. Run untrusted code only with the additional
host, VM, or container isolation appropriate to your environment; a green CI matrix does not
change that boundary.
