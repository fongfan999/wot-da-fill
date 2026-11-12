# Wot Da Fill

One design, a list of names, a finished card for every name. Add a picture of your invitation, certificate or name badge, paste your list or drop an Excel or CSV file, drag the name into place, and download every card in a single zip. Everything is made in your browser; the list never leaves your device.

Made by [Wot Da Fong](https://wotdafong.dev). No accounts, no sign-in. Live at [fill.wotda.app](https://fill.wotda.app).

## What it does

The whole site comes in English and Vietnamese, with a home page for each: `/` and `/vi/`. A home page's address decides its language. A first visit to `/` moves to `/vi/` before anything is drawn when the browser's language or region is Vietnamese (`vi`, any `-VN` locale, or a Vietnamese time zone), or when Vietnamese was chosen before; the flag button in the home page's top bar (or the More menu in the editor) changes it, moves the address to match, and the choice is remembered on this device. Share links follow the remembered choice or the browser. The three examples (an invitation, a certificate and a name badge, drawn by `lib/sample.ts`) follow the same setting. A person's own design and list are never changed. Every string lives in `src/client/lib/i18n.tsx`. A sun/moon button beside the flag switches between light and dark; until someone presses it the site follows the system setting, and the choice is remembered (`src/client/lib/theme.ts`).

The UI follows the Wot Da Fill design system (Wot Da Fong brand: paper, ink, cobalt, system fonts).

- **Home page**: what it does, a moving example (the name on a card changing as the list is stepped through), the drop zone, three steps, and the three examples to start from. Anyone without a design sees it.
- **Design**: drop a JPG, PNG or WebP. A text box for the name is placed in the middle straight away, in a colour taken from the design, showing an example name until there is a list. Replacing the design later keeps the layout (scaled to the new size).
- **The editor**: the design on the left, a side panel with two tabs on the right, **Text** and **Names**, filled in either order. The top bar shows which name is on the design (with previous and next), undo and redo, a button that hides the box outlines, Share and a More menu. One button at the bottom of the panel always says what comes next: "Add your names", then "Make 120 cards".
- **Names**: a small spreadsheet. Type names, paste cells from Excel or Google Sheets, or drop a CSV / TSV / XLSX / XLS / ODS file anywhere on the tab. Headings are worked out automatically, with a switch to correct the guess for a file; a sheet picker appears only when a file has several sheets with names. Handles UTF-8, UTF-16 and Windows-1258 CSVs, normalizes Vietnamese to NFC, and formats unformatted dates as dd/mm/yyyy. Clearing the list offers Undo.
- **Text**: what each box says, such as `Kính mời {Họ tên}` or `Bàn {Bàn}`; "Add from your list" inserts a heading, and "Card number" inserts `{#}`. Font, size, alignment and colour (with colours picked from the design) are on show; thickness, italic, capital letters, letter spacing, line spacing, shrinking, wrapping and exact position wait behind "More options". Drag on an empty spot to add another box; move, resize (8 handles, Alt = from the center), snap to the center lines, move with the arrow keys (Shift = further).
- **Fonts**: curated invitation picks, search all ~1,700 Google Fonts, or use your own TTF/OTF/WOFF (SVN-/UTM- fonts work).
- **Fit check**: long names shrink to fit their box. Every name is checked against its box; names that spill over, or shrink to well under the size most names get in that box (below 60%), are counted in a warning with "Show me", which steps through them. Text that uses a heading the list doesn't have gets its own warning.
- **Automatic compression, TinyPNG/Clop style**: nothing to configure. Cards keep the design's format and size: JPEG designs become MozJPEG (quality 80, progressive), PNG designs get a dithered 256-color palette plus OxiPNG, WebP stays WebP. Metadata is stripped.
- **Make the cards**: one progress bar with time left; cancel any time. Nothing downloads by itself: the finished dialog shows the cards, "Download all" saves the zip, each card has its own download button, and clicking a card opens it full size with arrows to step through the rest. Sizes and timing sit under "Details". Files are named `1-<name>.<ext>` from the first heading the text uses, and the zip includes `_list.csv` (`_danh-sach.csv` in Vietnamese) showing which card belongs to which name.
- **Share a layout**: uploads the design, the text boxes and any fonts you added (never the list) and copies a `/t/<id>` link. Opening the link lands on Names, saying which headings the layout uses.
- **Undo**: every change to text boxes can be undone and redone. Start over (the logo, or the More menu), removing a box and clearing the list offer Undo instead of asking first.

## How it works

```
Browser                                                          Cloudflare
───────                                                          ──────────
React UI ── canvas render (main thread, same code as preview)    Workers Static Assets (the app)
             │ ImageData, transferred                            Worker /api/* (Hono)
             ▼                                                     ├─ R2 TEMPLATES: shared templates
           Worker pool (N = cores-1, max 6)                        └─ Rate Limiting: 10 shares/min/IP
             MozJPEG / WebP / palette + OxiPNG (WASM, jSquash)
             │ Blobs
             ▼
           client-zip (stored, streamed) → download
```

Besides the home page, there is a page for each problem people search for: guest names on invitations, names on certificates, name badges from Excel, and mail merge onto a picture (`/invitation-names`, `/vi/dien-ten-thiep-moi`, and so on). Each is the home page with its own heading, a few points on that use and a list of questions; the addresses and words live in `src/client/lib/pages.ts`, and the footer links them all. The flag button keeps you on the same page in the other language.

Every page is pre-rendered in both languages at build time (`scripts/prerender.mjs`, after `vite build`) with the app's own components, so search engines and AI crawlers read the whole page, and the app takes it over when it loads (`hydrateRoot` in `main.tsx`). Each gets its own title, description, canonical address, `hreflang` links, social card and JSON-LD (`WebApplication`, plus `FAQPage` on the problem pages); the script also writes `sitemap.xml`. To add a page, add it to `pages.ts`: the build, sitemap and footer links pick it up, and so does the dev server as long as the address has a hyphen in it (`vite.config.ts`). Share links (`/t/<id>`) go through the Worker, which serves the empty app (`app.html`) with `X-Robots-Tag: noindex`; any other unknown address gets `404.html` with a 404. Anything the home page draws must give the same result in Node as in the browser: no `window`, `localStorage` or `navigator` while rendering.

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
| `src/client/components/` | Home page, editor (canvas + boxes), the Text and Names panels, the names grid, font picker, card/share dialogs, shared UI (`ui.tsx`) |
| `src/client/lib/render.ts` | Text layout and drawing shared by preview and export |
| `src/client/lib/fit.ts` | Checks every name against its box for the fit warning |
| `src/client/lib/i18n.tsx` | The site's language and every English and Vietnamese string |
| `src/client/lib/generate.ts` | Batch pipeline: fonts → render → encode pool → zip |
| `src/client/lib/encoder.worker.ts`, `pool.ts` | WASM encoders in a worker pool |
| `src/client/lib/data.ts` | CSV/Excel/paste parsing |
| `src/client/data/google-fonts.json` | Font catalog; refresh with `pnpm fonts:update` |

## Notes

- `pnpm-workspace.yaml` overrides `wasm-feature-detect` to 1.9.0: 1.10.0 (released 2026-11-09) uses `import.source(...)`, which browsers can't parse yet, and it breaks the encoder worker. Remove the override once a fixed release is out.
- pnpm 12's default `minimumReleaseAge` (1 day) holds back releases younger than a day, so a few dev tools sit one patch behind the newest.
- `compatibility_date` is 2026-11-08, the newest date the bundled workerd supports.
- PNG cards are reduced to 256 colours in the workers by `encoder.worker.ts` itself: `image-q` only chooses the palette, from a sample of at most 250,000 pixels, and the dithering runs on plain byte arrays. Passing whole cards through `image-q` costs about half a gigabyte per worker (it keeps an object per pixel), which took six workers past the tab's memory limit and crashed the page on long lists. The number of workers also drops for very large designs (`poolSizeFor` in `pool.ts`).
- Errors written for people are thrown as `UserError` (`lib/errors.ts`) and shown as they are; anything else (a failed download, a library's own message) is logged and replaced with a plain sentence in the page's language.
- The UI follows the Wot Da Fong brand kit: system font stacks with Vietnamese coverage, paper/ink/cobalt tokens, light and dark. Google Fonts are only downloaded for the card text you choose.
