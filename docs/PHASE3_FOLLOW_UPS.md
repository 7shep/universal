# Phase 3 Follow-up Roadmap

> Implementation status (2026-07-28): all items in this roadmap except required CI and branch
> protection are implemented and covered by package tests. The permanent benchmark lives at
> `benchmarks/design-quality/v2`; rendered QA, acceptance/export, and asset-policy contracts live in
> `packages/local-runtime` and `packages/generation`. CI and branch protection remain deliberately
> out of scope for this follow-up.

Phase 3 delivers the core local flow:

```text
arbitrary MCP design request
  -> model-authored React
  -> trusted generation/runtime pipeline
  -> immutable workspace
  -> local Vite
```

Phase 3.1 is intended to add proportional React architecture checks so generated projects use
pages, components, typed props, organized styles, and separated data where appropriate instead of
placing the complete implementation in `App.tsx`.

## Recommended order

### 1. Finish and review Phase 3.1

- Confirm monolithic multi-route projects fail.
- Confirm organized multi-route projects pass.
- Confirm small single-page projects are not over-componentized.
- Keep blocking architecture errors separate from advisory organization warnings.
- Ensure existing security, idempotency, immutable workspace, build, preview, and recovery behavior
  remains intact.

### 2. Add required CI and branch protection

At the time Phase 3 was merged, GitHub reported no Actions checks on the pull request. Add required
checks for:

- formatting
- lint
- typecheck
- unit and integration tests
- production builds
- Phase 3 end-to-end golden journey
- Phase 3.1 architecture fixtures

Require the checks before merging to `main`.

### 3. Establish a permanent design benchmark

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

## Resume point

When returning to this work:

1. Review and merge Phase 3.1 if its architecture policy and tests are sound.
2. Add required GitHub Actions checks and branch protection.
3. Create the stable multi-brief benchmark.
4. Implement rendered screenshot QA and an iterative revision loop as Phase 3.2.
