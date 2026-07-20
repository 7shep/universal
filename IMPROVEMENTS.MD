# Universal Improvement Plan

This document contains copy-paste prompts for parallel coding agents. The prompts are ordered by merge dependency, not just by roadmap milestone.

## How to run the plan

1. Give each agent exactly one prompt and its own Git worktree.
2. Create every worktree from the latest required merge gate stated in the prompt.
3. Agents should open draft pull requests early, keep changes inside their declared ownership boundary, and avoid editing shared contracts unless their prompt explicitly authorizes it.
4. Merge all parallel pull requests in a phase before starting that phase's integration gate.
5. Rebase or recreate downstream worktrees after each merge gate. Do not ask downstream agents to guess around unmerged APIs.
6. Preserve unrelated local changes. In particular, do not overwrite or revert the existing `pnpm-lock.yaml` change unless the assigned prompt explicitly resolves it.

The intended dependency order is:

```text
0A + 0B in parallel
        |
   Phase 0 merged
        |
1A + 1B + 1C in parallel
        |
       1D
        |
2A + 2B + 2C + 2D in parallel
        |
   Phase 3 integration
        |
4A + 4B + 4C + 4D in parallel
        |
5A + 5B + 5C + 5D as future tracks
```

## Shared instructions for every agent

Append the following expectations to every assignment when the agent system does not already provide them:

```text
Read AGENTS.md before changing files and obey all repository-local instructions. Inspect the existing implementation before proposing a replacement. Preserve unrelated user changes and do not use destructive Git commands.

Keep the PR focused on the assigned scope. If a required contract is missing, document the blocker instead of silently inventing a competing cross-package API. Add or update tests in proportion to the change. Run the narrowest relevant tests while developing, then run pnpm lint, pnpm typecheck, pnpm build, pnpm format:check, and the relevant package tests before handing off. If a repository-wide check fails for a pre-existing reason, report the exact failure and show that the changed scope passes.

For meaningful frontend design work, follow AGENTS.md: call create_design_plan before writing frontend code, call get_design_rules, treat the plan as the design source of truth, run the project, and submit the relevant React and CSS files to review_implementation before finishing. Address practical high-severity findings.

Open a draft PR with a concise summary, implementation notes, validation evidence, known limitations, and any follow-up work. Do not merge your own PR.
```

---

# Phase 0 — Stabilize the base

Phase 0A and 0B may run in parallel. Both must merge before Phase 1 begins.

## Prompt 0A — Repository hygiene and quality gates

**Branch:** `codex/stabilize-main`

```text
You are responsible for restoring a trustworthy clean-checkout baseline for Universal.

Start from the current main branch. Read AGENTS.md, CONTRIBUTING.md, package.json, turbo.json, eslint.config.js, .gitignore, .prettierignore, and the workspace package scripts. Inspect the current Git status before editing and preserve unrelated changes.

Current known problems:
- pnpm lint reports errors in tools/gstack-windows-preload.cjs.
- pnpm format:check attempts to traverse .gstack and can fail with EPERM.
- pnpm-lock.yaml contains an examples/demo-site importer while examples/* is ignored.
- .worktrees/ is untracked even though Git worktrees are stored there.
- There is no single root test command covering the MCP, design-linter, and design-taste suites.

Implement a focused repair:
1. Configure ESLint correctly for the CommonJS preload tool or exclude it for a documented reason. Do not weaken linting for product source.
2. Make formatting checks deterministic without scanning dependencies, worktrees, generated output, inaccessible tool state, or other non-product directories.
3. Decide and implement a coherent policy for examples/demo-site. Prefer tracking its source and configuration while ignoring node_modules, dist, logs, caches, and tsbuildinfo. Make the lockfile consistent with that policy.
4. Ignore the repository's .worktrees storage directory. Do not delete worktrees or branches.
5. Add a root test script that runs every maintained package test suite and wire it into Turbo only if doing so remains simple and deterministic.
6. Confirm a fresh contributor can discover and run the full quality gate from README.md or CONTRIBUTING.md.

Acceptance criteria:
- pnpm lint passes.
- pnpm format:check passes.
- pnpm test passes and includes MCP, linter, and taste-policy tests.
- pnpm typecheck passes.
- pnpm build passes.
- Git ignores generated and worktree content while retaining intended example source.
- No existing worktree or unrelated user file is removed.

Keep this PR limited to tooling, repository hygiene, documentation directly related to checks, and the necessary lockfile reconciliation. Open a draft PR and report every command executed.
```

