# Design Studio

Design Studio is an open-source AI Art Director for developers building React interfaces with coding agents. It establishes composition and visual direction before implementation.

## Workspace

- `apps/studio` — the design-direction workspace
- `apps/preview` — isolated renderer for generated project previews
- `packages/design-engine` — contracts and orchestration boundary for future design work
- `packages/composition-library` — composable page-composition schemas
- `packages/design-linter` — interfaces for anti-generic design critique
- `packages/prompts` — versioned prompt templates and prompt assembly
- `packages/shared` — cross-cutting domain types and result utilities
- `packages/ui` — small shared React UI primitives

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Studio and Preview together. Generation is intentionally not implemented yet; current screens and package functions are architectural placeholders.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```
