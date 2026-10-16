# Brand: Zuuuw Studio Aura

Every image in this repository uses the **Zuuuw Studio Aura** design system: a cool light page, white glass cards, blue as an accent (not a fill) and at most one navy panel per image. This page lists the tokens the images use, so new art stays consistent. All copy is in English.

## Look

- Light page `#f3f5f8`, with optional soft blue blobs in the background.
- White glass cards: radius 24, 1px border `#e2e8f0`, inset highlight `inset 0 1px 0 #fff` and a soft two-layer shadow (`0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)`).
- Light-blue tiles (`accent-50`) inside cards, mono pills, generous radii.
- At most **one navy panel** per image: gradient `#172033 -> #101827`, dotted grid and a soft blue glow. Text on navy uses `#e8edf6` and `#9fb0c7`.
- No multicolor gradient titles and no emoji. Agent colors appear only as small dots and pill labels.
- No logo is drawn: there is no official Zuuuw logo file in this repository.

## Color tokens

| Group | Token | Value |
|---|---|---|
| Surface | page / glass / sunken | `#f3f5f8` / `#ffffff` / `#eef1f5` |
| Surface | navy panel | `#172033 -> #101827` |
| Accent | 50 / 100 / 300 / 400 | `#eef3ff` / `#dbe6ff` / `#8fb4fb` / `#5b8bf5` |
| Accent | **500 (brand)** / 600 / 700 | **`#346df2`** / `#2b62e6` / `#1f4fc6` |
| Ink | strong / ink / body / muted / faint | `#020617` / `#0f172a` / `#475569` / `#64748b` / `#94a3b8` |
| Ink on navy | on-inverse / muted | `#e8edf6` / `#9fb0c7` |
| Border | hairline / strong | `#e2e8f0` / `#cbd5e1` |
| Status | success (bg / ink) | `#ecfdf5` / `#047857` |
| Status | warning (bg / ink) | `#fff7ed` / `#b45309` |
| Status | neutral dark (bg / ink) | `#334155` / `#ffffff` |
| Status | blocked (bg / ink) | `#eef1f5` / `#475569` |
| Signal dots | red / amber / emerald | `#fca5a5` / `#fcd34d` / `#6ee7b7` |

Status is always a color **plus** a text label (for example a green pill that says `Normal`).

Primary button style: gradient `accent-400 -> accent-600`, border `accent-700`, soft blue glow.

### Agent dots (harmonized)

On light surfaces the agent hues are darkened so labels keep 4.5:1 contrast on white: claude `#c2410c`, codex `#047857`, cursor `#1f4fc6`, grok `#6d28d9`, antigravity `#b45309`, muse `#be185d`. On the navy panel they switch to the light tints `#fdba74`, `#6ee7b7`, `#8fb4fb`, `#c4b5fd`, `#fcd34d` and `#f9a8d4`.

## Type

- **Inter** 300 to 600 for UI. Display XL 76/0.92, weight 300, -0.05em; display LG 52/0.95, weight 400, -0.04em; H1 28, weight 500, -0.03em; H2 20, weight 500; H3 16, weight 600; body 14/1.6; caption 12.
- **JetBrains Mono** 400 to 600 for eyebrows (11px, weight 500, +0.14em, uppercase), pills (12px), every number (`tabular-nums`) and strong data (22, weight 600).
- The images use a 1920x1080 canvas (1280x640 for the social preview), so sizes are scaled up from these UI values.

## Spacing, radii and icons

- 4px base: 8 between controls, 16 between cards, 22 section padding, 28 margins.
- Radii: control 8, field 10, surface 12, overlay 16, brand 20, card 24, panel 32, hero 44, pill 9999.
- Icons: line icons with a 1.5px stroke, lucide style.

## Accessibility

Text keeps at least 4.5:1 contrast. Checked pairs include body ink on the page (6.9:1), muted ink on white (4.8:1), success ink on its background (5.2:1), warning ink on its background (4.7:1), white on `accent-500` (4.55:1) and muted ink on navy (7.4:1).

## Badges

README badges use the brand blue `#346df2`.