## Prompt 0B — Local runtime architecture decision

**Branch:** `codex/local-runtime-adr`

```text
You are the architecture agent for Universal's local-only product runtime. Produce a concrete, implementable architecture decision record; do not build the runtime in this PR.

Start from main and read ROADMAP.md, PRODUCT.md, README.md, docs/CODEX_MCP_SETUP.md, the Studio and Preview apps, packages/shared, packages/design-engine, packages/design-mcp, and the GeneratedProject and DesignPlan contracts.

Resolve the ambiguity between "no backend" and the need to generate files, invoke models, compile projects, and serve previews. Treat "no backend" as no hosted or persistent remote service unless repository evidence strongly contradicts that interpretation.

The ADR must decide:
1. How the browser-based Studio communicates with local orchestration.
2. Which responsibilities belong to design-engine, design-mcp, a local runtime, Studio, and Preview.
3. How model providers and credentials are configured without exposing secrets to browser bundles.
4. How generated files are materialized in an isolated, safe workspace.
5. How builds are started, stopped, timed out, diagnosed, and cleaned up.
6. How Preview receives a generated project URL and reload notifications.
7. Stable identifiers and lifecycle states for brief, plan, direction, project, variant, section, build, review, and revision.
8. The message/API contracts needed by the Phase 2 agents.
9. Threat boundaries: path traversal, arbitrary scripts, network access, secret leakage, iframe isolation, and untrusted generated code.
10. What remains deliberately out of scope for the MVP.

Include a component diagram, one end-to-end sequence, alternatives considered, tradeoffs, failure handling, and an incremental implementation plan. Prefer TypeScript-friendly interfaces and local protocols that can be tested without a real model provider.

Acceptance criteria:
- The ADR gives downstream agents one unambiguous architecture.
- It preserves the product's local-first and no-hosted-backend constraints.
- It defines enough stable contracts for generator, runtime, Studio, and Preview work to proceed independently after Phase 1.
- It does not introduce production code or speculative dependencies.

Open a draft documentation-only PR and call out any roadmap wording that should be clarified later.
```

---

# Phase 1 — Make the design engine canonical

Begin only after both Phase 0 pull requests are merged. Prompts 1A, 1B, and 1C may run in parallel from that merged base. Prompt 1D waits for all three.

## Prompt 1A — Consolidate the design engine

**Branch:** `codex/implement-design-engine`

```text
Make @universal/design-engine the canonical owner of design-plan development.

Read the merged runtime ADR, packages/design-engine, packages/design-mcp/src/design.ts, packages/design-mcp/src/presets.ts, packages/design-taste, packages/design-linter, packages/shared, and all current MCP tests.

Today, design-mcp contains the working planning algorithm while createDesignEngine().develop() throws. Correct that boundary without changing the external behavior unnecessarily.

Implement:
1. Move or refactor plan-development orchestration into design-engine.
2. Define injected provider interfaces for any model-backed planning so tests and offline development can use a deterministic provider.
3. Preserve deterministic preset, composition, taste, motion, and avoidance behavior currently covered by MCP tests.
4. Make composition history explicit state or injected storage; remove process-global history from the transport layer.
5. Keep design-mcp as a thin adapter that validates MCP input and serializes engine output.
6. Replace the throwing createDesignEngine implementation with a usable, dependency-injected implementation.
7. Preserve validateDesignPlan as a trust boundary for provider or serialized output.
8. Add focused design-engine unit tests and update MCP tests to verify delegation rather than duplicate domain behavior.

Ownership boundary:
- You may edit design-engine and the minimum MCP files needed to delegate.
- Do not redesign prompt versioning; Agent 1B owns prompts.
- Do not redesign composition schemas; Agent 1C owns catalog validation.
- If those future APIs are needed, use narrow internal adapters that can be replaced in Prompt 1D.

Acceptance criteria:
- No public default engine method immediately throws "not implemented."
- Planning logic is usable without MCP.
- MCP behavior and its public tools remain compatible.
- Deterministic tests do not require network access or real credentials.
- State does not leak unpredictably between concurrent sessions or tests.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR with a short migration map showing which responsibilities moved from MCP to the engine.
```

