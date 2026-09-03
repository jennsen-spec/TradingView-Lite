# Logomark assets

Single continuous stroke: cycle loop -> volatile N -> accelerating arrow.
Brand blue `#3A83F7`, symbol `#FFFFFF`. Flat vector, no gradients.

| File | Use |
| --- | --- |
| `logomark.svg` | Symbol only, white, transparent background. Put it on the blue (or any dark) surface. |
| `logomark-dark.svg` | Symbol only, `#0B1220`, for light/white backgrounds. |
| `favicon.svg` | Square blue tile + white symbol. Browser tab icon. |
| `app-icon.svg` | Same tile with rounded corners, for app icons / avatars. |

## Favicon

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/app-icon.png">
```

Copy `favicon.svg` to the app's public/static root. SVG favicons are supported in
all current browsers; add a 32x32 PNG fallback only if you must support legacy IE/Safari:

```
npx svgexport favicon.svg favicon-32.png 32:32
```

## Notes

- The symbol is one filled path — never re-stroke it, the thin-to-thick taper is baked into the outline.
- Minimum size: 16px works, but below ~20px the hairline start of the loop starts to fade.
  For very small sizes prefer `favicon.svg` (the tile gives it contrast).
- Clear space: keep at least 10% of the symbol width empty on every side.
- Do not recolor the symbol to anything other than white, `#0B1220`, or the brand blue.

## iPhone app icon

`logo/png/icon-1024.png` is the App Store / Xcode asset: 1024x1024, square, opaque,
**no rounded corners and no transparency** — iOS applies its own mask. Drop it into
`Assets.xcassets/AppIcon.appiconset` (single-size is enough for Xcode 14+).

For a web app added to the home screen:

```html
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="manifest" href="/site.webmanifest">
```

`site.webmanifest`:

```json
{
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#3A83F7",
  "background_color": "#3A83F7"
}
```

### Rendered sizes

`logo/png/` — `icon-1024`, `icon-512`, `icon-192`, `apple-touch-icon-180`,
`favicon-32`, `favicon-16`. Regenerate any size from `favicon.svg`; it is the master.
