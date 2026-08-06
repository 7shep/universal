# Motion checklist

Fallback guidance for `/animate` when the Universal MCP (`get_design_rules` with category
`motion`, `get_taste_profile`) is unavailable. When the MCP is reachable, its returned
`motionPrinciples`, `antiPatterns`, and `implementationConstraints` take precedence over this file
— treat this as the local default, not an override.

## Motion categories in scope for `/animate`

- **Transitions** — state changes that benefit from continuity: route/view changes, tab switches,
  modal/drawer open-close, list item add/remove/reorder, expand/collapse.
- **Micro-interactions** — feedback on direct manipulation: button press, toggle flip, checkbox
  check, input focus, drag handle response, form field validation feedback.
- **Scroll effects** — reveal-on-scroll for content entering the viewport, scroll-linked progress
  indicators, sticky-header state changes. Restrained: entrance-only by default, not parallax or
  scroll-jacking unless explicitly requested and justified.
- **Loading feedback** — skeleton states, spinners, progress bars, optimistic-UI transitions,
  button pending states. Every async action a user can trigger should have visible feedback if it
  can take longer than ~150-200ms.
- **Reduced-motion fallbacks** — a substitute for every animation above that still communicates the
  state change without relying on movement.

## Duration and easing defaults

Use these when the project has no existing motion tokens to reuse:

| Motion type                                 | Duration                     | Easing                                                         |
| ------------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| Micro-interaction (hover, press, focus)     | 100-150ms                    | ease-out                                                       |
| Small UI transition (toggle, tooltip, menu) | 150-250ms                    | ease-out (entering) / ease-in (leaving)                        |
| Larger transition (modal, drawer, route)    | 250-400ms                    | ease-in-out                                                    |
| Scroll-triggered reveal                     | 300-500ms                    | ease-out, with a small translate (8-24px), not a full slide-in |
| Loading/progress (indeterminate)            | continuous, capped intensity | linear (spinners) or ease-in-out (pulses)                      |

Anything longer than ~500ms for a UI-feedback transition needs a stated reason (e.g. it mirrors an
existing product convention) — long transitions read as sluggish, not premium.

## Performance rules

- Prefer animating `transform` and `opacity`. They run on the compositor and don't trigger
  layout/paint on every frame.
- Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding`, or box-shadow spread on
  every frame; if a size change is required, prefer `transform: scale()` or restructure so a
  `max-height`/`grid-template-rows` transition is the only non-compositor property involved, and
  say so.
- Avoid triggering animations on more than the affected element/list — don't force a reflow of
  unrelated siblings.
- Don't run more than one continuous/looping animation per view without a stated reason; each one
  costs battery and attention.
- Debounce or coalesce scroll-linked effects (e.g. `IntersectionObserver` for reveals, not a raw
  `scroll` listener recalculating layout every frame).

## Accessibility rules

- Every animation this skill adds must have a `prefers-reduced-motion: reduce` fallback, e.g.:

  ```css
  @media (prefers-reduced-motion: reduce) {
    .card-enter {
      animation: none;
      transition: opacity 120ms ease-out;
    }
  }
  ```

  The fallback should still communicate the underlying state change (the card still appears/
  disappears) — it just does so with little or no movement, not by silently doing nothing.

- Never remove an element from the accessibility tree, hide a `:focus-visible` outline, or make a
  control briefly unfocusable purely to make a transition look cleaner.
- Keep interactive elements operable throughout a transition; don't block a click/keypress on an
  in-flight animation unless the underlying state genuinely isn't ready yet.
- Auto-playing, looping motion (carousels, marquees, background animation) needs a way to pause or
  must already be an accepted part of the product's existing design direction — don't introduce a
  new one silently.

## When a library might be justified

Default to CSS transitions/animations and the Web Animations API. Adding a dependency
(Framer Motion, GSAP, react-spring, Lottie, etc.) is justified only when:

- it is already a dependency of the project (check `package.json` first), or
- the requested motion is a genuinely complex sequence (physics-based spring chains, coordinated
  layout animations across unrelated DOM nodes, complex SVG path morphing) that CSS/WAAPI cannot
  reasonably express, and the justification is stated explicitly in the report.

A single fade, slide, scale, or scroll reveal is never sufficient justification on its own.
