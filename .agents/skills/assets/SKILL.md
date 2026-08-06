---
name: assets
description: Audits imagery, icons, illustrations, and other visual assets in a Universal website or React interface for quality, consistency, relevance, performance, and accessibility. Default mode is audit-only and read-only. Replaces or generates assets only on explicit authorization, and every added or replaced asset must carry recorded provenance/licensing — assets of unknown license are refused. Never imitates a named brand's protected visual identity.
---

# /assets

Audit the visual-asset layer of an existing route, component, or directory — photography,
illustration, iconography, logos/marks the project itself owns, decorative graphics, and any other
non-text visual asset. **Default mode is audit-only: read, evaluate, and report.** This skill
mutates source only when the invocation explicitly authorizes a specific change (see
[Authorization for mutation](#authorization-for-mutation)) — never as a side effect of an audit.

`$ARGUMENTS` names the scope (a route, component, directory, or specific asset path) and, when the
caller wants mutation, an explicit authorization plus what's authorized — for example
`apps/studio/src/routes/Preview` (audit only), `packages/ui icons — audit only`, or
`frontend/src/pages/Home hero image — replace with frontend/src/assets/hero-v2.jpg (license: CC0,
source: openverse.org, credited to <author>), authorized`. If empty, ask which scope to audit rather
than guessing at the whole repository. If mutation language is present but incomplete (no concrete
replacement asset, no license/provenance information, or no explicit authorization word such as
"replace", "generate", "swap in", or "authorized"), treat the request as audit-only and ask for the
missing piece before touching anything.

## Non-negotiables

- **Audit-only by default.** No `Edit`, `Write`, `NotebookEdit`, formatter, `git add`, `git commit`,
  or `git push` unless the current invocation carries explicit mutation authorization for a specific
  asset or fix, scoped exactly as authorized. An audit-only invocation stays as strictly read-only as
  `/audit`.
- **Provenance and licensing are mandatory for every asset this skill adds or replaces.** Before
  writing any new or replacement asset into the project, record: source/origin, license (name and
  scope, e.g. "CC0", "MIT-licensed icon set", "commissioned, all rights reserved to the project"),
  and attribution requirements if any. **Refuse to add any asset whose license is unknown, unstated,
  or unverifiable** — report it as blocked and explain what information is missing instead of
  guessing or proceeding anyway.
- **Never imitate a named brand's protected visual identity.** Per `AGENTS.md`'s visual quality
  principles, do not reproduce or closely mimic another company's logo, trade dress, icon set, or
  distinctive visual identity — whether by generating a lookalike or by sourcing one. Flag any
  existing asset in the audited scope that appears to do this as a high-severity finding regardless
  of mutation mode.
- **No Universal MCP tool generates or edits image content.** As of this skill's writing,
  `docs/MCP_REFERENCE.md` documents 16 Universal MCP tools and none of them creates, edits, or
  fetches image/icon/illustration assets — the closest tools are `get_design_rules` (imagery
  category), `get_taste_profile`, and `review_implementation`, all of which return text guidance or
  critique, not pixels. Do not invent an image-generation tool name. Verify this against a current
  read of `docs/MCP_REFERENCE.md` before ever telling a user Universal can generate an asset via MCP;
  if a future version of that file documents a real image-generation tool, use it by its exact
  documented name and shape instead of assuming this limitation is permanent. Until then, "generate"
  requests can only be fulfilled by a user-supplied asset file with recorded provenance, or reported
  as unsupported.
- Only call MCP tools that exist for this task: `get_design_rules`, `get_taste_profile`, and
  `review_implementation`. Do not attempt the stateful Phase 2 Art Director sequence — that belongs
  to `/art-direct`.
- Preserve everything not explicitly in scope: behavior, state, routes, APIs, unrelated assets, and
  any unrelated local changes already in the working tree.
- Never claim a screenshot, dimension check, or file inspection happened when it didn't.

## Workflow

### 1. Resolve scope and mode

Interpret `$ARGUMENTS` as a route, component, directory, or specific asset path, plus a mode:
**audit** (default) or **authorized mutation** (only when the conditions in
[Authorization for mutation](#authorization-for-mutation) are met for specific assets). State the
resolved scope and mode back before doing anything else.

### 2. Discover the asset inventory

Use `Glob`/`Grep`, within the resolved scope, to find:

- raster/vector image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.svg`, `.gif`) referenced by
  or co-located with the scope;
- icon usage — inline SVG components, an icon library import (e.g. a single package or a project-local
  icon set), or hand-rolled icon components;
- `<img>`, CSS `background-image`, `next/image`-style, or React asset-import usages, including their
  `alt`, `role`, `aria-hidden`, `loading`, `width`/`height`, and `srcset`/`sizes` attributes;
- illustration or decorative-graphic components;
- any asset manifest, licensing note, or attribution file already in the repository (e.g. a
  `LICENSES` file, a comment block, or a credits page) that documents existing provenance.

Read only what the scope actually touches; if the scope is broad, sample representative assets and
say so rather than silently reading everything.

### 3. Gather available evidence

Collect whatever already exists — do not manufacture any of it:

- **Existing screenshots** relevant to the scope, at whatever locations the repository or user names.
- **Fresh desktop/mobile screenshots**, only if capture tooling is already available and wired up
  (e.g. the `/browse` skill, or a Playwright/Puppeteer setup already in the repo), invoked read-only
  against an already-running or trivially startable dev server. If unavailable, record "no
  screenshot tooling available" and continue with source-only inspection.
- **File-level facts** you can check directly: file size on disk, declared dimensions vs. rendered
  dimensions in markup/CSS, format, and whether a modern format (`webp`/`avif`) or responsive sources
  (`srcset`, `<picture>`, `sizes`) exist alongside a legacy fallback.
- **Design context**, if already committed or present in the conversation: a design plan, creative
  brief, selected direction, or taste profile export.

### 4. Retrieve Universal's design intelligence

Call, when the MCP is connected:

- `get_design_rules` with `category: "imagery"` — use its `imagePrinciples`, `categoryPrinciples`,
  `antiPatterns`, and `implementationConstraints` as the deterministic backbone for findings.
- `get_taste_profile` for the active taste policy's `principles` (filtering to `appliesTo: "imagery"`)
  and `antiPatterns` — cite the specific principle or anti-pattern ID a finding is based on.
- `review_implementation`, when the scope includes React/CSS that renders the audited assets, shaped
  per [`docs/MCP_REFERENCE.md#review_implementation`](../../../docs/MCP_REFERENCE.md#review_implementation),
  to catch generic-pattern or composition findings that touch imagery.

If the MCP is unavailable, say so explicitly and fall back to `AGENTS.md`'s visual quality
principles and this skill's own checklist below. A fact you locally verified (a missing `alt`
attribute, a raster file over a stated size threshold, an icon import from two different icon
packages in the same view) stays deterministic even without MCP; only findings that need Universal's
taste-policy judgment are downgraded to `judgment` and noted as MCP-unsupported.

### 5. Build findings across all five audit dimensions

Cover, wherever the scope and evidence make it relevant — see
[reference/asset-audit-schema.md](reference/asset-audit-schema.md) for the full field list, worked
examples, and severity rubric:

- **Quality** — visible compression artifacts, upscaling/blur, inconsistent art style or rendering
  fidelity between assets used together, low-resolution assets stretched beyond their native size.
- **Consistency** — icons drawn from more than one family/library in the same view (mixed stroke
  weight, corner radius, or fill style counts as inconsistent even if visually similar); illustration
  style drift across a set that should read as one system; inconsistent aspect-ratio or crop
  treatment across a repeated pattern (e.g. card thumbnails).
- **Relevance** — an asset that doesn't support the actual content/intent next to it, a stock-photo
  feel where the direction calls for something more specific, or a decorative asset with no
  discernible purpose.
- **Performance** — unnecessarily large file size for the rendered dimensions, missing responsive
  sources (`srcset`/`sizes`/`<picture>`) for an asset rendered at very different sizes across
  viewports, no modern-format alternative for a large raster asset, missing `loading="lazy"` on
  below-the-fold imagery, and layout-shift risk from missing explicit `width`/`height` (or aspect
  ratio) on an asset that loads asynchronously.
- **Accessibility** — missing or unhelpful `alt` text on meaningful images; decorative images that
  are _not_ marked decorative (missing `alt=""` and/or `role="presentation"`/`aria-hidden="true"`);
  meaningful images that _are_ incorrectly marked decorative; icon-only controls without an
  accessible name; text baked into an image with no accessible text equivalent; insufficient contrast
  between an icon/illustration and its background where it conveys required meaning.

Also record, as its own finding category **icon-family cohesion**: whenever two or more icons appear
in the same functional context (a toolbar, a nav, a repeated list) drawn from different icon
families/sources, flag it even if no other quality issue is present — mixing families is a
consistency defect on its own.

For each finding, populate every field in the schema: `id`, `category`, `severity`, `confidence`,
`location`, `evidence`, `rationale`, `recommendation`, `classification` (`deterministic` or
`judgment`).

### 6. Provenance and licensing pass

For every asset actually inspected in step 2, record what provenance is knowable from the repository
itself (a nearby license/credits file, an import from a known open-source icon package with its
package license, a filename/commit history hint) — or record explicitly that provenance is
**unknown** for that asset. Do not retroactively invent a license for an asset that has none
recorded; report the gap as a finding (see schema) rather than silently assuming permissive use.

### 7. Authorization for mutation

Only proceed past this point when **all** of the following hold for a specific asset/fix:

- the current invocation contains an explicit authorization word (e.g. "replace", "swap in",
  "generate", "regenerate", "authorized") tied to a specific asset or fix, not a general "clean this
  up";
- for a **replacement or added** asset: the invocation (or a direct follow-up answer) supplies the
  concrete asset (a file path, inline content, or an unambiguous pointer to one already in the
  repository) **and** its provenance/license, per the Non-negotiables above. If either is missing,
  stop and ask for it rather than proceeding or guessing;
- for a **generation** request: per the Non-negotiables above, no Universal MCP tool currently
  generates image content — tell the user this limitation applies today and ask them to supply the
  asset (with provenance) instead, unless `docs/MCP_REFERENCE.md` has since documented a real
  image-generation tool, in which case use it by its exact documented name;
- for a **code-only fix** with no new binary asset (adding `alt` text, marking an image decorative,
  adding `srcset`/`sizes`, fixing declared dimensions, correcting `loading`, swapping a mismatched
  icon for one already available from the project's existing icon family) — the invocation
  authorizes fixing that specific finding or category of finding (e.g. "fix the missing alt text you
  find" is sufficient authorization for that category; a bare `/assets <scope>` with no mutation
  language is not).

If authorization is ambiguous, partial, or scoped more broadly than what's actually justified by a
finding, narrow it back to what's clearly authorized and ask before doing more.

### 8. Implement only the authorized change

Make the smallest change that satisfies the authorized fix or replacement:

- record provenance/license inline (a comment near the asset reference, or an existing
  credits/licenses file if the project has one — reuse that convention rather than inventing a new
  one) for every asset added or replaced;
- keep icon replacements within the same family already used elsewhere in that context, unless the
  authorization explicitly says to introduce a new family (and if so, flag the resulting
  repository-wide inconsistency as a remaining limitation for a broader `/consistency` pass);
- do not touch assets or files outside what was authorized, even if the audit surfaced other issues
  in the same scope.

### 9. Verify

From the repository root, run what's applicable to the touched workspace: `pnpm format:check` and
`pnpm lint`. If a mutation touched React/CSS source (not just binary assets), also run
`pnpm typecheck` and any workspace-scoped `pnpm --filter <workspace> test`/`build` that applies.
Report exact commands and outcomes; do not claim a check passed without having run it. If a mutation
occurred, re-run `review_implementation` on the materially changed React/CSS files when the MCP is
available.

### 10. Report

Use exactly the structure in [Required final output](#required-final-output) below.

## Required final output

1. **Scope, mode, and evidence inspected** — resolved scope; audit-only or authorized-mutation mode
   and exactly what was authorized; assets and files read; screenshots found/captured or explicitly
   absent; which MCP tools were called and which were unavailable.
2. **Executive assessment** — 3-6 sentences on overall asset-layer health and the one or two things
   that matter most.
3. **Findings by category** (quality, consistency/icon-family cohesion, relevance, performance,
   accessibility), ordered by severity within each — using the schema from step 5.
4. **Provenance and licensing table** — every asset inspected, its known provenance/license or
   explicit "unknown", and any asset a mutation was blocked on due to missing license information.
5. **What is already working well** — concrete, specific credit.
6. **Mutations made** (omit this section entirely for an audit-only run) — per authorized change:
   asset/file touched, what changed, provenance/license recorded, and why it was in scope.
7. **Validation performed** — exact commands run and results, or "not run: <reason>" (state plainly
   if this was audit-only and no mutation-stage checks applied).
8. **Recommended repair order** — a short sequenced list for anything not authorized this run,
   including whether it belongs to `/assets` again, `/polish`, `/cleanup`, `/accessibility`, or
   `/consistency`.
9. **Evidence gaps and limitations** — unavailable tooling, unknown provenance, the current absence
   of an MCP image-generation tool, or any other constraint, stated plainly.
10. **Explicit confirmation of what was and was not modified** — for an audit-only run, state plainly
    that nothing was edited, formatted, staged, committed, or pushed; for a mutation run, state
    exactly and only what changed.

Never soften item 10 into a vague summary — it must state plainly and completely what was and was
not touched.
