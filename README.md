# Wot Da Fill

One design, a list of names, every card ready to send. Upload an invitation (or certificate, name badge...), mark where the name goes, load a CSV/Excel list or paste one, and download every personalized card, automatically compressed, in a single zip.

Made by [Wot Da Fong](https://wotdafong.dev). No accounts, no sign-in.

## What it does

- **Design**: drop a JPG, PNG or WebP. Replacing it later keeps the layout (scaled to the new size).
- **Text areas**: drag on the design to add a box; move, resize (8 handles, Alt = from the center), snap to the center lines, nudge with the arrow keys (Shift = 10 px). Several areas per card, each with text like `Kính mời {Họ tên}` or `Bàn số {Bàn}`, plus `{#}` for the row number.
- **Fonts**: search all ~1,700 Google Fonts (Vietnamese-only filter on by default), curated invitation picks, or upload your own TTF/OTF/WOFF (SVN-/UTM- fonts work). Weight and italic, color, alignment, letter case, letter spacing, line height.
- **Fitting**: long names shrink to fit their box (with a minimum size); optional wrapping onto several lines. The preview flags boxes that still overflow, and "Longest" jumps to the longest name.
- **Lists**: CSV / TSV / XLSX / XLS / ODS (sheet picker), or paste (one per line, or cells copied from Excel/Sheets). Handles UTF-8, UTF-16 and Windows-1258 CSVs, normalizes Vietnamese to NFC, and formats unformatted dates as dd/mm/yyyy.
- **Automatic compression, TinyPNG/Clop style**: nothing to configure. Cards keep the design's format and size: JPEG designs become MozJPEG (quality 80, progressive), PNG designs get a dithered 256-color palette plus OxiPNG, WebP stays WebP. Metadata is stripped.
- **Generate**: progress bar with speed, time left, average size and savings versus your design file; cancel any time. Files are named `001-<name>.<ext>` from the first column the text uses, and the zip includes `_manifest.csv` mapping files to rows.
- **Share template**: uploads the design, layout and fonts (never the list) and returns a `/t/<id>` link.

## How it works

```
Browser                                                          Cloudflare
───────                                                          ──────────
React UI ── canvas render (main thread, same code as preview)    Workers Static Assets (the app)
             │ ImageData, transferred                            Worker /api/* (Hono)
             ▼                                                     ├─ R2 TEMPLATES: shared templates
           Worker pool (N = cores-1, max 6)                        └─ Rate Limiting: 10 shares/min/IP
             MozJPEG / WebP / image-q + OxiPNG (WASM, jSquash)
             │ Blobs
             ▼
           client-zip (stored, streamed) → download
```

All rendering and compression happens in the browser: it's fast (no upload), private (the guest list never leaves the device), and costs nothing per card. Cloudflare serves the app and hosts shared templates. The Worker validates uploads by magic bytes (JPEG/PNG/WebP, TTF/OTF/WOFF/WOFF2), caps sizes, writes `config.json` last so half-written templates never appear, and serves files with `nosniff` and immutable caching.

## Develop

```sh
pnpm install
pnpm dev          # Vite + the Worker in workerd, with a local R2 bucket and rate limiter
```

```sh
pnpm build        # typecheck + production build
pnpm preview      # serve the production build in workerd
```

## Deploy

One-time: create the R2 bucket, and optionally expire shared templates after 30 days.

```sh
pnpm wrangler r2 bucket create wot-da-fill-templates
pnpm wrangler r2 bucket lifecycle add wot-da-fill-templates expire-templates t/ --expire-days 30
```

Then:

```sh
pnpm run deploy
```

After changing bindings in `wrangler.jsonc`, run `pnpm cf-typegen`.

## Project layout

| Path | What |
| --- | --- |
| `src/worker/index.ts` | Hono API: create/read shared templates (R2), rate limit |
| `src/client/App.tsx` | App state and layout |
| `src/client/components/` | Editor (canvas + boxes), panels, font picker, generate/share dialogs |
| `src/client/lib/render.ts` | Text layout and drawing shared by preview and export |
| `src/client/lib/generate.ts` | Batch pipeline: fonts → render → encode pool → zip |
| `src/client/lib/encoder.worker.ts`, `pool.ts` | WASM encoders in a worker pool |
| `src/client/lib/data.ts` | CSV/Excel/paste parsing |
| `src/client/data/google-fonts.json` | Font catalog; refresh with `pnpm fonts:update` |

## Notes

- `pnpm-workspace.yaml` overrides `wasm-feature-detect` to 1.9.0: 1.10.0 (released 2026-11-09) uses `import.source(...)`, which browsers can't parse yet, and it breaks the encoder worker. Remove the override once a fixed release is out.
- pnpm 12's default `minimumReleaseAge` (1 day) holds back releases younger than a day, so a few dev tools sit one patch behind the newest.
- `compatibility_date` is 2026-11-08, the newest date the bundled workerd supports.
- The UI follows the Wot Da Fong brand kit: system font stacks with Vietnamese coverage, paper/ink/cobalt tokens, light and dark. Google Fonts are only downloaded for the card text you choose.
