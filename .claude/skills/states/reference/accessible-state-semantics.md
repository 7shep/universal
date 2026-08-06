# Accessible state semantics

Reference for how `/states` must express each state so it stays accessible, not just visually
present. Reuse the project's existing tokens/primitives for the visual treatment in every row below
— this file governs semantics and wiring, not color or spacing values.

## disabled vs. `aria-disabled`

- Use native `disabled` (or the primitive's `isDisabled`/`disabled` prop, which should already map
  to the native attribute) when the control must be fully inert: unfocusable, unclickable, excluded
  from the tab order, and not announced as actionable.
- Use `aria-disabled="true"` **instead of** native `disabled` when the control must stay focusable
  and independently discoverable — for example, a submit button that is not yet valid but should
  still be reachable by keyboard so screen reader users can discover _why_ it's disabled (paired
  with `aria-describedby` pointing at the validation message), or any control inside a toolbar/tab
  sequence where removing it from the tab order would break expected keyboard navigation.
- Never combine both in a way that contradicts the actual condition: don't set `aria-disabled="false"`
  on a natively `disabled` element (redundant and can desync on re-render), and don't leave a
  visually greyed-out control with neither attribute set (a purely cosmetic disabled state is not a
  disabled state).
- The condition driving either attribute must come from real logic (form validity, permission check,
  in-flight mutation, already-applied selection) — never a hard-coded `true`.

## loading and `aria-busy`

- Set `aria-busy="true"` on the container whose content is being replaced or is still arriving
  (the panel, the form, the button's content region) for the duration of the async operation, and
  remove it when the operation settles (success or error) — don't leave it stuck true.
- A loading button keeps its accessible name meaningful: either keep the label and add a visually
  and programmatically indicated busy state (spinner marked `aria-hidden="true"` plus `aria-busy`
  on the button), or swap to a label that still describes the pending action (e.g. "Saving…") rather
  than becoming an unlabeled spinner.
- Pair `aria-busy` with `disabled`/`aria-disabled` on the specific control that triggered the async
  action so it cannot be re-triggered mid-flight, but do not mark unrelated controls busy or
  disabled as a side effect.
- Skeleton placeholders live inside an `aria-busy="true"` region and should not themselves carry
  redundant, noisy live-region text; a single accessible loading announcement per region is enough
  (e.g. `aria-live="polite"` status text or an `aria-label` on the busy region, not both racing).

## selected

- Prefer the semantics native to the pattern: `aria-selected` for listbox/tab/grid-style selection,
  `aria-checked` for checkbox/switch/radio-style toggles, `aria-current="page"` (or `"true"` for
  non-page steps) for a currently-active nav/step item. Don't reach for `aria-pressed` unless the
  control is genuinely a toggle button.
- The selected visual treatment (border, fill, weight) must track the same boolean driving the ARIA
  attribute — never style `:hover`/a class name as a proxy for selection without the attribute
  present.

## error and success

- An error state on a field pairs a visible message with `aria-invalid="true"` and
  `aria-describedby` referencing the message's id, sourced from real validation output — not a
  static example string left in place.
- A success state must originate from an actual resolved result (mutation response, confirmed
  write, validated field) and should be announced through the same live-region pattern already used
  for errors in that component, so success and error are symmetric rather than one being an
  afterthought.

## focus-visible and hover

- Use the project's existing `:focus-visible` treatment (token-driven outline/ring), not `:focus`,
  so mouse users don't get a persistent ring after a click.
- Never remove focus indication (`outline: none`) without substituting an equally visible
  alternative built from existing focus tokens.
- Hover-only affordances must have a focus-visible and touch-usable equivalent — a state that only
  appears on `:hover` is not complete coverage for keyboard or touch users.

## empty

- Empty states must reflect an actual "collection loaded, zero items" condition distinguishable from
  "still loading" (covered by `loading`/`aria-busy`) and from "errored" (covered by `error`). Do not
  render empty copy while a fetch is still in flight or after it has failed.
