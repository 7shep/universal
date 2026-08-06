# `/assets`

Audits the visual-asset layer of an existing Universal route, component, or directory —
photography, illustration, iconography, decorative graphics, and any other non-text visual asset —
for quality, consistency, relevance, performance, and accessibility. Default mode is **audit-only
and read-only**. It replaces or generates assets only when the invocation explicitly authorizes a
specific change, and every asset it adds or replaces must carry recorded provenance and licensing.
See [`.agents/skills/assets/SKILL.md`](../../.agents/skills/assets/SKILL.md) for the exact,
authoritative workflow this document summarizes.

## What it does

- Inventories the visual assets referenced by the resolved scope: raster/vector images, icon
  usage, illustration/decorative components, and any existing licensing/attribution notes.
- Evaluates each asset across five dimensions: quality (compression artifacts, upscaling,
  fidelity drift), consistency (including a dedicated icon-family-cohesion check — icons in the
  same context must come from one family), relevance (does the asset support the actual content),
  performance (file size vs. rendered dimensions, responsive sources, modern formats, lazy
  loading, layout shift), and accessibility (alt text, decorative marking, icon-only control
  names, contrast).
- Calls Universal's `get_design_rules` with `category: "imagery"`, `get_taste_profile`, and
  `review_implementation` (when the MCP is connected) to ground findings in Universal's design
  policy rather than personal taste.
- Records a provenance/licensing table for every asset it inspects, and refuses to add or replace
  any asset whose license is unknown or unverifiable.
- Flags any asset that appears to imitate a named brand's protected visual identity as a
  high-severity finding, regardless of mode.
