# DESIGN.md section template

This is the canonical structure `/document` writes into and maintains. It is Google
Stitch-compatible: each heading is a section Stitch (or any design-aware coding agent) can read in
isolation to understand the visual system without re-deriving it from source.

## Ownership markers

`/document` only owns content between a matching pair of HTML comments:

```md
<!-- GENERATED:<section-id> source=/document updated=<ISO date> -->

...generated content...
<!-- /GENERATED:<section-id> -->
```

Rules:

- On a fresh `DESIGN.md`, `/document` emits every section below wrapped in its own
  `GENERATED:<section-id>` pair, `<section-id>` matching the anchor slug in this template
  (`overview`, `typography`, `color`, `spacing`, `components`, `layout`, `motion`, `responsive`,
  `motion-reduced`, `implementation-guidance`, `open-questions`).
- On an update, `/document` re-derives and replaces only the content strictly between an existing
  pair with that exact `section-id`. Anything outside every `GENERATED:*` pair — a human's added
  prose, a custom heading, notes appended after a section, a whole extra section with no marker —
  is preserved byte-for-byte and left in its original position.
- If a `GENERATED:<section-id>` pair exists but its content was hand-edited (no way to tell
  mechanically — treat every existing generated block as a human may have touched it), `/document`
  still regenerates it from the current implementation, because the document's contract is
  "reflects current source," not "preserves prior generated output." Only content _outside_ the
  markers is guaranteed stable.
- If a section this template defines is missing entirely from an existing file (an older
  `DESIGN.md` predates this template, or a section was deleted), `/document` appends it in the
  position this template defines, newly wrapped in its marker pair, rather than skipping it.
- Never invent a `<section-id>` outside the eleven listed above. A human section that doesn't match
  any of them is never touched, never renamed, never merged into a generated one.

## Required sections, in order

### `overview`

One paragraph: what the project/route is, which implementation surfaces this document describes
(file paths inspected), and the generation/update timestamp. States plainly whether a design
direction (Design Plan v2 / selected art direction) was found or is unknown.

### `typography`

Table or list of: font family tokens (variable name -> resolved value), role each family plays
(display/body/mono, or the project's own naming), type scale (sizes actually found, with their
source — a clamp()/rem scale, a Tailwind config, a token file), line-height and letter-spacing
values tied to roles, and weight usage. Every row cites the file it came from. Anything not
determinable is `_Unknown — not found in implementation._`, never a plausible-looking guess.

### `color`

Palette table: token name -> resolved value -> where it's defined -> where/how it's used
(background, text, accent, border, semantic states like error/success if present). Note contrast
relationships only if they were actually computed, not assumed. Flag colors used ad hoc (literal
hex/rgb in component code) separately from tokenized colors, since that's implementation signal a
design-aware agent needs.

### `spacing`

The spacing scale as implemented: base unit, multiplier/step pattern, named tokens if any,
section-level padding conventions (e.g. a `--gutter` custom property), and gap/margin patterns
observed repeatedly. Note when spacing is ad hoc (arbitrary pixel/rem values with no discernible
scale) rather than inventing a scale that doesn't exist.

### `components`

Inventory of reusable primitives actually found (shared UI package, project-local components
directory): name, purpose, key variants/props that affect appearance, and the file path. Not a
full API reference — appearance-relevant surface only.

### `layout`

Grid/flex conventions, breakpoint-independent structural patterns (column counts, container
widths, alignment rules), and page/section composition patterns actually observed (e.g. "12-column
grid with a 1-column gutter border, used across hero/proposition/principles sections").

### `motion`

Transition/animation inventory: what animates, trigger (hover, scroll, load, state change),
duration/easing values, and the technique (CSS transition/keyframes, a JS/animation library). Cite
files.

### `responsive`

Breakpoints actually defined (media query values or a config's breakpoint tokens) and what changes
at each one, per major surface. Note any surface with no responsive handling found, rather than
assuming one exists.

### `motion-reduced`

Whether and how `prefers-reduced-motion` (or an equivalent) is handled, with the exact rule/file.
If none was found, say so explicitly — this is a common, worth-flagging gap, not a silent omission.

### `implementation-guidance`

Short, concrete notes for an agent building new UI in this system: which tokens/primitives to
reuse, naming conventions to follow, and any constraints pulled from `get_design_rules` or a
recorded selected direction (cited by source, never invented).

### `open-questions`

Everything `/document` could not determine from the implementation, each stated as a plain
sentence, not folded silently into another section. This section always exists, even if empty
(state "None." rather than omitting it) — an empty list is itself information.

## Worked example (excerpt)

```md
<!-- GENERATED:color source=/document updated=2026-08-05 -->

## Color

| Token      | Value                | Defined in                | Used for                          |
| ---------- | -------------------- | ------------------------- | --------------------------------- |
| `--blush`  | `#f1dede`            | `frontend/src/styles.css` | Page/hero background              |
| `--rose`   | `#d496a7`            | `frontend/src/styles.css` | Footer text accent                |
| `--taupe`  | `#5d576b`            | `frontend/src/styles.css` | Secondary text, dark section fill |
| `--lake`   | `#6cd4ff`            | `frontend/src/styles.css` | Focus ring, selection, CTA accent |
| `--salmon` | `#fe938c`            | `frontend/src/styles.css` | Status dot, decorative accent     |
| `--ink`    | `#282432`            | `frontend/src/styles.css` | Primary text, dark surfaces       |
| `--paper`  | `#fff8f6`            | `frontend/src/styles.css` | Light surface, inverted text      |
| `--line`   | `rgba(40,36,50,.22)` | `frontend/src/styles.css` | Hairline borders/dividers         |

_Unknown — not found in implementation:_ no semantic error/warning/success tokens were found;
color usage outside this token set was not observed in the inspected files.
<!-- /GENERATED:color -->
```

Notice every value traces to a real file, and the absence of semantic status colors is stated
rather than papered over.
