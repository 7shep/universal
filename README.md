<h1 align="center">Universal</h1>

<h4 align="center">An open-source AI art director for React interfaces built with coding agents.</h4>

<p align="center">
  <a href="https://github.com/7shep/universal/actions/workflows/ci.yml"><img src="https://github.com/7shep/universal/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@7shep/universal-mcp"><img src="https://img.shields.io/npm/v/@7shep/universal-mcp?label=npm&tag=alpha" alt="npm alpha release"></a>
  <img src="https://img.shields.io/badge/node-22%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 22+">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19">
  <a href="LICENSE.MD"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  <a href="https://style.alexshepherd.dev">Website</a>
  &middot;
  <a href="https://style.alexshepherd.dev/install">Install</a>
  &middot;
  <a href="docs/MCP_REFERENCE.md">MCP Reference</a>
  &middot;
  <a href="CONTRIBUTING.md">Contribute</a>
  &middot;
  <a href="ROADMAP.md">Roadmap</a>
</p>

Coding agents are good at producing functional React code, but they often fall back to the same
visual defaults: generic heroes, repeated card grids, arbitrary gradients, and weak hierarchy.
Universal adds a design-direction step before implementation and a critique step after it.

Universal gives a compatible coding agent:

- structured discovery, a creative brief, and explicit approval;
- distinct art directions with a selected visual thesis;
- composition, typography, color, imagery, motion, and accessibility constraints;
- a versioned design plan that carries intent into implementation;
- trusted local React generation, production builds, and previews; and
- implementation review that identifies generic or off-direction choices.

## Install

