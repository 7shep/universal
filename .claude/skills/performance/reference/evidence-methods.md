# Performance evidence methods

Per-category measurement techniques for `/performance`. Loaded only when the main `SKILL.md`
workflow needs the detail. Every technique below produces a real, reportable number or artifact —
none of them are satisfied by reading source and estimating.

## 1. Oversized media

**Before-measurement:**

- Stat the actual file on disk (`ls -la path/to/asset`, PowerShell `Get-Item path | Select Length`,
  or equivalent) for real byte size.
- Read the markup/CSS to find the actual rendered/displayed dimensions (explicit `width`/`height`,
  CSS `max-width`, container size) the asset is used at.
- Compare format against content type: a photographic asset shipped as uncompressed PNG when a
  photograph, or an oversized asset with no responsive `srcset`/`sizes` for a fixed small display
  size, are both measurable mismatches.

**Threshold for "Fix":** the file's byte size or native pixel dimensions are disproportionate to its
actual rendered usage (e.g. a 4000×3000px source displayed at 400×300px, or a photographic JPEG/PNG
where a modern compressed format would materially reduce bytes at equivalent visual quality) — not
merely "this file is somewhat large."

**After-measurement:** re-stat the same file (or its replacement) on disk; report old byte size → new
byte size.

## 2. Inefficient font loading

**Before-measurement:**

- Read the `@font-face`/font-loading source for `font-display`, preconnect/preload `<link>` tags, and
  which weights/styles are actually declared vs. actually used in the rendered CSS (`Grep` for the
  `font-weight`/`font-style` values actually applied in the scope).
- If build tooling reports it, check bundle output for font file sizes and count.

**Threshold for "Fix":** a missing `font-display` on a custom web font (causing invisible/blocking
text by default), a critical font with no preconnect/preload despite being needed for first paint, or
a weight/subset shipped that a `Grep` across the scope shows is never applied.

**After-measurement:** re-read the same source for the same properties; confirm the specific gap
(missing `font-display`, missing preload, unused weight) is closed, and re-check bundle output for
the shipped font byte count if it changed.

## 3. Layout shift

**Before-measurement:**

- Source check: media (`<img>`, `<video>`, embeds) rendered without explicit `width`/`height` or a
  CSS `aspect-ratio`, in a location that renders before its final size is known.
- Real check, when tooling is available: a Lighthouse/`/browse` run reporting a numeric CLS score, or
  a recorded observation of visible content movement after paint.
- Do not report a CLS "fix" without one of the above; a missing explicit dimension is real evidence,
  but only report a numeric CLS improvement if a real run actually produced one.

**Threshold for "Fix":** confirmed missing reserved space for content that loads after initial paint
and visibly displaces other content, or a measured non-zero CLS contribution traceable to a specific
element.

**After-measurement:** re-run the same Lighthouse/`/browse` check if that was the original method, or
re-confirm the specific element now has reserved dimensions if the original evidence was source-based.

## 4. Expensive animation

**Before-measurement:**

- Source check: identify which CSS property is being animated/transitioned. Properties that trigger
  layout (`width`, `height`, `top`, `left`, `margin`, etc.) on a frequently-animated element are a
  measurable structural cost distinct from compositor-friendly properties (`transform`, `opacity`).
- Real check, when tooling is available: a browser performance/profiler recording showing dropped
  frames, long layout/paint tasks, or visible jank during the animation.

**Threshold for "Fix":** a layout-triggering property animated on a frequently-updated or
frequently-visible element, ideally corroborated by a real profiler recording showing measurable
layout/paint cost; a source-only finding without a profiler run should be reported with that
limitation rather than asserted as measured jank.

**After-measurement:** confirm the property changed to a compositor-friendly one with identical
visible timing/easing/end-state; re-run the profiler recording if one was originally captured.

## 5. Excessive re-rendering

**Before-measurement — profiler run required, not optional:**

- Actually run React DevTools Profiler (or an equivalent instrumentation already available in this
  environment) against a live dev/preview session, interact with the surface the way a real user
  would, and record the reported render count/duration for the components in scope.
- A source read showing "no `React.memo`" or "no `useMemo`" is a hypothesis about a possible cause,
  never sufficient evidence on its own — do not action a re-render fix without an actual recorded
  profiler session.

**Threshold for "Fix":** the profiler recording shows a component re-rendering meaningfully more often
than the interaction warrants (e.g. re-rendering on every keystroke in an unrelated field, or on every
parent render regardless of prop changes), with a visible cost (dropped frames, noticeable input lag).

**After-measurement:** re-run the identical profiler interaction sequence and compare render
count/duration before vs. after.

## 6. Poorly prioritized loading

**Before-measurement:**

- Bundle/build stats: run the real build and read emitted chunk sizes — an oversized single entry
  chunk containing route- or feature-gated code that isn't needed at first paint is measurable
  directly from build output.
- Source check: confirm whether below-the-fold or route-gated content is statically imported into the
  critical path versus lazily loaded/code-split.
- Real check, when tooling is available: a Lighthouse/`/browse` run's request waterfall or
  render-blocking-resource report.

**Threshold for "Fix":** build output or a real waterfall shows non-critical weight blocking or
materially delaying the content the user needs at first paint.

**After-measurement:** re-run the same build/waterfall check; report the critical-path
size/blocking-resource count before vs. after.