## Prompt 1B — Typed, versioned prompt system

**Branch:** `codex/version-prompts`

```text
Turn @universal/prompts from a single interpolation helper into a typed, versioned prompt assembly package.

Read the merged runtime ADR, packages/prompts, DesignPlan and composition contracts, taste policy, MCP planning behavior, and roadmap requirements for direction, generation, critique, and revision.

Implement:
1. Separate prompt definitions for design direction, React generation, implementation critique, and section revision.
2. Give every template a stable ID, semantic or monotonic version, purpose, typed input contract, and documented output expectation.
3. Validate required variables and reject unresolved placeholders with actionable errors.
4. Add prompt builders that serialize composition regions, navigation, design tokens, taste decisions, prohibited patterns, accessibility requirements, and reduced-motion behavior consistently.
5. Keep provider-specific chat/message formatting outside the core template definitions.
6. Add a lightweight migration/deprecation policy for saved prompt references.
7. Add unit tests and readable golden fixtures that make accidental prompt changes visible in review.

Ownership boundary:
- Restrict production changes to packages/prompts and test fixtures unless a tiny shared type export is essential.
- Do not move the engine or MCP orchestration; Agent 1A owns that.
- Do not alter composition catalog semantics; Agent 1C owns that.

Acceptance criteria:
- Missing template inputs fail explicitly.
- All four prompt purposes are represented and tested.
- Prompt output preserves the design plan's spatial and taste constraints.
- Templates can be referenced by stable ID and version.
- Tests do not call an external model.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR and include one rendered example for each prompt purpose in the PR description.
```

## Prompt 1C — Composition catalog validation and stable identity

**Branch:** `codex/validate-compositions`

```text
Harden @universal/composition-library into a validated domain catalog suitable for generation, revision, and variants.

Read the merged runtime ADR, packages/composition-library, design-engine plan contracts, MCP composition selection, linter signature extraction, and existing tests.

Implement:
1. Runtime validation for hero archetypes, navigation definitions, spatial regions, composition contracts, and composition signatures.
2. Catalog invariant tests for unique IDs, valid navigation references, required regions, non-empty prohibited patterns, compatible presets, and valid content order.
3. Stable identifiers for sections and regions that can survive generation and targeted revision.
4. A deterministic selection API that accepts the brief, seed, recent signatures, and explicit history instead of relying on hidden mutable state.
5. Tests for signature similarity boundaries, deterministic selection, fallback behavior, and malformed catalogs.
6. Clear serialization-friendly types for downstream generator and persistence work.

Ownership boundary:
- Keep changes inside composition-library and its direct tests where possible.
- Do not reimplement the engine orchestration or prompt builders.
- Preserve current catalog intent and existing public IDs unless a migration is documented.

Acceptance criteria:
- The shipped catalog validates at test time.
- Duplicate or dangling IDs fail with useful messages.
- Selection is deterministic for a fixed input and history.
- Section/region identity is suitable for the later revision loop.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR and describe any compatibility changes to existing signatures.
```

## Prompt 1D — Canonical public API integration

**Branch:** `codex/integrate-engine-api`

**Dependency:** Start only after 1A, 1B, and 1C are merged.

```text
Integrate the newly merged engine, prompt, and composition work into one stable public orchestration API for downstream product agents.

Read the runtime ADR and review the merged changes from Phase 1A, 1B, and 1C. This is an integration PR, not an opportunity to redesign each package.

Implement:
1. One canonical API for developing and validating a design plan.
2. Thin MCP tool handlers that delegate to that API.
3. Explicit session/history inputs and outputs.
4. Stable serialized fixtures for brief, plan, direction, project request, and review context.
5. Public exports needed by the generator, local runtime, Studio, and Preview agents.
6. Contract tests proving the fixtures validate and round-trip.
7. Removal of obsolete deprecated types or duplicate code only when migration is safe and obvious.

Acceptance criteria:
- There is exactly one domain implementation of plan development.
- MCP remains compatible and all MCP tests pass.
- Downstream agents can build against checked-in fixtures without importing MCP internals.
- No hidden process-global state is required.
- Full lint, test, typecheck, build, and format checks pass.

Open a draft PR with a concise downstream API guide. After this PR merges, Phase 2 branches must start from the new main commit.
```

