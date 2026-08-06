# Viewport checklist

Work through this checklist at every width in the resolved viewport set (default: `mobile` 390px,
`tablet` 768px, `laptop` 1024px, `desktop` 1440px, `wide` 1920px). Each item names the symptom to
look for and the class of fix that stays in `/responsive` scope. Do not use this checklist to
justify a visual-direction change — if a fix would change palette, type scale, or component
identity, stop and name the correct command (`/art-direct`, `/polish`) instead.

## Overflow and clipping

- Does any element's rendered width exceed its container at this width, producing unwanted
  horizontal scroll on the page (as opposed to an intentionally scrollable region like a data
  table or carousel)?
- Is text, an icon, or media clipped by `overflow: hidden` on a container that's too small for its
  content at this width?
- Do fixed-width elements (`width: 320px`, `min-width: 480px`, etc.) exceed the viewport width
  itself?
- In-scope fix: adjust the offending `width`/`min-width` to a responsive value (`%`, `clamp()`,
  `min()`, a breakpoint-specific override), add `overflow-x: auto` with a visible scroll
  affordance where scrolling is the intended behavior (e.g. wide tables), or allow the element to
  reflow.

## Wrapping

- Do inline elements (button groups, breadcrumb trails, tag lists, form label + control pairs)
  wrap in a way that creates an orphaned single item, a misaligned last row, or overlapping
  elements?
- Does long, unbreakable text (URLs, long words, numbers) overflow because `word-break` /
  `overflow-wrap` isn't set where it should be?
- Does a button or control's label wrap and break its fixed height, clipping the second line?
- In-scope fix: adjust `flex-wrap`, gap, and alignment rules; add `overflow-wrap: break-word` or
  `word-break` where long unbreakable strings appear; let fixed-height controls become
  height-auto with sufficient padding.

## Navigation

- At this width, is the navigation in its collapsed (hamburger/off-canvas/priority-nav) or
  expanded state, and is that the intended state for this width?
- Can every navigation destination that's reachable at `wide` still be reached at `mobile` (via
  the collapsed menu), with no items silently dropped?
- Is there a width range between two breakpoints where navigation is caught in an inconsistent or
  broken visual state (e.g. hamburger icon present but menu still rendered inline)?
- Does the expanded/open state trap or lose keyboard focus, or fail to close on route change?
- In-scope fix: adjust the breakpoint(s) that trigger collapse, fix the show/hide logic for the
  in-between range, or fix focus management in the existing nav pattern — without changing the
  navigation's visual style or introducing a different nav pattern than the one already selected.

## Touch targets

- At `mobile` and `tablet`, is every interactive element (button, link, form control, icon
  button) at least ~44x44px in hit area, or the project's established minimum if one is documented?
- Are two adjacent touch targets close enough together that a normal tap is likely to hit the
  wrong one?
- In-scope fix: increase padding/hit area (not necessarily the visible icon/glyph size) and adjust
  spacing between adjacent targets.

## Content order

- Does the DOM order still produce a sensible reading/tab order once CSS reflows the layout at
  this width (no `order`/grid-placement trick that visually reorders content in a way that breaks
  meaning or keyboard/screen-reader traversal)?
- Is anything that matters at `wide` (e.g. a sidebar, secondary panel) demoted, hidden, or
  reordered at `mobile` in a way that loses its meaning rather than just its position?
- In-scope fix: correct `order`/grid-placement so visual order still matches a sensible reading
  order, or move the reordering into the DOM itself when CSS-only reordering breaks
  accessibility.

## Density

- At `mobile`, is the information density still appropriate — not desktop-density text/controls
  crammed into a narrow column, causing cramped spacing or truncation?
- At `wide`, is content stretched into unreadable line lengths or left oddly sparse because
  nothing was designed to use the extra width (a max-width container is usually the fix, not a
  layout redesign)?
- In-scope fix: adjust spacing scale per breakpoint using existing spacing tokens, add/adjust a
  `max-width` constraint for wide viewports, or adjust the number of columns/items per row at each
  breakpoint using the existing grid system.

## Breakpoint-specific composition

- Where a layout intentionally changes shape between breakpoints (e.g. stacked column at `mobile`
  to a two-column layout at `laptop`), is there an awkward in-between state at widths between the
  defined breakpoints (a column too narrow to hold its content, but not yet stacked)?
- Do breakpoint values used in the code actually align with where the layout visually needs to
  change, or is there a mismatch (defect surfaces at 820px but the breakpoint fires at 768px)?
- In-scope fix: adjust the breakpoint value(s) to match where the layout actually needs to change,
  or add an intermediate breakpoint if the existing two-step system leaves a real gap — but only
  when the defect requires it, not as a preemptive redesign of the breakpoint system.
