# Wot Da Fill

One design, a list of names, every card ready to send. Upload an invitation (or certificate, name badge...), mark where the name goes, load a CSV/Excel list or paste one, and download every personalized card, automatically compressed, in a single zip.

Made by [Wot Da Fong](https://wotdafong.dev). No accounts, no sign-in.

## What it does

Three steps, shown in the top bar and always one click away: **Design**, **Names**, **Text**, then one button makes every card. The UI follows the Wot Da Fill design system (Wot Da Fong brand: paper, ink, cobalt, system fonts).

- **Design**: drop a JPG, PNG or WebP. A text box for the name is placed in the middle straight away, showing an example name until there is a list. Replacing the design later keeps the layout (scaled to the new size).
- **Names**: paste names (one per line, or cells copied from Excel/Sheets) or drop a CSV / TSV / XLSX / XLS / ODS file into the same box. How the list is split and whether the first row is headings are worked out automatically; the manual choices sit behind "Looks wrong?". A sheet picker appears only when a file has several sheets with names. Handles UTF-8, UTF-16 and Windows-1258 CSVs, normalizes Vietnamese to NFC, and formats unformatted dates as dd/mm/yyyy.
- **Text**: what each box says, such as `Kính mời {Họ tên}` or `Bàn số {Bàn}`; "Add from your list" inserts a column, and "Card number" inserts `{#}`. Font, size, colour and alignment are on show; thickness, italic, capital letters, letter spacing, line height, top/middle/bottom, shrinking, wrapping and exact position wait behind "More options". Drag on an empty spot to add another box; move, resize (8 handles, Alt = from the center), snap to the center lines, nudge with the arrow keys (Shift = 10 px).
- **Fonts**: curated invitation picks, search all ~1,700 Google Fonts (fonts without Vietnamese accents are flagged and listed last), or use your own TTF/OTF/WOFF (SVN-/UTM- fonts work).
- **Fit check**: long names shrink to fit their box. Every name is checked against its box; names that spill over, or shrink to well under the size most names get in that box (below 60%), are counted in a warning with "Show me", which steps through them. Text that uses a column the list doesn't have gets its own warning.
- **Automatic compression, TinyPNG/Clop style**: nothing to configure. Cards keep the design's format and size: JPEG designs become MozJPEG (quality 80, progressive), PNG designs get a dithered 256-color palette plus OxiPNG, WebP stays WebP. Metadata is stripped.
- **Make the cards**: one progress bar with time left; cancel any time. The zip downloads by itself; the finished dialog shows the cards (click one to save it alone), with sizes and timing under "Details". Files are named `001-<name>.<ext>` from the first column the text uses, and the zip includes `_manifest.csv` mapping files to rows.
- **Share a layout**: uploads the design, layout and any fonts you added (never the list) and copies a `/t/<id>` link. Opening the link lands on Names, saying which columns the layout uses.
- **Undo**: every change to text boxes can be undone and redone. Start over (More menu) and removing a box offer Undo instead of asking first.

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
| `src/client/components/` | Editor (canvas + boxes), the Names and Text panels, font picker, card/share dialogs, shared UI (`ui.tsx`) |
| `src/client/lib/render.ts` | Text layout and drawing shared by preview and export |
| `src/client/lib/fit.ts` | Checks every name against its box for the fit warning |
| `src/client/lib/generate.ts` | Batch pipeline: fonts → render → encode pool → zip |
| `src/client/lib/encoder.worker.ts`, `pool.ts` | WASM encoders in a worker pool |
| `src/client/lib/data.ts` | CSV/Excel/paste parsing |
| `src/client/data/google-fonts.json` | Font catalog; refresh with `pnpm fonts:update` |

## Notes

- `pnpm-workspace.yaml` overrides `wasm-feature-detect` to 1.9.0: 1.10.0 (released 2026-11-09) uses `import.source(...)`, which browsers can't parse yet, and it breaks the encoder worker. Remove the override once a fixed release is out.
- pnpm 12's default `minimumReleaseAge` (1 day) holds back releases younger than a day, so a few dev tools sit one patch behind the newest.
- `compatibility_date` is 2026-11-08, the newest date the bundled workerd supports.
- The UI follows the Wot Da Fong brand kit: system font stacks with Vietnamese coverage, paper/ink/cobalt tokens, light and dark. Google Fonts are only downloaded for the card text you choose.
