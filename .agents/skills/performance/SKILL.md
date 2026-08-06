---
name: performance
description: Finds and repairs evidence-backed, user-visible frontend performance problems in Universal — oversized media, inefficient font loading, layout shift, expensive animation, excessive re-rendering, and poorly prioritized loading. Requires a real before-measurement and after-measurement for every change; refuses speculative or non-measurable micro-optimizations; stays out of backend/server tuning.
---

# /performance

Find and repair **user-visible** frontend performance problems, backed by real measurement on both
ends of the change. This skill is not a general code-quality pass, not a design refinement pass, and
not a backend/infrastructure tuning tool — it exists only where a measured, user-perceived slowdown
can be shown before the fix and shown improved (or at minimum unregressed) after it.

`$ARGUMENTS` optionally names a route, component, directory, or asset path to scope to; a category
focus (`media`, `fonts`, `layout-shift`, `animation`, `re-render`, `loading-priority`); and/or a
budget or threshold the user cares about (e.g. "hero image under 200KB", "no CLS on the pricing
page"). If empty, ask which scope to investigate rather than guessing at the whole repository — a
monorepo-wide performance sweep without a target produces noise, not evidence.

## Non-negotiable boundaries

- **No mutation without a paired before-measurement.** A change never lands on the strength of source
  reading alone. The measurement must be one of: file sizes on disk, bundle/build output stats, or a
  real profiling or Lighthouse run actually executed in this session. "This image looks large" is not
  evidence; "`hero.png` is 4.2MB on disk, rendered at 480×320" is.
- **No mutation without an after-measurement**, using the same method against the same target, so the
  before/after pair is comparable. A fix without a re-measurement is an unverified guess, not a
  completed repair.
- **Never claim a Lighthouse run, profiler session, or build happened when it did not.** If the
  tooling to produce a given measurement isn't available in this environment, say so explicitly and
  do not fix that category — do not substitute a plausible-sounding fabricated number.
- **Refuse micro-optimizations with no measurable user-visible effect.** If the before-measurement
  shows the candidate is already small/fast/stable, or the fix's expected effect is below what the
  available measurement method can even detect, record it as **not actioned** with the reason. Do not
  "optimize" for its own sake.
- **Preserve behavior and visual output exactly.** No cropped, resized, recolored, or re-timed visual
  result; no changed interaction behavior, state, routes, or public APIs — a performance fix that
  visibly changes what the user sees or how the interface behaves is out of scope for this skill.
- **Stay out of backend and server tuning.** No database query optimization, server-side caching
  headers, API latency work, edge/CDN configuration, server process tuning, or infrastructure changes.
  Frontend build configuration that changes what ships to the browser (code-splitting a client
  bundle, deferring a script, compressing a shipped asset) is in scope; anything that runs or is
  configured on a server is not.
- Do not redesign, restyle, or change the selected design direction while fixing performance — if a
  performance fix would require a visual redesign to land well, say so and hand it to `/polish` or
  `/art-direct` instead of forcing it here.
- Do not stage, commit, push, or open a PR unless the invoking user explicitly asks for it.
- Never use destructive Git commands (`reset --hard`, `checkout -- <path>` on files you didn't touch,
  `clean -fd`, force-push, history rewrites).

## The six categories

Only these are in scope. Each needs its own kind of evidence — see
[reference/evidence-methods.md](reference/evidence-methods.md) for exact measurement techniques,
thresholds, and worked examples per category.

1. **Oversized media** — images, video, or other binary assets whose on-disk size, format, or
   delivered dimensions exceed what the rendered usage needs.
2. **Inefficient font loading** — render-blocking font requests, missing `font-display`, unused
   weights/subsets shipped, no preconnect/preload for a critical web font.
3. **Layout shift** — content that visibly moves after initial paint: media without reserved
   dimensions/aspect-ratio, web-font swap reflow, late-inserted content with no reserved space.
4. **Expensive animation** — animation that visibly stutters or drops frames, typically from
   animating layout-triggering properties instead of compositor-friendly ones, or unbounded
   concurrent animation work.
5. **Excessive re-rendering** — a component tree that visibly re-renders far more than the user
   interaction warrants, confirmed with a real profiler run, not inferred from reading the code.
6. **Poorly prioritized loading** — critical above-the-fold content blocked behind non-critical
   bundle/script/style weight; missing code-splitting or lazy-loading for clearly below-the-fold or
   route-gated content; render-blocking third-party scripts ahead of primary content.

## Workflow

### 1. Parse scope

Resolve `$ARGUMENTS` into a concrete target (route/component/directory/asset), an optional category
focus, and an optional budget. If ambiguous or missing, ask before reading or measuring anything.
State the resolved scope back before continuing.

### 2. Inspect source and delivery path

Read the target's React/CSS/asset-import source, its build configuration (Vite/webpack config,
`package.json` build scripts), and how its assets are referenced (static import, public path,
`<img>`/`<video>`/`@font-face` usage). Identify what already exists for performance (existing
lazy-loading, existing code-splitting, existing `font-display`) so the audit doesn't re-flag solved
problems.

### 3. Establish the before-measurement — required, per category

For every category you intend to touch, get one of:

- **File sizes on disk** — stat the actual asset files referenced by the target (`ls -la`,
  `Get-Item`/`Get-ChildItem`, or equivalent) and compare against the dimensions/usage the markup
  actually requests.
- **Bundle output / build stats** — run the project's real build (`pnpm build`, or a workspace-scoped
  build) and read the emitted chunk/asset sizes from its output.
- **A real profiling or Lighthouse run** — only if the tooling is already available and wired up in
  this environment (e.g. the `/browse` skill, an already-configured Lighthouse CLI, or a React
  DevTools Profiler session actually run against a live dev/preview server). Re-render counts
  specifically require an actual profiler run — a source read showing "no memo" is a hypothesis, not
  a measurement, and is not sufficient evidence on its own to justify a re-render fix.

