#!/usr/bin/env node
// Regenerates src/client/data/google-fonts.json from the public Google Fonts catalog.
// Each entry: [family, category, variants, supportsVietnamese(0|1)], most popular first.
// Run with: pnpm fonts:update
import { writeFile } from "node:fs/promises";

const CATEGORY = {
	Serif: "serif",
	"Sans Serif": "sans",
	Display: "display",
	Handwriting: "script",
	Monospace: "mono",
};

const res = await fetch("https://fonts.google.com/metadata/fonts");
if (!res.ok) throw new Error(`Google Fonts metadata request failed: ${res.status}`);
const text = (await res.text()).replace(/^\)\]\}'\n?/, "");
const { familyMetadataList } = JSON.parse(text);

const fonts = familyMetadataList
	.filter((f) => f.isOpenSource !== false && !f.isBrandFont)
	.sort((a, b) => a.popularity - b.popularity)
	.map((f) => [
		f.family,
		CATEGORY[f.category] ?? "display",
		Object.keys(f.fonts).join(","),
		f.subsets.includes("vietnamese") ? 1 : 0,
	]);

const out = new URL("../src/client/data/google-fonts.json", import.meta.url);
await writeFile(out, JSON.stringify(fonts));
console.log(`Wrote ${fonts.length} families (${fonts.filter((f) => f[3]).length} with Vietnamese) to ${out.pathname}`);