- Only mutates source when the invocation carries explicit authorization for a specific asset or
  fix (see [Mutation behavior](#mutation-behavior)).

## When to use it vs. neighboring commands

- **`/assets` vs. `/audit`** — `/audit` is a general, strictly read-only design/implementation
  audit across hierarchy, composition, typography, spacing, accessibility, and more. `/assets` is
  narrower and asset-specific, and — unlike `/audit` — it can mutate when explicitly authorized.
  Use `/audit` for a whole-page/whole-component review; use `/assets` when the concern is
  specifically imagery, icons, or illustrations.
- **`/assets` vs. `/polish`** — `/polish` makes bounded visual-refinement changes across hierarchy,
  typography, spacing, responsiveness, and accessibility as its default mode of operation.
  `/assets` defaults to audit-only and only touches code or binaries when a specific asset fix is
  explicitly authorized in the invocation. Route asset-only work through `/assets` when
  provenance/licensing matters; route broader visual refinement through `/polish`.
- **`/assets` vs. `/cleanup`** — `/cleanup` removes redundant/inconsistent/obsolete/generic
  _implementation_ patterns (duplicated tokens, dead CSS, cards-in-cards). `/assets` is scoped to
  the visual-asset layer itself (the files and their usage, not general markup/CSS hygiene). A
  mixed-icon-family finding from `/assets` that turns out to be repository-wide is better finished
  by `/consistency` or `/cleanup` once `/assets` has identified it locally.
- **`/assets` vs. `/art-direct`** — `/art-direct` orchestrates a full discovery-to-implementation
  art-direction session for a new or substantially redesigned interface, including its imagery
  direction from scratch. `/assets` never starts or resumes an Art Director session; it audits and
  bounded-repairs assets already present in an existing implementation.
- **`/assets` vs. `/review-ui`** — `/review-ui` coordinates multiple _design-review perspectives_
  (typography, composition, accessibility, brand, motion, component vocabulary, implementation
  craft) into one synthesized report and is strictly read-only. `/assets` is a single-perspective,
  asset-specific audit that can also perform a bounded, authorized repair — it is not a
  perspective `/review-ui` dispatches to.
- **`/assets` vs. `/accessibility`** — `/accessibility` audits and (on request) repairs
  accessibility across the whole surface (semantics, keyboard behavior, focus, ARIA, contrast, and
  more). `/assets` checks only the accessibility properties that are asset-specific (alt text,
  decorative marking, icon-only control names, image-conveyed contrast) as one of its five
  dimensions, not the full accessibility surface. Use `/accessibility` for a comprehensive a11y
  pass; use `/assets` when the concern is specifically about imagery/icons.
- **`/assets` vs. `/performance`** — `/performance` repairs evidence-backed, user-visible
  performance problems across the implementation. `/assets` checks only the asset-specific
  performance properties (file size vs. rendered size, responsive sources, modern formats, lazy
  loading, asset-driven layout shift) as one of its five dimensions. A broader performance
  regression that isn't asset-shaped belongs to `/performance`.

## Invocation examples

```text
/assets frontend/src/pages/Home — audit only
/assets packages/ui icon usage
/assets frontend/src/components/Toolbar.tsx mixed icon families
/assets frontend/src/pages/Home hero image — replace with frontend/src/assets/hero-v2.jpg
  (license: CC0, source: openverse.org, credited to Jane Doe), authorized
/assets frontend/src/pages/Pricing — fix the missing alt text you find, authorized
```

The first three examples run in default audit-only mode (no mutation, even if fixable issues are
found). The fourth supplies a concrete replacement asset with recorded provenance/license and an
explicit authorization word, so `/assets` may apply that specific replacement. The fifth
authorizes a specific _category_ of code-only fix (missing alt text) without a new binary asset.

## Mutation behavior

`/assets` **may not** mutate anything by default. It becomes eligible to mutate only for a specific
asset or fix when the invocation contains an explicit authorization word (e.g. "replace", "swap
in", "generate", "regenerate", "authorized") tied to that specific target — a general "clean this
up" is not authorization.

When authorized, `/assets` may:

- add `alt` text, mark an image decorative (`alt=""` plus `role="presentation"`/
  `aria-hidden="true"`), add `srcset`/`sizes`/`<picture>` sources, fix declared dimensions, or
  correct `loading` — code-only fixes with no new binary asset;
- swap a mismatched icon for one already available from the project's existing icon family;
- replace or add an asset when the invocation (or a direct follow-up) supplies both the concrete
  asset and its provenance/license — recording that provenance inline or in the project's existing
  credits/licenses convention.

`/assets` **never**:

- generates new image content itself — no Universal MCP tool currently creates or edits images
  (verified against `docs/MCP_REFERENCE.md`'s documented tool set at the time this skill was
  written); a "generate" request is fulfilled only by a user-supplied asset with recorded
  provenance, or reported as unsupported;
- adds or keeps an asset whose license is unknown or unverifiable;
- imitates a named brand's protected visual identity;
- touches an asset or file outside what was explicitly authorized, even if the audit surfaced
  other issues in the same scope;
- introduces a new icon family without explicit authorization to do so.

## Scope and limitations

- `/assets` only calls MCP tools documented in `docs/MCP_REFERENCE.md`: `get_design_rules`,
  `get_taste_profile`, and `review_implementation`. It does not attempt the stateful Phase 2 Art
  Director sequence.
- Screenshot/visual evidence is only used when capture tooling already exists and is wired up in
  the environment (e.g. `/browse`); `/assets` never fabricates a screenshot or a visual check.
- Provenance findings are limited to what's discoverable inside the repository (credits files,
  package licenses, commit hints); `/assets` does not perform external reverse image search or
  contact third parties to establish a license.
- A repository-wide icon-family or asset-consistency problem discovered locally by `/assets` is
  reported with a recommendation to run `/consistency` or `/cleanup` for the broader fix — `/assets`
  itself stays bounded to the resolved scope.
- If a future release of `docs/MCP_REFERENCE.md` documents a real image-generation MCP tool,
  `/assets` should be updated to use it by its exact documented name; until then, "generate"
  requests are explicitly unsupported via MCP.

## Verification

For an audit-only run, `/assets` performs no mutation-stage validation — the report states this
plainly rather than running checks that don't apply.

For an authorized-mutation run, `/assets` runs, from the repository root, whatever is applicable to
the touched workspace:

```bash
pnpm format:check
pnpm lint
```

and, only when the mutation touched React/CSS source (not just a binary asset):

```bash
pnpm typecheck
pnpm --filter <workspace> test
pnpm --filter <workspace> build
```

If the MCP is available, a mutation run re-invokes `review_implementation` on the materially
changed React/CSS files.

To validate a change to the skill definition itself, a contributor should:

1. Read `.agents/skills/assets/SKILL.md` and `.claude/skills/assets/SKILL.md` side by side and
   confirm their bodies (everything after the frontmatter) stay byte-identical, and that
   `.claude/skills/assets/reference/asset-audit-schema.md` stays identical to
   `.agents/skills/assets/reference/asset-audit-schema.md`.
2. Walk at least one audit-only scenario (a scope with a real accessibility or consistency defect)
   and confirm the skill would produce every field the schema requires — `id`, `category`,
   `severity`, `confidence`, `location`, `evidence`, `rationale`, `recommendation`,
   `classification` — without inventing a tool name not present in `docs/MCP_REFERENCE.md`.
3. Walk at least one mutation scenario missing a piece of required authorization (no license, no
   concrete replacement file, or no authorization word) and confirm the skill's workflow stops and
   asks rather than proceeding.
4. Run `pnpm format:check` and `pnpm lint` from the repository root against the touched Markdown
   files and record the exact output.
