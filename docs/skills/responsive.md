# `/responsive`

Reviews and repairs an existing website or React interface across a fixed, representative set of
viewport widths, fixing concrete responsive defects without redesigning the product or changing its
visual direction.

## What it does

`/responsive` checks a target page, route, or component against five representative viewport
widths — `mobile` (390px), `tablet` (768px), `laptop` (1024px), `desktop` (1440px), and `wide`
(1920px), unless `$ARGUMENTS` narrows that set — and repairs what it finds in seven categories:

- overflow and clipping
- bad wrapping (text, controls, inline groups)
- navigation collapse/expansion correctness and reachability
- touch target sizing
- content order (DOM/visual order once layout reflows)
- information density appropriate to the width
- breakpoint-specific composition (clean transitions between defined breakpoints, no in-between
  broken states)

The full checklist used for each viewport is in
[`../../.agents/skills/responsive/reference/viewport-checklist.md`](../../.agents/skills/responsive/reference/viewport-checklist.md).

## When to use it vs. neighboring commands

| If you want to...                                                                         | Use instead   |
| ----------------------------------------------------------------------------------------- | ------------- |
| Get a read-only report of responsive (and other) issues, no edits                         | `/audit`      |
| Get a synthesized multi-perspective review including a responsive critic                  | `/review-ui`  |
| Fix general hierarchy/typography/spacing/a11y craft, not specifically responsive breakage | `/polish`     |
| Remove redundant/duplicated/obsolete CSS or tokens (not viewport-specific)                | `/cleanup`    |
| Change the visual direction, palette, type scale, or component vocabulary                 | `/art-direct` |
| Add purposeful motion/transitions/loading feedback                                        | `/animate`    |
| Fix typography scale/pairing/line-length as a system, not a viewport bug                  | `/typography` |
| Fix composition/alignment/whitespace/hierarchy as a system                                | `/layout`     |
| Fill in missing interaction/application states (empty, error, loading)                    | `/states`     |

`/responsive` is scoped to _this UI breaks or behaves badly at a specific width_ — not to general
visual quality, and not to changing what the UI looks like when it isn't broken. If a fix would
require changing palette, type scale, or component identity to "fit" a width, that's `/art-direct`
or `/polish` territory, not `/responsive`.

## Invocation examples

```text
/responsive
/responsive apps/studio/src/routes/Pricing
/responsive frontend/src/components/Navbar check mobile and tablet only
/responsive the pricing table overflows horizontally on mobile
/responsive apps/studio/src/routes/Dashboard fix touch targets on the toolbar at 390px and 768px
```

If `$ARGUMENTS` is empty and the conversation doesn't unambiguously identify one target, the skill
asks which page/route/component to check rather than guessing across the whole repository.

## Mutation behavior

`/responsive` **mutates source**, but only on an explicit `/responsive` invocation — it never
triggers its own repair steps proactively from a broader task. What it may change:

- media query breakpoints and their thresholds, when the defect requires it
- `flex`/`grid` layout rules, `overflow`/`min-width`/`max-width` handling
- navigation collapse/expansion logic and its trigger widths
- spacing/padding used for touch target sizing (via existing spacing tokens)
- DOM/`order`/grid-placement adjustments needed to fix content order

What it must **not** change:

- color palette, typography scale, or component visual identity (that's `/art-direct` or
  `/polish`)
- business logic, state, routes, public APIs, or data flow
- accessibility semantics beyond what's needed to fix the specific responsive defect
- content or features removed "to make room" at a narrow width — it reflows or progressively
  discloses content instead of deleting it

## Scope and limitations

- The five representative widths are a proxy for the real device/viewport space, not exhaustive
  coverage; a defect between two checked widths can still exist.
- Per-viewport evidence depends on screenshot tooling (e.g. the `/browse` skill or an existing
  Playwright/Puppeteer setup) already being available in the environment. When it isn't, the skill
  falls back to source-only inference and says so explicitly for every width it couldn't capture —
  it never claims a screenshot that wasn't taken.
- It calls only the `get_design_rules`, `get_taste_profile`, and `review_implementation` Universal
  MCP tools (see [`../MCP_REFERENCE.md`](../MCP_REFERENCE.md#get_design_rules)); it does not run the
  stateful Phase 2 Art Director session sequence.
- It does not redesign the breakpoint system — it adjusts existing breakpoints or, rarely, adds one
  intermediate breakpoint only when a real gap is causing the defect, not preemptively.

## Verification

The skill itself runs, from the repository root or filtered to the changed workspace:

```bash
pnpm format:check
pnpm typecheck
pnpm --filter <workspace> test   # or pnpm test for a broad change
pnpm build                        # or the workspace-scoped build
```

It also re-captures per-viewport evidence (screenshots when tooling is available) after the change
and re-runs `review_implementation` on materially changed React/CSS files, comparing against the
pre-change baseline.

To validate a change to the skill definition itself (not a `/responsive` run against a project),
confirm:

1. `.agents/skills/responsive/SKILL.md` and `.claude/skills/responsive/SKILL.md` have byte-identical
   bodies (everything after the frontmatter) — diff them after any edit.
2. `.agents/skills/responsive/reference/viewport-checklist.md` and
   `.claude/skills/responsive/reference/viewport-checklist.md` are byte-identical.
3. Every relative link in the `SKILL.md` files and in this document resolves to a real file in the
   repository.
4. Every MCP tool name referenced (`get_design_rules`, `get_taste_profile`,
   `review_implementation`) appears in [`../MCP_REFERENCE.md`](../MCP_REFERENCE.md).

This skill ships no test fixtures beyond the reference checklist; there is no `test-fixtures/`
directory to walk (unlike `/cleanup`).