---

# Phase 2 — Parallel product tracks

Start all four prompts only after Prompt 1D is merged. Each track should stay within its ownership boundary so the work can merge with minimal conflicts.

## Prompt 2A — React project generator

**Branch:** `codex/react-generator`

```text
Build the first production-shaped React project generator for Universal.

Read the runtime ADR, canonical Phase 1 API, prompt builders, GeneratedProject contract, design-plan fixtures, example demo site, roadmap requirements, and workspace conventions.

Create a dedicated generator package that:
1. Accepts a validated DesignPlan plus content and generation options.
2. Uses an injected generation provider so tests require no external model.
3. Produces a complete React + Vite + TypeScript project. Follow the roadmap's Tailwind requirement unless the merged ADR deliberately revised it.
4. Emits a manifest containing entrypoint, files, plan ID, section-to-file/component mapping, template version, and diagnostics.
5. Validates paths, required files, duplicate files, unresolved placeholders, and output size limits.
6. Preserves stable section IDs in generated markup or metadata for later targeted revision.
7. Includes deterministic fixture providers and golden generated projects.
8. Proves at least one generated fixture compiles successfully.

Ownership boundary:
- Own the new generator package and its tests/fixtures.
- Do not implement process management or preview serving; Agent 2B owns runtime execution.
- Do not implement Studio UI; Agent 2D owns it.
- Consume canonical contracts without altering them unless blocked; document any required contract change for integration.

Acceptance criteria:
- A validated fixture plan produces a complete GeneratedProject.
- The output compiles from a clean fixture environment.
- Invalid or unsafe paths are rejected.
- Generation is testable without credentials or network access.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR with the generated fixture tree and compilation evidence.
```

## Prompt 2B — Local project runtime

**Branch:** `codex/project-runtime`

```text
Implement Universal's safe local runtime for materializing and building generated projects.

Read the runtime ADR, canonical contracts and fixtures, GeneratedProject type, workspace scripts, and security constraints. Do not depend on Agent 2A's unmerged code; build against the merged fixtures and interfaces.

Implement a dedicated runtime package or local service that:
1. Accepts a validated GeneratedProject and creates an isolated project workspace.
2. Prevents absolute paths, parent traversal, symlink escapes, and writes outside the assigned root.
3. Runs an explicit allowlisted install/build/dev lifecycle consistent with the ADR.
4. Exposes lifecycle states, structured diagnostics, logs, preview URL, cancellation, timeout, and cleanup.
5. Handles port allocation and concurrent projects deterministically.
6. Does not expose model credentials or parent-process secrets to generated browser code.
7. Supports dependency injection/fakes for unit tests.
8. Adds integration tests using checked-in fixture projects.

Ownership boundary:
- Own runtime/service code and tests.
- Do not build Preview UI or Studio UI.
- Do not create a competing GeneratedProject contract.

Acceptance criteria:
- A fixture project can be materialized and built.
- Traversal and malformed file tests fail safely.
- A running project can be cancelled and cleaned up.
- Failures produce structured, user-presentable diagnostics.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR with a threat-model checklist and lifecycle test evidence.
```

## Prompt 2C — Live Preview application and protocol

**Branch:** `codex/live-preview`

```text
Turn apps/preview into a real isolated preview surface using the protocol defined by the merged ADR and Phase 1 contracts.

This is meaningful frontend work: follow AGENTS.md, create a design plan, retrieve design rules, run the app, and submit the React/CSS implementation for review before finishing.

Implement:
1. A typed message protocol for loading a preview URL/project identity, build state, reload events, viewport selection, and runtime errors.
2. An iframe-based preview with appropriate sandboxing and an explicit rationale for every granted capability.
3. Loading, building, ready, stale, crashed, and unavailable states.
4. Desktop and mobile viewport controls without pretending to emulate an entire browser.
5. Manual reload and automatic refresh while preserving useful error information.
6. Keyboard accessibility, visible focus, reduced-motion behavior, and responsive layout.
7. Unit/component tests for protocol validation and state transitions.

Ownership boundary:
- Own apps/preview and a narrowly scoped shared protocol module if already authorized by the ADR.
- Use fixture messages; do not implement process execution or Studio orchestration.
- Avoid editing canonical engine contracts.

Acceptance criteria:
- Preview can load a fixture URL through the typed protocol.
- Invalid origins/messages are ignored or rejected safely.
- Every runtime lifecycle state has a useful UI.
- Desktop and mobile views work with keyboard controls.
- Design review has no unresolved high-severity findings.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR with desktop/mobile screenshots and protocol examples.
```

