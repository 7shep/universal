# Local setup

This guide covers a source checkout of Universal on Windows PowerShell and POSIX-compatible shells.
The repository currently requires Node.js 22 or newer and pnpm 11. Its exact package-manager
version is declared in the root [`package.json`](../package.json).

## Verify prerequisites

Run:

```text
git --version
node --version
corepack --version
```

The Node result must be `v22.0.0` or newer. After enabling pnpm, verify both the active version and
the version expected by the checkout:

```text
pnpm --version
node -p "require('./package.json').packageManager"
```

The pnpm major versions must match. The repository currently pins `pnpm@11.7.0`.

## Enable the pinned pnpm

The supported Node 22 releases include Corepack, but it may not be enabled. Some newer Node
distributions require Corepack to be installed separately. When Corepack is available, use it
rather than installing an unrelated global pnpm version:

```text
corepack enable
corepack install --global pnpm@11.7.0
pnpm --version
```

If your Node installation directory is not writable, do not rerun an untrusted command as
administrator. Use a user-owned Node installation through a version manager, or invoke
`corepack pnpm` in place of `pnpm`.

## Install and run

From the repository root:

```text
pnpm install
pnpm dev
```

`pnpm dev` runs every workspace development script in parallel:

| Workspace         | URL                     |
| ----------------- | ----------------------- |
| Studio            | `http://localhost:5173` |
| Preview           | `http://localhost:5174` |
| Axis 65 demo site | `http://localhost:5175` |

Start only one workspace when needed:

```text
pnpm --filter @universal/studio dev
pnpm --filter @universal/preview dev
pnpm --filter @universal/demo-site dev
```

## Windows PowerShell

These commands were verified with Windows 11, PowerShell 5.1, Node `v22.20.0`, and the
repository-pinned pnpm `11.7.0`.

If PowerShell reports that `pnpm.ps1` cannot be loaded because script execution is disabled, use
the command shim:

```powershell
pnpm.cmd --version
pnpm.cmd install
pnpm.cmd dev
```

Alternatively, inspect the policies that apply to your account:

```powershell
Get-ExecutionPolicy -List
```

If your organization permits it, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` changes only
your user policy and does not require weakening the machine-wide policy. Do not use
`-ExecutionPolicy Bypass` for downloaded or untrusted scripts. Organization policy may override
the current-user setting; in that case, keep using `pnpm.cmd` or follow your administrator's
guidance.

## macOS and Linux shells

The repository commands are the same in Bash, Zsh, and similar POSIX shells:

```bash
pnpm install
pnpm dev
```

These notes were checked against the repository scripts but were not executed on macOS or Linux
for this documentation update. Install Node through a supported user-level package or version
manager, then use Corepack to activate the pinned pnpm version. Do not prefix project scripts with
`sudo`.

## Port conflicts

The Vite servers use strict ports. If a port is occupied, startup fails with an error such as
`Port 5173 is already in use`; Vite will not silently choose a different port.

Stop the process already using the port, or deliberately override the port for that invocation:

```text
pnpm --filter @universal/studio dev -- --port 6173
pnpm --filter @universal/preview dev -- --port 6174
pnpm --filter @universal/demo-site dev -- --port 6175
```

Use the URL printed by Vite after an override. Any integration expecting the default Studio,
Preview, or demo URL must be updated for that run.

On Windows, inspect a port without terminating anything:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
```

On macOS or Linux:

```bash
lsof -i :5173
```

## Validate the checkout

Run the complete local gate:

```text
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test
```

For MCP client configuration, continue with [Connect Universal MCP to Codex](CODEX_MCP_SETUP.md).
