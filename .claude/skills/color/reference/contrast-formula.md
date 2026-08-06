# Contrast-ratio computation method

The exact method `/color` must use to compute every contrast ratio it reports. Loaded only when the
main `SKILL.md` workflow needs the detail (steps 5 and 10).

## 1. Resolve both colors to literal sRGB

Resolve each side of the pairing (foreground and background) from the actual source: follow CSS
custom properties/tokens/theme values to their literal `#rrggbb`/`rgb()`/`hsl()` value for the theme
being checked. If a background is composited from a semi-transparent color over another background
(e.g. `rgba(0,0,0,0.6)` over a photo or another color), flatten it to an opaque equivalent against
its actual backing color before computing luminance — do not compute contrast against a color with
alpha still applied.

Convert to 8-bit sRGB channel values `R8, G8, B8` in `[0, 255]` if not already in that form.

## 2. Relative luminance (WCAG 2.x formula)

For each channel, normalize to `[0, 1]`:

```
c = C8 / 255
```

Linearize each channel:

```
c_lin = c / 12.92                          if c <= 0.03928
c_lin = ((c + 0.055) / 1.055) ^ 2.4        otherwise
```

Relative luminance:

```
L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
```

## 3. Contrast ratio

With `L1` the lighter (higher-luminance) color and `L2` the darker one of the pair:

```
ratio = (L1 + 0.05) / (L2 + 0.05)
```

The result is in `[1, 21]`. Always identify which of the two computed luminances is `L1` — do not
assume the nominal "foreground" is the lighter one; compute both luminances first, then order them.

## 4. Thresholds to apply

- **Normal text:** ratio ≥ 4.5:1 (WCAG AA).
- **Large text:** ratio ≥ 3:1 — "large" means ≥24px (18pt) regular weight, or ≥19px (14pt) bold.
- **Non-text UI components and graphical objects** (icons conveying meaning, input borders, focus
  indicators, chart elements): ratio ≥ 3:1 against adjacent color(s).
- Report which threshold applies and why (font size/weight, or component type) alongside every ratio.

## 5. Worked example

Pairing: body text `color: var(--text-muted)` resolving to `#6b7280` on `background:
var(--surface)` resolving to `#f9fafb`, 16px regular weight (normal text, 4.5:1 threshold).

```
Foreground #6b7280 -> R8=107 G8=114 B8=128
  r=0.4196 g=0.4471 b=0.5020
  r_lin = ((0.4196+0.055)/1.055)^2.4 = 0.1329
  g_lin = ((0.4471+0.055)/1.055)^2.4 = 0.1529
  b_lin = ((0.5020+0.055)/1.055)^2.4 = 0.1979
  L_fg = 0.2126*0.1329 + 0.7152*0.1529 + 0.0722*0.1979 = 0.1520

Background #f9fafb -> R8=249 G8=250 B8=251
  r=0.9765 g=0.9804 b=0.9843
  r_lin = ((0.9765+0.055)/1.055)^2.4 = 0.9376
  g_lin = ((0.9804+0.055)/1.055)^2.4 = 0.9455
  b_lin = ((0.9843+0.055)/1.055)^2.4 = 0.9534
  L_bg = 0.2126*0.9376 + 0.7152*0.9455 + 0.0722*0.9534 = 0.9440

L1 (lighter) = L_bg = 0.9440, L2 (darker) = L_fg = 0.1520

ratio = (0.9440 + 0.05) / (0.1520 + 0.05) = 0.9940 / 0.2020 = 4.92

Threshold: normal text, 4.5:1 -> 4.92 >= 4.5 -> PASS
```

Report every computation in this same explicit form: both literal colors, both luminances (or the
intermediate linearized channel values when the reader would need to check the arithmetic), the
ordered ratio calculation, the threshold applied, and the pass/fail result — for both the "before"
and "after" value when a color changes, and separately per theme variant when more than one theme
exists.

## Common mistakes to avoid

- Computing contrast against a token's _name_ or a color the token is "supposed to represent" instead
  of its actual resolved literal value in the theme being checked.
- Skipping alpha-compositing before computing luminance for translucent foregrounds/backgrounds.
- Reusing a light-mode-computed ratio for a dark-mode claim, or vice versa, when the token resolves
  differently per theme.
- Applying the 4.5:1 threshold to large text (3:1 applies) or to non-text UI components (3:1 applies)
  without checking size/weight/component type first.
- Rounding a borderline ratio (e.g. 4.48) up to "passes" — report the real computed value and the
  correct pass/fail against the threshold.
