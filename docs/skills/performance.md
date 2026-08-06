# `/performance`

Finds and repairs **user-visible** frontend performance problems in an existing Universal-managed UI,
backed by real measurement on both ends of every change. It does not perform a general code-quality
pass, does not touch visual design, and does not tune backend or server infrastructure.

## What it does

`/performance` investigates exactly six categories, each requiring its own kind of concrete evidence
(see [`reference/evidence-methods.md`](../../.agents/skills/performance/reference/evidence-methods.md)
for the exact technique per category):

1. **Oversized media** — images/video whose on-disk size, format, or dimensions exceed what the
   rendered usage needs.
2. **Inefficient font loading** — missing `font-display`, missing preconnect/preload for a critical
   font, unused weights/subsets shipped.
3. **Layout shift** — content that visibly moves after initial paint (unreserved media dimensions,
   font-swap reflow, late-inserted content).
4. **Expensive animation** — animation that stutters or drops frames, typically from animating
   layout-triggering CSS properties instead of compositor-friendly ones.
5. **Excessive re-rendering** — a component tree that visibly re-renders far more than the interaction
   warrants, confirmed with a real React DevTools Profiler run.
6. **Poorly prioritized loading** — critical content blocked behind non-critical bundle/script weight,
   missing code-splitting/lazy-loading for below-the-fold or route-gated content.

Every fix requires a real **before-measurement** (file size on disk, bundle/build output, or an
actual profiling/Lighthouse run) and a real **after-measurement** using the same method against the
same target. A candidate with no obtainable measurement is reported and left unfixed, not guessed at.

## When to use it vs. neighboring commands

| If you want to...                                                        | Use instead               |
| ------------------------------------------------------------------------ | ------------------------- |
| Find visual/hierarchy/accessibility/generic-pattern problems (read-only) | `/audit`                  |
| Apply bounded visual craft refinements (typography, spacing, hierarchy)  | `/polish`                 |
| Remove redundant/inconsistent/obsolete code or tokens                    | `/cleanup`                |
| Run the full discovery → brief → direction → plan → build workflow       | `/art-direct`             |
| Get a multi-perspective, read-only design-review synthesis               | `/review-ui`              |
| Add or refine purposeful motion (new transitions, micro-interactions)    | `/animate`                |
| Audit or replace imagery/icon _content_ for creative/brand reasons       | `/assets`                 |
| Fix layout/composition/alignment across viewports generally              | `/responsive`             |
| Fix a performance problem with real before/after measurement             | **`/performance`** (this) |

`/performance` overlaps narrowly with a few of these:

- vs. `/animate`: `/animate` adds new purposeful motion; `/performance` only touches an _existing_
  animation, and only to fix a measured cost (e.g. switching an animated property to a
  compositor-friendly one), never to add new motion or change its visible timing/easing/end-state.
- vs. `/assets`: `/assets` handles creative/brand asset selection and replacement; `/performance`
  only touches asset _delivery_ (compression, format, dimensions, lazy-loading) when backed by a
  measured size/loading problem, never the creative choice of which asset to use.
- vs. `/responsive`: `/responsive` fixes viewport-driven layout correctness generally; `/performance`
  only cares about the layout-shift and loading-priority slice of that, and only when it has a
  measurement to back the fix.
- vs. `/polish` and `/cleanup`: both can incidentally improve performance, but neither requires or
  produces a before/after measurement pair the way `/performance` does. If a `/performance` finding
  would require a visual redesign to fix well, it is handed back to `/polish` or `/art-direct` instead
  of being forced through this skill.

## Invocation examples

```text
/performance frontend/src/pages/Home hero image
/performance apps/studio/src/routes/Preview animation
/performance packages/ui/src/components/DataTable re-render
/performance frontend/src fonts, no font under 300ms perceived block
/performance examples/demo-site loading-priority
```

If `$ARGUMENTS` is empty, the skill asks which scope to investigate rather than sweeping the whole
monorepo without a target.

## Mutation behavior

- Mutates source **only on explicit `/performance` invocation**, and only for candidates that cleared
  both an evidence check (a real before-measurement) and an impact check (not a micro-optimization
  with no measurable user-visible effect).
- Never mutates anything the before-measurement didn't actually surface.
- Preserves visual output and behavior exactly: no cropped/resized/recolored/re-timed visual result,
  no changed interaction behavior, state, routes, or public APIs.
- Never touches backend/server code, database queries, server-side caching headers, edge/CDN
  configuration, or infrastructure. Frontend build configuration that changes what ships to the
  browser (code-splitting, deferring a script, compressing a shipped asset) is in scope; anything
  that runs or is configured on a server is not.
- Does not stage, commit, push, or open a PR unless the user explicitly asks.

## Scope and limitations

- Frontend, user-perceived performance only. It does not evaluate server response time, database
  performance, or infrastructure.
- Re-render fixes strictly require a real React DevTools Profiler (or equivalent) recording — a
  source read showing "no `React.memo`" is treated as a hypothesis, not evidence, and is never
  sufficient on its own to justify a fix.
- Universal's MCP surface currently has no dedicated performance-analysis tool. The skill calls
  `get_design_rules` with `category: "motion"` only when a fix touches an existing animation, to keep
  the fix consistent with Universal's motion `implementationConstraints` (e.g.
  `prefers-reduced-motion` handling) — it is a consistency check on the fix, not the source of
  evidence for finding the problem. If the MCP is unavailable, the skill says so and proceeds; its
  evidence never depended on the MCP being connected in the first place.
- If Lighthouse/profiler/browser tooling isn't already available and wired up in the environment, the
  skill does not fabricate a run — it reports "no before-measurement available" for that category and
  leaves it unfixed.

## Verification

The skill runs, from the repository root or scoped to the touched workspace:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

and re-runs whichever before-measurement method applies (`ls -la`/`Get-Item` on the same asset path,
the same real build, or the same profiling/Lighthouse run) against the same target after the fix, to
produce a real before → after comparison. It also re-inspects the affected surface for unchanged
visual output when browser tooling is available, and states plainly when that re-check didn't happen.

### Validating changes to this skill itself

There are no test fixtures shipped for `/performance` — its evidence discipline is procedural
(measurement method choice, threshold judgment) rather than a fixed set of classification cases like
`/cleanup`'s. To validate a change to `SKILL.md` or
[`reference/evidence-methods.md`](../../.agents/skills/performance/reference/evidence-methods.md):

1. Give a fresh agent only the updated `SKILL.md` (and the reference file if it's relevant) plus a
   small real target with a genuine, measurable performance problem (e.g. an oversized image actually
   committed at a mismatched size, or a `transition: top` on a real animated element).
2. Confirm it produces a real before-measurement using the method the reference file specifies for
   that category, refuses to act without one, and does not fabricate a Lighthouse/profiler run it
   didn't perform.
3. Confirm its final report follows the nine required sections in `SKILL.md`, in order, with the
   before/after measurement pair actually present.