If no measurement is obtainable for a category in this environment, say that plainly — "no before-
measurement available for animation profiling in this environment" — and do not fix that category
this run. Do not proceed on inferred or estimated numbers.

### 4. Build the candidate list, with disposition

For each candidate issue, capture: category, location (file/selector/asset path), the measurement
that surfaced it (with the actual number), the user-visible consequence, and a disposition:

| Disposition                              | Meaning                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Fix**                                  | Evidence shows a real, user-visible cost and a scoped fix exists that won't change behavior/visuals                                 |
| **Not actioned — no measurable effect**  | Evidence exists but shows the candidate is already within budget, or the fix's effect is below what the available method can detect |
| **Not actioned — no evidence available** | Suspected issue, but no before-measurement could be produced for it this run                                                        |
| **Out of scope**                         | Real issue, but crosses into backend/server tuning, redesign, or another skill's territory                                          |

Do not silently drop "not actioned" or "out of scope" items — they belong in the final report exactly
as classified.

### 5. Present the fix plan before mutating

For every "Fix" candidate, state: target, the measured problem, the intended change, and what must
stay unchanged (visual output, behavior, public API). Skip this pause only for a single, obviously
scoped, already-measured fix; for anything broader, get past this checkpoint before editing.

### 6. Implement only the evidence-backed fixes

Make the smallest change that addresses the measured problem:

- oversized media: recompress, resize to actual rendered dimensions, or convert format, without
  visibly degrading the image/video the user sees;
- font loading: add `font-display`, preconnect/preload the critical font, or drop unused
  weights/subsets that aren't actually rendered;
- layout shift: reserve space (explicit dimensions/`aspect-ratio`) for media and late-inserted
  content;
- expensive animation: move the animated property onto a compositor-friendly one (e.g. `transform`/
  `opacity` instead of properties that trigger layout), without changing the animation's visible
  timing, easing, or end state, and preserving `prefers-reduced-motion` handling;
- excessive re-rendering: memoize/scope state only where the profiler run showed real re-render cost,
  without changing observable output;
- loading priority: defer/lazy-load/code-split content confirmed to be non-critical or below the
  fold, without delaying anything the user needs at first paint.

Do not touch anything the before-measurement didn't flag.

### 7. Run the repository's checks

From the repository root, or scoped to the touched workspace:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

```bash
# narrower, faster iteration when the change is confined to one workspace
pnpm --filter <workspace> lint
pnpm --filter <workspace> typecheck
pnpm --filter <workspace> test
pnpm --filter <workspace> build
```

Report exact commands and their real output. If formatting is needed, format only the files this run
changed, then inspect the diff for unrelated formatter noise.

### 8. Re-measure — required, per fixed category

Re-run the exact same measurement method from step 3 against the exact same target for every category
that was actually changed. Record the before/after numbers side by side. If a fix does not measurably
improve (or at minimum does not regress) the metric it targeted, say so plainly instead of declaring
success.

### 9. Confirm visual and behavioral output is unchanged

For anything touching markup, CSS, or animation timing, re-inspect the affected surface (screenshot
comparison via `/browse` or equivalent tooling when available; otherwise a careful diff read) to
confirm the rendered result is unchanged. State plainly if no visual re-check tooling was available.

### 10. Report

Use exactly the structure in [Required final report](#required-final-report) below.

## Universal MCP tools

Universal's current MCP surface does not expose a dedicated performance-analysis tool — the design
tools evaluate visual/taste quality, not speed. This skill uses the MCP narrowly, and only when a fix
touches animation or motion:

- `get_design_rules` with `category: "motion"` — when a candidate fix changes an animation, call this
  to confirm the fix stays consistent with Universal's motion `implementationConstraints` (e.g.
  `prefers-reduced-motion` handling). Treat it as a consistency check on the fix, not as evidence for
  finding the performance problem in the first place.
- `get_taste_profile` — optionally, when a motion-related fix might also touch a motion anti-pattern
  (e.g. excessive/attention-demanding motion) already named in the active taste policy.

If the MCP is unavailable, say so explicitly and proceed on the measurement-driven workflow above —
this skill's evidence never depended on the MCP being connected. Do not call `review_implementation`,
`create_design_plan`, or any Phase 2 Art Director tool from this skill; they are outside its scope.

## Required final report

Always output these nine sections, in order:

1. **Scope** — resolved target(s), category focus, and budget (if any).
2. **Before-measurement** — the exact method used per category touched, with the real numbers/output,
   or "not available: <reason>" stated plainly for any category skipped.
3. **Candidates and disposition** — every candidate considered, using the table from step 4 (Fix /
   not actioned — no measurable effect / not actioned — no evidence available / out of scope).
4. **Files changed and why** — one line per file, mapped to its candidate.
5. **Behavior and visual output preserved** — what was confirmed unchanged, and how (re-inspection
   method, or "no visual re-check tooling available" stated plainly).
6. **Validation performed** — exact commands run and their results, or "not run: <reason>".
7. **After-measurement and delta** — same method as the before-measurement, same target, with an
   explicit before → after comparison per fixed category.
8. **Universal MCP guidance used** — `get_design_rules`/`get_taste_profile` calls made (if any) and
   what they confirmed; state plainly if the MCP was unavailable or unused this run.
9. **Remaining limitations** — unmeasurable categories, unavailable tooling, deferred candidates, and
   anything a human should independently verify.

Never claim a build, test, Lighthouse run, or profiler session happened when it did not. State tool or
tooling unavailability as a limitation rather than omitting the step silently.
