#!/usr/bin/env node
// Pre-renders the home page's example pictures into public/showcase/, so the home page shows
// ready-made images instead of drawing every example (and loading its fonts) on each visit.
// For each language and example: the blank design, and one transparent layer per sample name
// cropped to its text (so it is never the biggest thing on the page while names change), each at
// full width and half width, as WebP. Where each name layer sits goes to src/client/data/showcase.json.
// Uses the same renderer as the app (lib/showcase.ts) in your installed Google Chrome.
// Run after changing an example, its fonts or the renderer: pnpm showcase:update
import { mkdir, rm, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const out = new URL("../public/showcase/", import.meta.url);
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
	const page = await browser.newPage();
	await page.goto("http://localhost:5199/", { waitUntil: "load" });
	const { files, layout } = await page.evaluate(async () => {
		const { getShowcase } = await import("/src/client/lib/showcase.ts");
		const { EXAMPLE_KINDS } = await import("/src/client/lib/example.ts");
		const load = async (url) => createImageBitmap(await (await fetch(url)).blob());
		/** The smallest box around every visible pixel, with a little room for soft edges. */
		const bounds = (bitmap) => {
			const c = document.createElement("canvas");
			c.width = bitmap.width;
			c.height = bitmap.height;
			const ctx = c.getContext("2d");
			ctx.drawImage(bitmap, 0, 0);
			const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
			let x0 = width, y0 = height, x1 = -1, y1 = -1;
			for (let y = 0; y < height; y++)
				for (let x = 0; x < width; x++)
					if (data[(y * width + x) * 4 + 3]) {
						if (x < x0) x0 = x;
						if (x > x1) x1 = x;
						if (y < y0) y0 = y;
						if (y > y1) y1 = y;
					}
			// Even numbers, so the half-width copy lines up exactly.
			const pad = 4;
			x0 = Math.max(0, (x0 - pad) & ~1);
			y0 = Math.max(0, (y0 - pad) & ~1);
			x1 = Math.min(width, (x1 + pad + 2) & ~1);
			y1 = Math.min(height, (y1 + pad + 2) & ~1);
			return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
		};
		const toWebp = async (bitmap, scale, box = { x: 0, y: 0, w: bitmap.width, h: bitmap.height }) => {
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(box.w * scale);
			canvas.height = Math.round(box.h * scale);
			const ctx = canvas.getContext("2d");
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(bitmap, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.86));
			const bytes = new Uint8Array(await blob.arrayBuffer());
			let bin = "";
			for (const b of bytes) bin += String.fromCharCode(b);
			return btoa(bin);
		};
		const files = {};
		const layout = {};
		const r = (n) => Math.round(n * 1e4) / 1e4;
		for (const lang of ["en", "vi"]) {
			for (const kind of EXAMPLE_KINDS) {
				const show = await getShowcase(lang, kind);
				const blank = await load(show.blank);
				files[`${lang}-${kind}-blank.webp`] = await toWebp(blank, 1);
				files[`${lang}-${kind}-blank-half.webp`] = await toWebp(blank, 0.5);
				layout[`${lang}-${kind}`] = {
					width: blank.width,
					names: await Promise.all(
						show.names.map(async (url, i) => {
							const bitmap = await load(url);
							const box = bounds(bitmap);
							files[`${lang}-${kind}-${i}.webp`] = await toWebp(bitmap, 1, box);
							files[`${lang}-${kind}-${i}-half.webp`] = await toWebp(bitmap, 0.5, box);
							// Where the layer sits on the design, as fractions of its width and height.
							return [r(box.x / bitmap.width), r(box.y / bitmap.height), r(box.w / bitmap.width), r(box.h / bitmap.height)];
						}),
					),
				};
			}
		}
		return { files, layout };
	});
	await rm(out, { recursive: true, force: true });
	await mkdir(out, { recursive: true });
	let total = 0;
	for (const [name, b64] of Object.entries(files)) {
		const buf = Buffer.from(b64, "base64");
		total += buf.length;
		await writeFile(new URL(name, out), buf);
	}
	await writeFile(new URL("../src/client/data/showcase.json", import.meta.url), JSON.stringify(layout) + "\n");
	console.log(`Wrote ${Object.keys(files).length} pictures (${Math.round(total / 1024)} KiB) to public/showcase/`);
} finally {
	await browser.close();
	await server.close();
}
