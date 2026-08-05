# `/cleanup` validation fixtures

Minimal, isolated fixtures used to exercise `.claude/skills/cleanup/SKILL.md`'s classification
workflow before the skill was shipped. They are not part of a build target and are not imported by
any application code; they exist only to give the skill's guidance something concrete to reason
about.

- `case1-duplicated-tokens/` — duplicated `border-radius`/`padding` literals plus an existing token
  whose value doesn't match what's actually in use. Exercises "safe mechanical" vs. "design-judgment"
  classification: the duplication is mechanically observable, but choosing a token/value is a
  judgment call. Because the existing token resolves to `8px`, the expected outcome retains the
  `12px` literals until that design decision is approved.
- `case2-behavior-sensitive/` — a redundant-looking wrapper `<div>` where the _inner_ div actually
  carries the click handler, `tabIndex`, and `role`. Exercises "behavior-sensitive" classification:
  collapsing the markup naively would silently move interaction/a11y semantics.
- `case3-uncertain-dead-code/` — a component with no local/direct-import usage, referenced only
  through a string-keyed `componentRegistry` lookup in a sibling file. Exercises "uncertain":
  correct behavior is to retain it, not delete it on the strength of a shallow search.

A fresh subagent was given only `SKILL.md` and the `before.*`/case-3 files (not the `after.*` answer
keys) and asked to classify each case per the skill's Step 3/4 workflow without editing anything.
Result: it classified case 1 as mechanical-dedup-plus-design-judgment (correctly flagging the
value mismatch rather than silently reusing the mismatched token), case 2 as behavior-sensitive with
an explicit plan to preserve `onClick`/`tabIndex`/`role`, and case 3 as uncertain — explicitly
declining to delete `LegacyBadge` because of the `registry.ts` reference, and naming the repo-wide
search it would still run before ever treating it as a deletion candidate.

`after.css` records the intentional no-change outcome for case 1, while `after.tsx` records the
behavior-sensitive outcome for case 2. Case 3 has no `after.*` because its correct outcome is also
"no change."
