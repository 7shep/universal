# Contributing to Universal

Thank you for helping build Universal. Contributions of all sizes are welcome, including bug reports, documentation, tests, design rules, accessibility improvements, and focused code changes.

Universal is an AI Art Director for React applications. Its core principle is **design before code**: establish a clear creative direction, preserve that intent through implementation, and provide concrete critique. Contributions should reinforce that focus rather than turn the project into a general-purpose app builder.

## Table of Contents

- [Before You Start](#before-you-start)
- [Choose a Contribution](#choose-a-contribution)
- [Definition of Done](#definition-of-done)
- [Development Setup](#development-setup)
- [Generation and Local Runtime](#generation-and-local-runtime)
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

## Choose a Contribution

You do not need an open issue to report a bug or correct a small documentation error. For code,
policy, prompt, or behavior changes, open or claim an issue first so the scope can be confirmed.

Use this menu to find work that matches your experience:

| Area                 | Starter-sized contribution                                                           | Primary location                                  | Evidence to include                  |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------ |
| Documentation        | Verify one setup flow on Windows, macOS, or Linux and fix inaccurate steps           | `README.md`, `docs/`                              | Commands and environment used        |
| MCP behavior         | Add a regression test for an existing tool, invalid input, or error message          | `packages/design-mcp`                             | Focused test output                  |
| Design contracts     | Improve validation for an existing public contract without inventing a parallel type | `packages/design-engine`                          | Passing and failing fixtures         |
| Prompts              | Add coverage for an existing prompt builder or serialization edge case               | `packages/prompts`                                | Updated golden fixture and rationale |
| Composition          | Add one focused composition rule with valid and invalid examples                     | `packages/composition-library`                    | Schema or unit tests                 |
| Design critique      | Add a deterministic lint rule tied to a documented taste principle                   | `packages/design-linter`, `packages/design-taste` | Finding fixture and tests            |
| Evaluation           | Add a representative benchmark brief or strengthen a deterministic check             | `packages/design-benchmark`, `benchmarks/`        | Before/after benchmark evidence      |
| Accessibility        | Fix a specific keyboard, focus, contrast, semantics, or reduced-motion problem       | `apps/studio`, `apps/preview`, `packages/ui`      | Manual steps and visual evidence     |
| Developer experience | Improve an actionable diagnostic or a package-level workflow                         | Owning package                                    | Reproduction before and after        |

Good first changes are narrow enough to explain in one or two sentences and validate in one
workspace. Avoid starting with a new cross-package abstraction, a new provider architecture, or an
entire roadmap milestone.

Browse [`good first issue`](https://github.com/7shep/universal/labels/good%20first%20issue) and
[`help wanted`](https://github.com/7shep/universal/labels/help%20wanted) for maintainer-scoped work.
If neither list contains a suitable task, open a
[contribution question](https://github.com/7shep/universal/issues/new?template=contribution_question.yml)
with your interests and proposed outcome.

## Definition of Done

Every contribution should:

- solve one clearly stated problem in the narrowest owning workspace;
- include tests when behavior, contracts, prompts, or rules change;
- update public documentation when commands or interfaces change;
- preserve compatibility or explain the intended break and migration;
- pass the relevant package checks; and
- avoid unrelated formatting, dependency, or refactoring changes.

User-interface changes should also include desktop and mobile evidence, keyboard verification, and
reduced-motion verification when motion is involved. A maintainer may request the full repository
gate for changes that affect shared contracts or multiple workspaces.

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

## Generation and Local Runtime

For the supported path from clean checkout through generation, immutable revisions, rendered QA, and evidence, read [docs/RUNTIME_CONTRIBUTOR_WORKFLOW.md](docs/RUNTIME_CONTRIBUTOR_WORKFLOW.md). It documents the pinned Playwright capture, explicit acceptance, and controlled export workflow from PR #75.

## Repository Guide

- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for request flows, dependency direction,
  implementation status, and detailed ownership guidance.
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
pnpm test
```

`pnpm test` is the complete automated test gate. It runs the maintained MCP,
design-linter, and design-taste policy suites.

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

Open a
[bug report](https://github.com/7shep/universal/issues/new?template=bug_report.yml)
and include:

- A clear description of the unexpected behavior
- Steps to reproduce it from a clean checkout when possible
- The expected behavior
- Node.js, pnpm, operating system, and browser versions as relevant
- Error output, stack traces, screenshots, or a minimal reproduction
- The affected app, package, or MCP tool

Remove secrets, tokens, private prompts, and personal data from logs before posting them publicly.

Security vulnerabilities should not be disclosed in a public issue. Follow
[SECURITY.md](SECURITY.md) to report them privately.

## Proposing Features

Open a
[feature request](https://github.com/7shep/universal/issues/new?template=feature_request.yml)
before implementing a substantial feature. Describe:

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

Be respectful, specific, and constructive. Discuss ideas and code rather than people. Assume good
intent, welcome contributors with different experience levels, and make technical disagreement
useful by explaining evidence and tradeoffs. All project interactions are governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing to Universal, you agree that your contributions will be licensed under the project's [MIT License](LICENSE.MD).