## Prompt 2D — Studio design-direction flow

**Branch:** `codex/studio-direction-flow`

```text
Turn apps/studio from its disabled foundation screen into a complete brief-to-direction selection experience. Stop at the generation boundary; Phase 3 will connect project generation and preview.

This is meaningful frontend work: follow AGENTS.md, create a design plan, retrieve design rules, run the app, and submit the React/CSS implementation for review before finishing.

Read PRODUCT.md, the runtime ADR, canonical API fixtures, taste and composition contracts, and the existing Studio app.

Implement:
1. A controlled brief form with prompt, website type, preferences, avoid constraints, and optional motion intent.
2. Validation, submitting, success, empty, failure, and retry states.
3. A direction inspector that makes thesis, key decisions, typography/color rationale, composition regions, navigation, motion, accessibility, and prohibited patterns legible.
4. Direction selection and a disabled-but-explained handoff point for generation.
5. A small typed client boundary backed by fixtures/fakes rather than importing Node-only runtime code into the browser.
6. Responsive behavior, keyboard navigation, visible focus, and reduced-motion support.
7. Tests for form state and direction selection.

Ownership boundary:
- Own apps/studio and minimal shared UI primitives.
- Do not implement the real generator, runtime process management, or Preview internals.
- Do not create alternate design-plan types.

Acceptance criteria:
- A user can submit a fixture brief, inspect a returned direction, and select it.
- The interface communicates design decisions instead of dumping raw JSON.
- All failure and empty states are usable.
- Design review has no unresolved high-severity findings.
- Relevant tests, typecheck, build, lint, and formatting pass.

Open a draft PR with desktop/mobile screenshots and a state inventory.
```

---

# Phase 3 — End-to-end vertical slice

This phase is sequential. Start only after all four Phase 2 pull requests are merged.

## Prompt 3 — Integrate brief to reviewed preview

**Branch:** `codex/end-to-end-generation`

```text
Create Universal's first complete end-to-end product slice by integrating the merged engine, generator, local runtime, Studio, Preview, and linter work.

Start from main only after Phase 2A, 2B, 2C, and 2D are merged. Read every merged handoff note and the runtime ADR before editing. This PR owns cross-package wiring and may resolve small interface mismatches, but it should not rewrite working packages.

Implement the complete flow:
1. User enters and submits a brief in Studio.
2. Local orchestration develops and validates a direction.
3. User inspects and selects the direction.
4. Generator produces a complete project.
5. Runtime materializes and builds it.
6. Preview receives the URL and displays it in the iframe.
7. Source and available visual evidence are submitted to the design linter.
8. Studio displays actionable critique and distinguishes warnings from blocking errors.
9. The user can retry recoverable planning, generation, build, preview, and review failures.
10. Cancellation and cleanup occur when a run is replaced or the app exits.

Add an end-to-end fixture path that uses deterministic providers and no external credentials. Add integration tests for the happy path and at least planning failure, invalid generated output, build failure, and preview failure.

For all frontend integration changes, follow AGENTS.md and repeat implementation review on the final relevant React/CSS files.

Acceptance criteria:
- A clean checkout can run one documented command and complete the deterministic end-to-end demo.
- The generated fixture compiles and renders in Preview.
- The linter report is visible and actionable.
- Errors retain diagnostics and do not strand child processes or temporary workspaces.
- README documents setup, run, test, and architecture at the correct level.
- Full lint, test, typecheck, build, and format checks pass.

Open a draft PR with a short screen recording or screenshots, the exact demo steps, and the end-to-end test evidence. This merge is the prerequisite for every Phase 4 prompt.
```

