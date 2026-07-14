# Contributing to Universal

Thank you for helping build Universal. Contributions of all sizes are welcome, including bug reports, documentation, tests, design rules, accessibility improvements, and focused code changes.

Universal is an AI Art Director for React applications. Its core principle is **design before code**: establish a clear creative direction, preserve that intent through implementation, and provide concrete critique. Contributions should reinforce that focus rather than turn the project into a general-purpose app builder.

## Table of Contents

- [Before You Start](#before-you-start)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Repository Guide](#repository-guide)
- [Development Workflow](#development-workflow)
- [Project Standards](#project-standards)
- [Testing and Validation](#testing-and-validation)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Proposing Features](#proposing-features)
- [Documentation Contributions](#documentation-contributions)
- [Community Expectations](#community-expectations)
- [License](#license)

## Before You Start

For anything beyond a small documentation or typo fix:

1. Search [existing issues](https://github.com/7shep/universal/issues) and pull requests to avoid duplicate work.
2. Read [PRODUCT.md](PRODUCT.md) to understand the product principles and non-goals.
3. Check [ROADMAP.md](ROADMAP.md) to see whether the work belongs to a planned milestone.
4. Open or comment on an issue before investing in a large change. This lets maintainers confirm scope and direction early.

Please keep pull requests focused. A small, complete change is easier to review and merge than a broad change that combines refactoring, features, and formatting.

## Ways to Contribute

Good first contributions include:

- Reproducing and documenting a reported bug
- Improving setup or troubleshooting documentation
- Adding tests for existing MCP behavior
- Fixing keyboard, focus, contrast, or reduced-motion issues
- Improving types and error messages without changing public behavior
- Adding a narrowly scoped composition or design-lint rule
- Removing dead code or clarifying an internal package boundary

For help finding a starting point, browse issues labeled `good first issue`, `help wanted`, or `documentation` when those labels are available.

## Development Setup

### Prerequisites

- Git
- Node.js 22 or newer
- pnpm 11 or newer

The repository declares its expected package manager in `package.json`. Using the matching pnpm major version helps keep the lockfile stable.

### Fork and clone

1. Fork [`7shep/universal`](https://github.com/7shep/universal) on GitHub.
2. Clone your fork and enter the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/universal.git
   cd universal
   ```

3. Add the main repository as `upstream`:

   ```bash
   git remote add upstream https://github.com/7shep/universal.git
   ```

4. Install dependencies:

   ```bash
   pnpm install
   ```

5. Start the development applications:

   ```bash
   pnpm dev
   ```

You can target an individual workspace when you do not need the entire monorepo:

```bash
pnpm --filter @universal/studio dev
pnpm --filter @universal/preview dev
```

### MCP development

Build and test the local MCP server with:

```bash
pnpm --filter @universal/design-mcp build
pnpm --filter @universal/design-mcp test
```

For client configuration and manual verification, follow [docs/CODEX_MCP_SETUP.md](docs/CODEX_MCP_SETUP.md).

## Repository Guide

- `apps/studio` contains the design-direction workspace.
- `apps/preview` contains the isolated preview renderer.
- `examples/demo-site` is the example React/Vite integration.
- `packages/design-mcp` contains the stdio MCP server and its tests.
- `packages/design-engine` defines design contracts and orchestration boundaries.
- `packages/composition-library` contains reusable page-composition schemas.
- `packages/design-linter` contains anti-generic critique interfaces.
- `packages/prompts` contains versioned prompts and prompt assembly.
- `packages/shared` contains cross-package domain types and result utilities.
- `packages/ui` contains small shared React primitives.
- `docs` contains setup and integration guides.

Prefer making a change in the narrowest package that owns the behavior. Shared packages should contain genuinely cross-cutting concepts, not code moved there only for convenience.

## Development Workflow

### 1. Sync your fork

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
```

### 2. Create a branch

Use a short, descriptive branch name:

```bash
git switch -c fix/mcp-validation-message
```

Common prefixes include `feat/`, `fix/`, `docs/`, `test/`, and `refactor/`.

### 3. Make a focused change

- Follow the existing TypeScript and React patterns.
- Avoid unrelated dependency updates or formatting churn.
- Add or update tests when behavior changes.
- Update documentation when setup, APIs, commands, or contributor workflows change.
- Keep generated files and local environment files out of commits.

### 4. Validate locally

Run the checks listed in [Testing and Validation](#testing-and-validation). Fix new warnings and errors introduced by your change.

### 5. Commit clearly

Write an imperative summary that describes the outcome:

```text
fix: return actionable MCP validation errors
```

Conventional Commit prefixes are encouraged but not required. Useful prefixes include `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, and `build`.

## Project Standards

### TypeScript and code style

- Keep TypeScript types explicit at package and tool boundaries.
- Avoid `any` when a specific type or `unknown` with validation is appropriate.
- Preserve ESM conventions; the workspaces use `"type": "module"`.
- Reuse domain types from the owning package instead of duplicating shapes.
- Prefer readable, direct code over premature abstractions.
- Run Prettier rather than manually aligning formatting.

### React and interface work

- Use semantic HTML and accessible names.
- Ensure interactive controls work with a keyboard and have visible focus states.
- Target WCAG 2.2 AA contrast and interaction requirements.
- Respect `prefers-reduced-motion` for meaningful animation.
- Do not communicate state through color alone.
- Preserve Universal's editorial, exacting, and constructive visual character.
- Avoid generic dashboard patterns, excessive gradients, repeated card grids, and decorative complexity without a product reason.

### MCP tools and prompts

- Keep tool inputs and outputs structured, deterministic where possible, and useful to coding agents.
- Validate external input at the boundary and return actionable error messages.
- Do not write non-protocol output to stdout in the stdio server.
- Treat prompt changes as behavior changes: keep them focused and explain their expected effect in the pull request.
- Add or update tests when changing tool schemas, response shapes, or core prompt assembly.

### Dependencies

Before adding a dependency, consider whether the existing stack or a small local implementation is sufficient. New dependencies should have a clear maintenance benefit, compatible licensing, and an appropriate security posture. Explain notable additions in the pull request.

## Testing and Validation

Run the repository-wide checks from the project root:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
```

Run the current automated MCP test suite with:

```bash
pnpm --filter @universal/design-mcp test
```

For changes limited to one workspace, filtered checks can speed up iteration:

```bash
pnpm --filter @universal/studio lint
pnpm --filter @universal/studio typecheck
pnpm --filter @universal/studio build
```

Before requesting review:

- Confirm all relevant automated checks pass.
- Exercise the changed behavior manually.
- Test interface changes at desktop and mobile widths.
- Check keyboard navigation, focus states, empty states, and reduced motion where relevant.
- Include screenshots or a short recording for visible interface changes.
- Note any check you could not run and explain why.

## Submitting a Pull Request

Push your branch to your fork and open a pull request against the main repository's `main` branch:

```bash
git push -u origin fix/mcp-validation-message
```

A useful pull request includes:

- A concise explanation of the problem and solution
- A linked issue, when one exists
- The scope of affected packages or applications
- The validation commands you ran
- Screenshots or recordings for visual changes
- Compatibility, migration, or follow-up notes when relevant

Keep these review expectations in mind:

- Respond to questions and requested changes constructively.
- Resolve review conversations only after the concern is addressed or agreement is reached.
- Add follow-up commits during review; maintainers may squash when merging.
- Do not force-push after review has begun unless necessary, because it makes changes harder to compare.

Maintainers may close pull requests that conflict with the product direction, duplicate existing work, or remain inactive after feedback. This is about protecting project focus, not discouraging contributions.

## Reporting Bugs

Open a [GitHub issue](https://github.com/7shep/universal/issues/new) and include:

- A clear description of the unexpected behavior
- Steps to reproduce it from a clean checkout when possible
- The expected behavior
- Node.js, pnpm, operating system, and browser versions as relevant
- Error output, stack traces, screenshots, or a minimal reproduction
- The affected app, package, or MCP tool

Remove secrets, tokens, private prompts, and personal data from logs before posting them publicly.

Security vulnerabilities should not be disclosed in a public issue. Use GitHub's private security reporting feature if it is enabled for the repository; otherwise contact the maintainer privately through the repository owner's published contact channel.

## Proposing Features

Open an issue before implementing a substantial feature. Describe:

- The user problem, not only the proposed UI or API
- Why it fits Universal's design-first scope
- A small example of the desired workflow or output
- Alternatives or workarounds you considered
- Which packages or milestones may be affected

Avoid large speculative implementations before maintainers confirm the direction. Universal deliberately does not aim to become Figma, Framer, a full-stack generator, or a general deployment platform.

## Documentation Contributions

Documentation changes should be accurate for the current repository rather than anticipated behavior. Use relative links for repository files, copy-pasteable commands, descriptive headings, and fenced code blocks with language identifiers.

When a code change affects installation, configuration, scripts, MCP tool behavior, or public package contracts, update the relevant documentation in the same pull request.

## Community Expectations

Be respectful, specific, and constructive. Discuss ideas and code rather than people. Assume good intent, welcome contributors with different experience levels, and make technical disagreement useful by explaining evidence and tradeoffs.

Harassment, discrimination, personal attacks, and disclosure of another person's private information are not acceptable. Project maintainers may edit, remove, or reject contributions and interactions that make the community unsafe or unproductive.

## License

By contributing to Universal, you agree that your contributions will be licensed under the project's [MIT License](LICENSE.MD).
