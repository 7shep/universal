<h1 align="center">Universal</h1>

<h4 align="center">An open-source AI art director for React interfaces built with coding agents.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/node-22%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 22+">
  <img src="https://img.shields.io/badge/pnpm-11%2B-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm 11+">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19">
  <a href="LICENSE.MD"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <a href="https://github.com/7shep/universal/stargazers">Star Universal</a>
  ·
  <a href="docs/CODEX_MCP_SETUP.md">Connect to Codex</a>
  ·
  <a href="CONTRIBUTING.md">Contribute</a>
  ·
  <a href="ROADMAP.md">Roadmap</a>
</p>

Coding agents are good at producing functional React code, but they often fall back to the same
visual defaults: generic heroes, repeated card grids, arbitrary gradients, and weak hierarchy.
Universal adds a design-direction step before implementation and a critique step after it.

It gives a compatible coding agent:

- a structured creative brief and art direction;
- composition, typography, color, motion, and accessibility constraints;
- a versioned design plan that can be carried into implementation; and
- an implementation review that finds generic or off-direction choices.

Universal is for developers building React interfaces with coding agents who want deliberate
design decisions without turning their workflow into a full visual editor.

## How it works

```text
project context
      ↓
discovery questions → approved creative brief
      ↓
art direction → selected direction → Design Plan v2
      ↓
React implementation
      ↓
source and visual review → prioritized findings
```

Universal exposes this workflow through a local
[Model Context Protocol](https://modelcontextprotocol.io/) server. The Studio application provides
a deterministic, credential-free way to inspect the current art-direction flow.

## What is ready today

Universal is in active early development. Phase 3 provides an offline deterministic path from an
approved Design Plan v2 through validated React generation, immutable workspace materialization, a
locked production build, and an isolated loopback preview. Studio and Preview can use versioned
runtime records; hosted deployment, arbitrary packages, and a production live-provider adapter
remain out of scope.

| Available                                             | Still in progress                       |
| ----------------------------------------------------- | --------------------------------------- |
| Discovery, brief approval, and direction selection    | Production live-provider implementation |
| Design Plan v2 compiler and digest-bound provenance   | OS or container sandboxing              |
| Provider-neutral deterministic React generation       | Full macOS and Linux runtime validation |
| Trusted local runtime and immutable workspaces        | Hosted deployment and public previews   |
| Locked production builds and isolated static previews | Packaging and one-command distribution  |
| Runtime-connected Studio and Preview applications     | Stable public release guarantees        |
| Deterministic rendered benchmark and recovery tests   | Subjective visual quality automation    |

The [roadmap](ROADMAP.md) tracks planned milestones. The
[architecture guide](docs/ARCHITECTURE.md) distinguishes implemented behavior from planned
boundaries.

## Try the local Studio

### Requirements

- Git
- Node.js 22 or newer
- pnpm 11 or newer

```bash
git clone https://github.com/7shep/universal.git
cd universal
pnpm install
pnpm dev
```

`pnpm dev` starts the Studio and Preview applications. Studio uses local deterministic fixtures, so
exploring the design-direction sequence does not require model credentials.

To connect the MCP server to Codex, follow the
[step-by-step Codex setup guide](docs/CODEX_MCP_SETUP.md). Downstream products should use the
[orchestration API](docs/DOWNSTREAM_API.md) instead of importing MCP transport internals.

## MCP workflow

The recommended Phase 2 art-director sequence is:

```text
start_art_direction
  → get_discovery_questions
  → submit_discovery_answers
  → get_creative_brief
  → approve_creative_brief
  → develop_art_direction
  → get_selected_direction
  → create_design_plan_v2
```

`revise_creative_brief` supports review changes, and `get_art_direction_session` validates or
inspects a serialized session. Every Phase 2 response returns the complete serialized session that
must be passed to the next operation.

Compatibility and policy tools are also available:

- `create_design_plan` establishes visual and compositional direction.
- `get_design_rules` returns category-specific design constraints.
- `get_taste_profile` returns the active taste principles and anti-pattern guidance.
- `review_implementation` critiques React and CSS against the intended direction.

Build and test the MCP server independently:

```bash
pnpm --filter @universal/design-mcp build
pnpm --filter @universal/design-mcp test
```

See the [MCP tool reference](docs/MCP_REFERENCE.md) for all tool inputs and outputs.

## Repository map

| Path                           | Responsibility                            |
| ------------------------------ | ----------------------------------------- |
| `apps/studio`                  | Design-direction workspace                |
| `apps/preview`                 | Isolated preview surface                  |
| `examples/demo-site`           | Example React/Vite interface              |
| `packages/design-engine`       | Design contracts and orchestration        |
| `packages/design-mcp`          | Local MCP server                          |
| `packages/composition-library` | Page-composition schemas                  |
| `packages/design-linter`       | Implementation critique contracts         |
| `packages/design-taste`        | Versioned taste policy                    |
| `packages/design-benchmark`    | Deterministic quality benchmark           |
| `packages/generation`          | Provider-neutral generation boundary      |
| `packages/local-runtime`       | Trusted build and preview supervision     |
| `packages/prompts`             | Versioned prompt definitions and assembly |
| `packages/runtime-contracts`   | Browser/runtime protocol contracts        |
| `packages/shared`              | Cross-package domain utilities            |
| `packages/ui`                  | Shared React primitives                   |

Read [Architecture and ownership](docs/ARCHITECTURE.md) before changing cross-package contracts.

## Contribute

You do not need to understand the entire monorepo to contribute. Useful entry points include:

| If you enjoy…           | A useful starting point                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| Documentation           | Verify a setup guide on your platform and report unclear or missing steps  |
| Testing                 | Add a regression case around an existing MCP tool or validation boundary   |
| React and accessibility | Improve keyboard, focus, contrast, or reduced-motion behavior              |
| Design systems          | Propose a focused composition rule or anti-pattern with fixtures and tests |
| Developer tooling       | Improve diagnostics, local setup, or package-level workflows               |
| Evaluation              | Add a representative benchmark brief or strengthen deterministic checks    |

Start with the [contribution guide](CONTRIBUTING.md). It explains how to choose a scoped change,
where it belongs, what “done” means, and which checks to run. If you are unsure where an idea fits,
open a [contribution question](https://github.com/7shep/universal/issues/new?template=contribution_question.yml)
before writing a large patch.

## Validation

Run the full repository gate with:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test
```

## Documentation

- [Product principles and non-goals](PRODUCT.md)
- [Roadmap](ROADMAP.md)
- [Architecture and ownership](docs/ARCHITECTURE.md)
- [Studio workflow](docs/STUDIO.md)
- [Connect Universal MCP to Codex](docs/CODEX_MCP_SETUP.md)
- [MCP tool reference](docs/MCP_REFERENCE.md)
- [Downstream orchestration API](docs/DOWNSTREAM_API.md)
- [Security policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

Universal is available under the [MIT License](LICENSE.MD).