Universal is published on npm as [@7shep/universal-mcp](https://www.npmjs.com/package/@7shep/universal-mcp).
It requires Node.js 22 or newer and runs locally over stdio. Universal does not read model API keys;
your MCP client's existing model authors the source.

Run the server without a global install:

```bash
npx -y @7shep/universal-mcp@alpha
```

### Claude Code

```bash
claude mcp add universal -- npx -y @7shep/universal-mcp@alpha
```

### MCP client configuration

For Claude Desktop and other clients that accept JSON MCP configuration:

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

Codex uses TOML. See [Connect Universal MCP to Codex](docs/CODEX_MCP_SETUP.md) for the complete
configuration and verification steps. Visit the [installation page](https://style.alexshepherd.dev/install)
for the visual setup guide.

## How it works

```text
project context
      |
      v
discovery questions -> approved creative brief
      |
      v
art directions -> selected direction -> Design Plan v2
      |
      v
MCP host model authors React source
      |
      v
trusted materialization -> locked build -> local Vite preview
      |
      v
source and visual review -> prioritized findings
```

The creative brief, approval, selected direction, and Design Plan v2 are digest-bound. Revising an
upstream decision invalidates stale downstream artifacts instead of silently carrying them forward.
Stable request IDs make mutations safely retryable.

## MCP tools

The published server exposes 16 tools.

### Art-direction workflow

```text
start_art_direction
  -> get_discovery_questions
  -> submit_discovery_answers
  -> get_creative_brief
  -> approve_creative_brief
  -> develop_art_direction
  -> get_selected_direction
  -> create_design_plan_v2
```

- <code>revise_creative_brief</code> changes a reviewed brief and invalidates stale downstream artifacts.
- <code>get_art_direction_session</code> validates and inspects a serialized session.
- Every workflow response returns the serialized session required by the next operation.

### Generation and review

```text
prepare_react_generation
  -> host model authors allowed React source and assets
  -> build_react_project
  -> immutable workspace and locked production build
  -> review_implementation
```

The runtime owns dependencies, scripts, configuration, materialization, build supervision, and the
loopback preview. Submitted source is validated before it reaches the trusted workspace.

### Design intelligence and compatibility

- <code>create_design_plan</code> provides the lower-level design-plan compatibility API.
- <code>get_design_rules</code> returns category-specific design constraints.
- <code>get_taste_profile</code> returns the active taste and anti-pattern policy.
- <code>review_implementation</code> critiques React and CSS against the intended direction.

See the [MCP tool reference](docs/MCP_REFERENCE.md) for request shapes, response envelopes, phase
preconditions, idempotency behavior, and error codes.

## Agent skill commands

Universal includes twenty repository-local workflow skills under [.agents/skills](.agents/skills).
They coordinate MCP tools with source inspection, verification, and design-quality gates.

> These commands are currently in progress. They are available to agents working from this
> repository, but they are not yet distributed as stable standalone commands by the npm package.

| Command                                       | Purpose                                                                                                                                                                     | Changes files?       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| <code>/art-direct</code>                      | Runs discovery, brief approval, direction selection, Design Plan v2, implementation, and review for a new or substantially redesigned interface.                            | Yes, after approval  |
| <code>/audit</code>                           | Produces a prioritized, evidence-led audit of an existing route or component.                                                                                               | No                   |
| <code>/polish</code>                          | Applies bounded improvements to hierarchy, typography, spacing, responsiveness, and accessibility without redesigning behavior.                                             | Yes                  |
| <code>/cleanup</code>                         | Removes verified redundant, inconsistent, obsolete, or generic UI patterns while preserving behavior and APIs.                                                              | Yes                  |
| <code>/review-ui</code>                       | Coordinates multiple design-review perspectives into one deduplicated, ranked report.                                                                                       | No                   |
| <code>[/assets](docs/skills/assets.md)</code> | Audits imagery, icons, and illustrations for quality, consistency, relevance, performance, and accessibility; replaces or generates assets only when explicitly authorized. | Only when authorized |

Invoke a skill explicitly with a scoped request:

```text
/art-direct Create an editorial landing page for a developer tool.
/audit frontend/src at desktop and mobile widths.
/polish Tighten the installation page typography and mobile spacing.
/cleanup Consolidate duplicated tokens in frontend/src/styles.css.
/review-ui Review the installation page against the selected direction.
/assets frontend/src/pages/Home hero image — replace with frontend/src/assets/hero-v2.jpg (license: CC0), authorized
```

Read each skill's <code>SKILL.md</code> before changing its workflow or completion gates.

## What is ready today

Universal is an early alpha. The public npm package provides the local MCP workflow from discovery
through implementation review.

| Available                                                  | Still in progress                               |
| ---------------------------------------------------------- | ----------------------------------------------- |
| Public npm MCP package (<code>@7shep/universal-mcp</code>) | Stable 1.0 API guarantees                       |
| Discovery, brief approval, and direction selection         | Production live-provider implementation         |
| Design Plan v2 with digest-bound provenance                | OS or container sandboxing                      |
| MCP-host-authored React generation                         | Hosted generation and public project previews   |
| Trusted immutable workspaces and locked builds             | One-command Studio desktop packaging            |
| Isolated loopback previews and rendered QA                 | Broader subjective visual-quality automation    |
| Windows, macOS, and Linux validation matrix                | Standalone distribution of agent skill commands |
| Marketing site and installation guide                      | Official MCP Registry listing                   |

Tool names, inputs, outputs, and serialized sessions may change before 1.0. The
[roadmap](ROADMAP.md) tracks planned milestones, and the [architecture guide](docs/ARCHITECTURE.md)
distinguishes implemented behavior from planned boundaries.

## Run the local Studio

The repository also includes Studio, Preview, and an Axis 65 demo for contributors exploring the
deterministic local workflow.

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

Studio uses local deterministic fixtures, so exploring the art-direction sequence does not require
model credentials. See the [cross-platform setup guide](docs/SETUP.md) for troubleshooting.

## Repository map

| Path                                      | Responsibility                            |
| ----------------------------------------- | ----------------------------------------- |
| <code>frontend</code>                     | Public website and installation guide     |
| <code>.agents/skills</code>               | Repository-local design workflow skills   |
| <code>apps/studio</code>                  | Design-direction workspace                |
| <code>apps/preview</code>                 | Isolated preview surface                  |
| <code>examples/demo-site</code>           | Example React/Vite interface              |
| <code>packages/design-engine</code>       | Design contracts and orchestration        |
| <code>packages/design-mcp</code>          | Published local MCP server                |
| <code>packages/composition-library</code> | Page-composition schemas                  |
| <code>packages/design-linter</code>       | Implementation critique contracts         |
| <code>packages/design-taste</code>        | Versioned taste policy                    |
| <code>packages/design-benchmark</code>    | Deterministic quality benchmark           |
| <code>packages/generation</code>          | Provider-neutral generation boundary      |
| <code>packages/local-runtime</code>       | Trusted build and preview supervision     |
| <code>packages/prompts</code>             | Versioned prompt definitions and assembly |
| <code>packages/runtime-contracts</code>   | Browser/runtime protocol contracts        |
| <code>packages/shared</code>              | Cross-package domain utilities            |
| <code>packages/ui</code>                  | Shared React primitives                   |

Read [Architecture and ownership](docs/ARCHITECTURE.md) before changing cross-package contracts.

## Contribute

You do not need to understand the entire monorepo to contribute.

| If you enjoy...         | A useful starting point                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| Documentation           | Verify an install or setup guide and report unclear steps                  |
| Testing                 | Add a regression case around an MCP tool or validation boundary            |
| React and accessibility | Improve keyboard, focus, contrast, or reduced-motion behavior              |
| Design systems          | Propose a focused composition rule or anti-pattern with fixtures and tests |
| Developer tooling       | Improve diagnostics, packaging, or local setup                             |
| Evaluation              | Add a benchmark brief or strengthen deterministic checks                   |

Start with the [contribution guide](CONTRIBUTING.md). If you are unsure where an idea fits, open a
[contribution question](https://github.com/7shep/universal/issues/new?template=contribution_question.yml)
before writing a large patch.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test
```

Build and test only the published MCP package with:

```bash
pnpm --filter @7shep/universal-mcp build
pnpm --filter @7shep/universal-mcp test
```

## Documentation

- [Website](https://style.alexshepherd.dev)
- [Installation guide](https://style.alexshepherd.dev/install)
- [Product principles and non-goals](PRODUCT.md)
- [Roadmap](ROADMAP.md)
- [Cross-platform local setup](docs/SETUP.md)
- [Release readiness](docs/RELEASE_READINESS.md)
- [Design and provenance glossary](docs/GLOSSARY.md)
- [Architecture and ownership](docs/ARCHITECTURE.md)
- [Generation and local-runtime workflow](docs/RUNTIME_CONTRIBUTOR_WORKFLOW.md)
- [Studio workflow](docs/STUDIO.md)
- [Connect Universal MCP to Codex](docs/CODEX_MCP_SETUP.md)
- [MCP tool reference](docs/MCP_REFERENCE.md)
- [Publishing and release operations](docs/MCP_RELEASE.md)
- [Downstream orchestration API](docs/DOWNSTREAM_API.md)
- [Security policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

Universal is available under the [MIT License](LICENSE.MD).
