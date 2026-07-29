# Phase 3 Follow-up Closeout

> Completion status (2026-07-29): every item in this roadmap is implemented and covered by package
> tests. Repository CI runs the full quality gate plus a dedicated trusted-runtime/security gate,
> and `main` requires both checks to be strict and up to date before merge.

Phase 3 delivers the core local flow:

```text
arbitrary MCP design request
  -> model-authored React
  -> trusted generation/runtime pipeline
  -> immutable workspace
  -> local Vite
```

Phase 3.1 added proportional React architecture checks so generated projects use pages, components,
typed props, organized styles, and separated data where appropriate instead of placing the complete
implementation in `App.tsx`.

## Completion record

### 1. Finish and review Phase 3.1

Status: complete.

- Confirm monolithic multi-route projects fail.
- Confirm organized multi-route projects pass.
- Confirm small single-page projects are not over-componentized.
- Keep blocking architecture errors separate from advisory organization warnings.
- Ensure existing security, idempotency, immutable workspace, build, preview, and recovery behavior
  remains intact.

### 2. Add required CI and branch protection

Status: complete. GitHub Actions now covers:

- formatting
- lint
- typecheck
- unit and integration tests
- production builds
- Phase 3 end-to-end golden journey
- Phase 3.1 architecture fixtures

`main` requires the strict, up-to-date `Quality gate` and `Trusted runtime and security` checks,
resolved review conversations, and disallows force pushes and branch deletion.

### 3. Establish a permanent design benchmark

Status: complete. The permanent suite lives at `benchmarks/design-quality/v2`.

Maintain six to ten deliberately different briefs:

- luxury product
- editorial publication
- technical developer tool
- playful consumer brand
- data-heavy dashboard
- multi-page cultural archive
- minimal portfolio
- mobile-first product

Record results for:

- visual originality
- Design Plan v2 fidelity
- responsive behavior
- route and content completeness
- accessibility
- repository organization
- build success
- runtime-policy compliance

Keep representative successful and failed results so future changes can be compared against a
stable baseline instead of one showcase website.

### 4. Stress-test the trust boundary

Status: complete. Runtime and generation fixtures cover the listed failure classes with structured
diagnostics and recovery behavior.

Exercise intentional failures and confirm every result is structured, understandable, and
recoverable:

- submit a runtime-owned `package.json`
- add an external `fetch` or other outbound network access
- include credential-shaped content
- submit absolute paths or path traversal
- create case-folding filename collisions
- exceed file or total-size quotas
- omit an approved route
- submit invalid TypeScript
- reuse a request ID with different source
- retry a failed immutable revision with a new request ID

### 5. Phase 3.2: rendered QA and revision loop

Status: complete for the bounded Phase 3.2 scope.

The highest-value quality improvement after architecture enforcement is:

```text
generate
  -> build
  -> launch on loopback
  -> capture desktop and mobile screenshots
  -> inspect rendered problems
  -> revise source
  -> rebuild
  -> compare
```

Rendered QA should detect or record:

- clipping and horizontal overflow
- unreadable typography
- broken responsive layouts
- unearned empty regions
- missing media or brand marks
- weak hierarchy
- route-specific visual regressions
- focus and reduced-motion behavior

Keep machine-verifiable evidence separate from subjective human visual judgment.

### 6. Promote an accepted revision into a normal repository

Status: complete through the explicit acceptance/export contracts and runtime flow.

Add an explicit acceptance/export workflow:

```text
trusted immutable revision
  -> user accepts
  -> export into a controlled destination
  -> continue normal Git-based development
```

Generation must remain unable to select arbitrary filesystem destinations. Promotion should be a
separate user-authorized operation that preserves provenance and the reviewed revision identity.

### 7. Add a controlled asset pipeline

Status: complete for provenance-aware generated raster assets, local fonts, SVGs, icons, responsive
variants, optimization metadata, and policy enforcement.

Consider safe support for:

- generated raster images
- local fonts
- SVG illustrations
- project icons
- responsive image variants
- optimization
- attribution and provenance

The model should not gain control over dependencies, arbitrary downloads, build configuration, or
runtime commands.

## Important boundary

The immutable build pipeline and isolated Preview are security boundaries. The returned local Vite
server is a developer convenience and should not be described as an isolated browser-execution
boundary unless equivalent CSP and network restrictions are added.

## Closeout verification

The post-merge audit ran from a clean `main` worktree and passed:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`, including the deterministic Phase 3 golden journey and trusted-runtime coverage

No Phase 4 capability was started during closeout. Remaining product work is tracked in
[`IMPROVEMENTS.MD`](../IMPROVEMENTS.MD).