---

# Phase 4 — Product capabilities

Start only after Phase 3 is merged. All four prompts may run in parallel, but agents must avoid broad edits to the same Studio files. Prefer feature modules with narrow integration points.

## Prompt 4A — Targeted section revision loop

**Branch:** `codex/section-revision-loop`

```text
Implement targeted section revision without regenerating the entire project.

Read the canonical section identity, generator manifest, prompt revision templates, project runtime, and Phase 3 integration. Preserve the selected design plan's global intent.

Implement:
1. Selection of a generated section by stable ID.
2. A revision request containing instruction, current section source, relevant plan context, and protected constraints.
3. An injected revision provider with deterministic test fixtures.
4. Validation that only allowed section files or ranges changed.
5. Rebuild and preview refresh after an accepted revision.
6. Source diff, review findings, accept/reject, and rollback.
7. History metadata linking the revision to its parent project.

Acceptance criteria:
- Revising one fixture section leaves unrelated files byte-for-byte unchanged.
- Invalid broad rewrites are rejected.
- Accept, reject, rollback, build failure, and review failure are tested.
- The UI is accessible and reviewed under AGENTS.md.
- Full relevant checks pass.

Open a draft PR with a before/after diff and proof that unrelated sections were preserved.
```

## Prompt 4B — Three design variants and comparison

**Branch:** `codex/design-variants`

```text
Implement generation and comparison of three deliberately distinct design directions: A, B, and C.

Read the canonical planning API, composition signature/history behavior, generator, Studio direction inspector, and Phase 3 flow.

Implement:
1. A variant request that produces three deterministic but distinct seeds/directions.
2. Similarity constraints that discourage repeated hero, navigation, section sequence, and preset combinations.
3. Independent lifecycle state for each variant so one failure does not erase successful variants.
4. Side-by-side plan comparison first, then preview comparison when builds are ready.
5. Clear explanation of meaningful differences rather than cosmetic labels.
6. Selection of one variant as the active project while retaining provenance.
7. Tests for determinism, diversity thresholds, partial failure, and selection.

Acceptance criteria:
- Fixture inputs reliably produce three valid, meaningfully distinct plans.
- Comparison works on practical laptop and mobile widths.
- Selecting a variant carries the correct plan/project identity forward.
- The UI is accessible and reviewed under AGENTS.md.
- Full relevant checks pass.

Open a draft PR with the three fixture signatures and comparison screenshots.
```

## Prompt 4C — Automated visual QA and evidence capture

**Branch:** `codex/automated-visual-qa`

```text
Automate the visual evidence required by Universal's design linter.

Read the Preview protocol, runtime lifecycle, design-linter VisualEvidence contract, taste policy, and Phase 3 review flow.

Implement:
1. Deterministic desktop and mobile screenshot capture after Preview reaches ready state.
2. Readiness, timeout, font/image loading, and animation-settling rules.
3. Automated checks for blank or unexpectedly empty regions, missing media/marks, overflow, and runtime error overlays.
4. Basic accessibility checks appropriate to the local toolchain.
5. Reduced-motion capture behavior.
6. Conversion of capture observations into the existing VisualEvidence contract.
7. Artifact paths and retention/cleanup rules that do not pollute Git.
8. Tests using stable fixture pages, including a deliberately broken page.

Acceptance criteria:
- A review can receive desktop and mobile evidence without manual user claims.
- Missing assets and blank fixture regions are reported.
- Capture failure is explicit and cannot silently become a passing review.
- Artifacts are isolated and cleaned according to policy.
- Full relevant checks pass.

Open a draft PR with representative artifacts and the resulting linter reports.
```

## Prompt 4D — Local history, persistence, and recovery

**Branch:** `codex/local-history`

