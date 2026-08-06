# State-coverage matrix

`/states` audits a component against this matrix before deciding what to add. A state is
"required" for a component type only when that component's real interaction model or data source
can actually produce it — never add a row's state to a component that structurally cannot reach it
(e.g. `loading` on a component with no async data dependency, or `empty` on a component that never
renders a collection).

Legend: **R** = required when reachable, **C** = conditional (required only if the named
precondition holds), **—** = not applicable, do not add.

| Component type                               | hover | focus-visible | active | selected | disabled | loading | empty | error | success | skeleton |
| -------------------------------------------- | :---: | :-----------: | :----: | :------: | :------: | :-----: | :---: | :---: | :-----: | :------: |
| Button / icon button                         |   R   |       R       |   R    |    —     |    R     |   C¹    |   —   |   —   |   C²    |    —     |
| Link (in-app navigation)                     |   R   |       R       |   R    |    —     |    C³    |    —    |   —   |   —   |    —    |    —     |
| Toggle / switch / checkbox / radio           |   R   |       R       |   R    |    R     |    R     |    —    |   —   |   —   |    —    |    —     |
| Tab / segmented control item                 |   R   |       R       |   R    |    R     |    C³    |    —    |   —   |   —   |    —    |    —     |
| Menu item / combobox option / list row       |   R   |       R       |   R    |    R     |    C³    |    —    |   —   |   —   |    —    |    —     |
| Text input / textarea / select               |   R   |       R       |   —    |    —     |    R     |   C⁴    |   —   |   R   |   C²    |    —     |
| Form (submit flow)                           |   —   |       —       |   —    |    —     |    R⁵    |    R    |   —   |   R   |    R    |    —     |
| Data table / list (collection view)          |  C⁶   |      C⁶       |   —    |    C⁶    |    —     |    R    |   R   |   R   |    —    |    R     |
| Card (interactive, e.g. clickable row)       |   R   |       R       |   R    |    C³    |    C³    |    —    |   —   |   —   |    —    |    —     |
| Card (static content container)              |   —   |       —       |   —    |    —     |    —     |    —    |  C⁷   |   —   |    —    |    C⁷    |
| Modal / dialog trigger + content             |  R⁸   |      R⁸       |   R⁸   |    —     |    C³    |   C⁴    |   —   |   R   |   C²    |    —     |
| Async panel / widget (fetches its own data)  |   —   |       —       |   —    |    —     |    —     |    R    |   R   |   R   |   C²    |    R     |
| Route / page (top-level data-dependent view) |   —   |       —       |   —    |    —     |    —     |    R    |   R   |   R   |    —    |    R     |
| Toast / inline status message                |   —   |       —       |   —    |    —     |    —     |    —    |   —   |   R   |    R    |    —     |
| Tooltip / popover trigger                    |   R   |       R       |   —    |    —     |    C³    |    —    |   —   |   —   |    —    |    —     |
| Drag handle / sortable item                  |   R   |       R       |   R    |    C⁶    |    C³    |    —    |   —   |   —   |    —    |    —     |

Footnotes:

1. **loading (button):** required only when the button's own `onClick`/`onSubmit` handler awaits an
   async call it triggers directly (e.g. a submit or async action button). A button that only
   navigates or toggles local state has no loading state to add.
2. **success:** required only when the underlying action returns a distinguishable success result
   the UI can read (a resolved promise, a status field, a mutation result) — never add a timed
   "success" flash with no backing signal.
3. **disabled (conditional):** required only when the component has a real precondition that can
   make it non-interactive (permission check, unmet form validity, already-selected state, in-flight
   parent action). Do not add `disabled` as a static decoration with no condition driving it.
4. **loading (input/dialog):** required only when the field/dialog performs an async lookup it owns
   (e.g. async-validated input, an async-populated dialog body).
5. **disabled (form):** the submit control must reflect `aria-disabled`/`disabled` tied to real
   validity and in-flight state, not a decorative style.
6. **collection view interaction states:** required only for rows/cells that are themselves
   interactive (sortable header, selectable row, clickable cell). A purely presentational table has
   none of these.
7. **static card:** `empty`/`skeleton` apply only when the card's content comes from an async or
   collection data source (e.g. a stat card fed by a query) — a card with hard-coded static content
   has neither.
8. **modal interaction states:** apply to the actionable elements inside the dialog (buttons,
   inputs), not to the dialog surface itself.

## How `/states` uses this matrix

1. Classify each component in scope by the closest row above. If a component spans multiple rows
   (e.g. a data table with an inline "add row" button), evaluate each part against its own row.
2. For every **R** cell, verify the state exists, is wired to real data/logic (not a hard-coded
   visual variant with no trigger), and uses accessible semantics (see
   [`accessible-state-semantics.md`](accessible-state-semantics.md)).
3. For every **C** cell, first confirm the stated precondition is actually present in this
   component's logic/data layer. If the precondition doesn't exist, the state is out of scope —
   do not invent a loading/disabled/empty condition the component has no way to enter.
4. Never add a row or state type not listed here without stating the extension explicitly in the
   final report and justifying why the taxonomy needed to grow for this component.
