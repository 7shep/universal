# `/typography`

Bounded refinement of an existing website or React interface's typographic system: font selection
and loading strategy, type scale, hierarchy, line length (measure), font weight, vertical rhythm,
and responsive type behavior. It preserves the interface's established visual direction and never
changes the meaning of existing content.

See [`.agents/skills/typography/SKILL.md`](../../.agents/skills/typography/SKILL.md) (or the
`.claude/skills/typography/SKILL.md` copy used by Claude Code) for the authoritative workflow,
boundaries, and required report format. This page is a contributor-facing summary and does not
replace it — if the two ever disagree, `SKILL.md` wins.

## What it does

- Reads the target's existing type scale, font families/weights, line-height and vertical-rhythm
  conventions, and any type-token file already in use.
- Calls the Universal MCP `get_design_rules` tool with `category: "typography"` for
  `typographyPrinciples`, `antiPatterns`, and `implementationConstraints`, and
  `review_implementation` for a deterministic before/after check.
- Produces a bounded repair set (target, issue, intended change, font-loading/layout-shift impact,
  what must stay unchanged) and shows it before editing.
- Edits the smallest set of files needed: type scale steps, weight tokens, line-height tokens, font
  family tokens/declarations, and the font-loading markup or config that serves them (e.g.
  `@font-face`, `<link rel="preload">`, a font-loading package's config).
- Runs `pnpm format:check` / `pnpm typecheck` / tests / build for the changed workspace, and
  re-captures screenshots plus a `review_implementation` re-check when tooling is available.

## When to use it vs. neighboring commands

| If you need to...                                                                                     | Use instead                      |
| ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| Change what the text _says_ (wording, tone, microcopy)                                                | `/copy`                          |
| Change composition, grid/flex structure, container widths, section order                              | `/layout`                        |
| Change palette, semantic color roles, contrast, color tokens                                          | `/color`                         |
| Get a read-only evidence-led audit that happens to flag typography issues                             | `/audit`                         |
| Get bounded improvements across hierarchy, spacing, responsiveness, and a11y together with typography | `/polish`                        |
| Remove duplicated/obsolete typography tokens or styles without changing sizes/weights themselves      | `/cleanup`                       |
| Run discovery and pick a typeface/voice for a new or substantially redesigned interface               | `/art-direct`                    |
| Get a synthesized, multi-perspective read-only review that includes a typography critic               | `/review-ui`                     |
| Refine _only_ the typographic system of an already-directed interface                                 | **`/typography`** (this command) |

`/typography` assumes a visual direction already exists (chosen by `/art-direct`, or simply
whatever the current interface already uses) and sharpens its execution. It does not choose a new
typeface family, voice, or direction from scratch — that decision belongs to `/art-direct`'s
discovery flow or an explicit, informed user request naming the new family.

## Invocation examples

```text
/typography Tighten the heading scale on the pricing page.
/typography frontend/src/routes/Docs mobile — fix line length in article body copy.
/typography apps/studio/src/routes/Preview both — the H1/H2/H3 steps read almost identical.
/typography Swap the body font to a variable font without a loading regression.
/typography Fix vertical rhythm between the hero heading and subhead on desktop.
```

If `$ARGUMENTS` is empty and no single page/route/component is unambiguous from the conversation,
the skill asks which target to use instead of guessing.

## Mutation behavior

`/typography` **mutates source**, but only on an explicit invocation — it never edits files as a
side effect of being merely available or referenced in conversation.

It may change:

- type scale values and the tokens that define them;
- font-family declarations and font-loading strategy (self-hosted `@font-face`, preload/stylesheet
  links, a font-loading package's configuration), including adding a `font-display` strategy or a
  size-adjusted fallback;
- font-weight usage;
- line-height and the vertical spacing _between text elements_ that is part of typographic rhythm;
- responsive type behavior (fluid/clamp scales, breakpoint-driven type steps).

It must not change:

- copy wording, tone, or meaning (`/copy`);
- layout structure — grid/flex composition, container widths not driven by measure, section order,
  component placement (`/layout`);
- color, including text color, link color, and selection/highlight color, even when it lives in the
  same token file as a typography token being touched (`/color`);
- business logic, state, routes, APIs, data flow, or accessibility semantics;
- unrelated in-progress changes already present in the working tree.

It prefers editing existing type tokens over inventing parallel ones, and treats any new font
family/weight as a loading-cost and layout-shift decision, not just a visual one — see the
"Font loading strategy and layout shift" priority in `SKILL.md`.

## Scope and limitations

- Requires a resolvable target; it will not run a repo-wide sweep on an empty or ambiguous
  `$ARGUMENTS`.
- Visual evidence (screenshots, observed font-swap reflow) depends on browser/screenshot tooling
  already being available in the environment (e.g. the `/browse` skill or an existing
  Playwright/Puppeteer setup). When absent, the skill says so explicitly rather than fabricating
  evidence, and proceeds on source inspection alone.
- Design guidance depends on the Universal MCP being connected. When it is not, the skill falls
  back to `AGENTS.md`'s visual quality principles and states the limitation instead of inventing
  `get_design_rules`/`review_implementation` output.
- Does not measure real network transfer size or run a Lighthouse-style performance audit; it
  reasons about font loading cost and layout shift from the source and loading configuration it can
  inspect, and defers a full performance investigation to `/performance`.
- Does not choose a brand-new typeface direction for a project that doesn't have one yet; that is
  `/art-direct`'s discovery flow.

## Verification

A `/typography` run reports, in its required final report:

- exact validation commands run (`pnpm format:check`, `pnpm typecheck`, relevant
  `pnpm --filter <workspace> test`/`pnpm test`, and a build for changed packages/apps) and their
  real results;
- before/after screenshots when capture tooling was available, including whether any font-swap
  reflow was observed;
- the baseline vs. re-review `review_implementation` findings and which were fixed vs. deferred.

### Validating changes to this skill itself

If you edit `SKILL.md` or this doc:

1. Confirm the `.agents/skills/typography/SKILL.md` and `.claude/skills/typography/SKILL.md` bodies
   stay identical apart from frontmatter (`diff` them after editing).
2. Re-check every relative link in both files and in this doc resolves to a real path in the repo.
3. Confirm every MCP tool name referenced (`get_design_rules`, `review_implementation`) still
   appears in [`docs/MCP_REFERENCE.md`](../MCP_REFERENCE.md).
4. Run `pnpm format:check` and `pnpm lint` from the repository root and report the real output.
