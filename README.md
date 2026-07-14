<h1 align="center">
  <br>
  Universal
</h1>

<h4 align="center">An open-source AI Art Director for developers building React interfaces with coding agents.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/node-22%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 22+">
  <img src="https://img.shields.io/badge/pnpm-11%2B-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm 11+">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19">
</p>

<p align="center">
  <a href="https://github.com/7shep/universal/stargazers"><img src="https://img.shields.io/github/stars/7shep/universal?style=flat-square&label=stars" alt="Stars"></a>
  <a href="https://github.com/7shep/universal/forks"><img src="https://img.shields.io/github/forks/7shep/universal?style=flat-square&label=forks" alt="Forks"></a>
  <a href="https://github.com/7shep/universal/issues"><img src="https://img.shields.io/github/issues/7shep/universal?style=flat-square&label=issues" alt="Issues"></a>
  <a href="https://github.com/7shep/universal/pulls"><img src="https://img.shields.io/github/issues-pr/7shep/universal?style=flat-square&label=pull%20requests" alt="Pull requests"></a>
  <a href="LICENSE.MD"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  Universal establishes composition and visual direction before implementation. It gives coding agents a structured design plan, reusable design rules, and a critique loop so generated interfaces feel deliberately art-directed instead of generically assembled.
</p>

<table>
<tr>
<td>

**What it provides**

- Structured design plans
- Composition guidance
- Reusable design rules
- Anti-generic design critique
- Local MCP integration

**What it uses**

- React and Vite
- TypeScript
- pnpm workspaces
- Turborepo
- Model Context Protocol

</td>
</tr>
</table>

## Project Status

Universal is in active early development. The monorepo, Studio and Preview applications, design contracts, and MCP prototype are in place. Some generation flows remain architectural placeholders while the design engine is built out.

See the [roadmap](ROADMAP.md) for planned milestones and [product principles](PRODUCT.md) for the project's direction.

## Quick Start

### Prerequisites

- Node.js 22 or newer
- pnpm 11 or newer
- Git

### Install and run

```bash
git clone https://github.com/7shep/universal.git
cd universal
pnpm install
pnpm dev
```

`pnpm dev` starts the Studio and Preview applications together.

For a full production check:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
```

To run the MCP package tests:

```bash
pnpm --filter @universal/design-mcp test
```

## MCP Prototype

Universal includes a local MCP server that exposes three tools to compatible coding agents:

- `create_design_plan` establishes the visual and compositional direction.
- `get_design_rules` returns category-specific design constraints.
- `review_implementation` critiques React and CSS output against the intended direction.

Build the server with:

```bash
pnpm --filter @universal/design-mcp build
```

See [Connect Universal MCP to Codex](docs/CODEX_MCP_SETUP.md) for configuration, verification, troubleshooting, and a complete demo workflow.

## Workspace

```text
universal/
|-- apps/
|   |-- studio/                Design-direction workspace
|   `-- preview/               Isolated generated-project preview
|-- examples/
|   `-- demo-site/             Example MCP-driven React site
|-- packages/
|   |-- composition-library/   Page-composition schemas
|   |-- design-engine/         Design contracts and orchestration
|   |-- design-linter/         Anti-generic critique interfaces
|   |-- design-mcp/            Local MCP server
|   |-- prompts/               Versioned prompt assembly
|   |-- shared/                Shared domain types and utilities
|   `-- ui/                    Shared React UI primitives
|-- docs/                      Setup and integration guides
|-- PRODUCT.md                 Product principles and boundaries
`-- ROADMAP.md                 Milestones and future direction
```

## Scripts

- `pnpm dev` starts all development tasks in parallel.
- `pnpm build` builds every workspace package through Turborepo.
- `pnpm lint` runs ESLint across the repository.
- `pnpm typecheck` type-checks all workspaces.
- `pnpm format` formats supported files with Prettier.
- `pnpm format:check` checks formatting without changing files.

Use pnpm filters to target one workspace, for example:

```bash
pnpm --filter @universal/studio dev
pnpm --filter @universal/design-mcp build
```

## Contributing

Contributions are welcome. Bug reports, focused fixes, documentation improvements, design-rule proposals, and well-scoped feature discussions all help.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. It covers local setup, project conventions, validation, commit guidance, and the review process.

## License

Universal is available under the [MIT License](LICENSE.MD).