```text
Implement local persistence and recovery for Universal sessions.

Read the runtime ADR, canonical identifiers, Phase 3 lifecycle, variant and revision contracts, and product privacy constraints.

Implement:
1. A versioned local schema for briefs, plans, selected directions, generated projects, builds, reviews, variants, and revisions.
2. Explicit repository/workspace scoping so composition history is not global process state.
3. Atomic writes and recovery from interrupted or partially written state.
4. Schema migrations and safe handling of unknown future fields.
5. Retention, delete, and cleanup operations.
6. A recent-projects/reopen experience with clear missing-artifact states.
7. Tests for round-trip persistence, migration, corruption, deletion, and concurrent updates.

Do not introduce authentication, cloud sync, telemetry, or a remote database.

Acceptance criteria:
- A completed fixture session survives restart and reopens correctly.
- Corrupt state produces a recoverable diagnostic rather than crashing Studio.
- History is scoped to the intended workspace.
- Delete and cleanup remove only the selected Universal-owned data.
- The UI is accessible and reviewed under AGENTS.md.
- Full relevant checks pass.

Open a draft PR with the schema versioning strategy and recovery test evidence.
```

---

# Phase 5 — Future roadmap tracks

These are post-MVP prompts. Start them only after the Phase 4 capabilities they depend on are merged and stable.

## Prompt 5A — Screenshot critique

**Branch:** `codex/screenshot-critique`

```text
Implement screenshot-based critique as an extension of the existing visual QA and linter pipeline.

Depend on automated visual evidence from Phase 4C. Accept uploaded or captured screenshots with viewport metadata, validate file type and size, and use an injected vision-capable critique provider. Produce structured findings mapped to Universal taste principles, composition rules, accessibility concerns, and actionable implementation suggestions. Keep critique separate from automatic source mutation. Add deterministic provider fixtures, upload error states, privacy guidance, and tests. Follow AGENTS.md for frontend work and open a draft PR with sample input/output evidence.
```

## Prompt 5B — Component inspector

**Branch:** `codex/component-inspector`

```text
Implement click-to-component inspection for generated previews.

Depend on stable section IDs, the generator manifest, Preview protocol, and revision loop. Add safe instrumentation that maps a clicked preview element to its generated component/file and stable section identity without exposing arbitrary filesystem access. Show component metadata in Studio and allow the user to start a scoped revision. Test nested elements, missing mappings, stale builds, cross-origin protection, and source-map failure. Follow AGENTS.md for frontend work and open a draft PR with an end-to-end mapping demonstration.
```

## Prompt 5C — Installable style packs

**Branch:** `codex/style-packs`

```text
Design and implement a versioned style-pack system for installable design philosophies.

Depend on prompt versioning, taste profiles, composition validation, and local persistence. Define a manifest, compatibility rules, provenance, validation, installation/removal, conflict resolution, and migration behavior. Style packs may contribute taste guidance, prompt fragments, tokens, composition preferences, and anti-patterns, but must not execute arbitrary code. Include two clearly original example packs; do not imitate a named company's protected visual identity. Add validation, security tests, and documentation. Open a draft PR with manifest examples and compatibility evidence.
```

## Prompt 5D — Multi-agent design review

**Branch:** `codex/multi-agent-design-review`

```text
Implement structured multi-critic design review after the single-review and visual-evidence pipelines are stable.

Create injected critic roles for typography, motion, accessibility, brand, composition, and implementation craft. Run independent critiques concurrently, normalize them into the existing finding contract, deduplicate overlapping findings, identify disagreements, and produce a final prioritized synthesis with provenance. Do not allow critics to mutate source automatically. Add deterministic fixtures, timeout/partial-failure behavior, cost limits, and tests for conflicting recommendations. Open a draft PR with the raw critic outputs and synthesized fixture report.
```

---

# Final release gate

Use this prompt after completing any major phase:

```text
Audit the just-merged Universal phase as a release gate. Do not add new product scope.

From a clean main checkout:
1. Inspect Git status and workspace configuration.
2. Install dependencies using the documented workflow if needed.
3. Run pnpm lint, pnpm test, pnpm typecheck, pnpm build, and pnpm format:check.
4. Run the phase's documented deterministic demo from a clean state.
5. Verify README and architecture documentation match actual commands and behavior.
6. Check that generated output, screenshots, temporary projects, credentials, logs, and worktrees are ignored appropriately.
7. Report regressions with exact reproduction steps and severity.
8. Fix only release-blocking defects clearly caused by the phase; put unrelated improvements in follow-up issues.

Open a focused release-gate PR only if fixes are required. Otherwise publish a validation report and recommend whether the next phase may begin.
```
