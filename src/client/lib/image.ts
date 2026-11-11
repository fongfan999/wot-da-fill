import { UserError } from "./errors";
import { tr } from "./i18n";
import type { Box, TemplateImage } from "../types";

const MAX_PIXELS = 60_000_000;

export async function loadTemplateImage(blob: Blob, name: string): Promise<TemplateImage> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
	} catch {
		throw new UserError(tr().cantOpenImage);
	}
	if (bitmap.width * bitmap.height > MAX_PIXELS) {
		bitmap.close();
		throw new UserError(tr().imageTooBig);
	}
	return {
		blob,
		name,
		type: blob.type || "image/png",
		size: blob.size,
		width: bitmap.width,
		height: bitmap.height,
		bitmap,
	};
}

const DARK_INK = "#222222";
const LIGHT_INK = "#ffffff";

type RGB = [number, number, number];

function luminance([r, g, b]: RGB): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string): RGB => {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** How colourful, 0 (grey) to 1. Unlike HSL saturation it stays low for near-black and near-white. */
const chroma = ([r, g, b]: RGB) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

/** Draws part of the design small, on white (transparent areas look white on the page), and returns its pixels. */
function sample(img: TemplateImage, box: Box, longSide: number): Uint8ClampedArray | null {
	const k = longSide / Math.max(box.w, box.h, 1);
	const w = Math.max(1, Math.round(box.w * k));
	const h = Math.max(1, Math.round(box.h * k));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, w, h);
	ctx.drawImage(img.bitmap, box.x, box.y, box.w, box.h, 0, 0, w, h);
	return ctx.getImageData(0, 0, w, h).data;
}

/** The design's colour under a box: its average luminance, and the main colour there. */
function backgroundUnder(img: TemplateImage, box: Box): { lum: number; main: RGB } {
	const data = sample(img, box, 48);
	if (!data) return { lum: 1, main: [255, 255, 255] };
	let sum = 0;
	for (let i = 0; i < data.length; i += 4) sum += luminance([data[i], data[i + 1], data[i + 2]]);
	return { lum: sum / (data.length / 4), main: quantize(data)[0]?.rgb ?? [255, 255, 255] };
}

interface Swatch {
	rgb: RGB;
	/** Share of the picture in this colour, 0–1. */
	share: number;
}

/** Groups pixels into a handful of main colours, most common first. */
function quantize(data: Uint8ClampedArray): Swatch[] {
	// 4 bits a channel; each bucket keeps the true average of its pixels so colours come out exact.
	const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
	for (let i = 0; i < data.length; i += 4) {
		const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
		const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
		b.r += data[i];
		b.g += data[i + 1];
		b.b += data[i + 2];
		b.n++;
		buckets.set(key, b);
	}
	const total = data.length / 4;
	const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
	// Fold each bucket into a bigger one that looks the same, so gradients become one colour.
	const merged: { sum: RGB; n: number; rgb: RGB }[] = [];
	for (const b of sorted) {
		const rgb: RGB = [b.r / b.n, b.g / b.n, b.b / b.n];
		const near = merged.find((m) => distance(m.rgb, rgb) < 48);
		if (near) {
			near.sum = [near.sum[0] + b.r, near.sum[1] + b.g, near.sum[2] + b.b];
			near.n += b.n;
		} else {
			merged.push({ sum: [b.r, b.g, b.b], n: b.n, rgb });
		}
	}
	return merged
		.map((m) => ({ rgb: [m.sum[0] / m.n, m.sum[1] / m.n, m.sum[2] / m.n] as RGB, share: m.n / total }))
		.sort((a, b) => b.share - a.share);
}

const palettes = new WeakMap<ImageBitmap, Swatch[]>();

/** The design's main colours, worked out once per picture. */
function paletteOf(img: TemplateImage): Swatch[] {
	let palette = palettes.get(img.bitmap);
	if (!palette) {
		const data = sample(img, { x: 0, y: 0, w: img.width, h: img.height }, 160);
		// Specks under 0.2% of the picture are noise, not part of the look.
		palette = data ? quantize(data).filter((s) => s.share >= 0.002) : [];
		palettes.set(img.bitmap, palette);
	}
	return palette;
}

/**
 * Text colours for a box, best first: the design's own colours that read well on what's under the box,
 * favouring accents (colourful, present but not covering the page) over plain dark or white.
 */
export function suggestColors(img: TemplateImage, box: Box, max = 6): string[] {
	const bg = backgroundUnder(img, box);
	const candidates = [
		...paletteOf(img),
		{ rgb: fromHex(DARK_INK), share: 0 },
		{ rgb: fromHex(LIGHT_INK), share: 0 },
	];
	const scored: { rgb: RGB; score: number }[] = [];
	for (const c of candidates) {
		const cr = contrast(bg.lum, luminance(c.rgb));
		// Large display text needs 3:1; anything close to the background's own colour would vanish anyway.
		if (cr < 3 || distance(c.rgb, bg.main) < 60) continue;
		const accent = c.share > 0 && c.share < 0.3 ? 0.3 : 0;
		const score = Math.min(cr, 7) / 7 + chroma(c.rgb) * 1.5 + accent;
		if (scored.some((s) => distance(s.rgb, c.rgb) < 40)) continue;
		scored.push({ rgb: c.rgb, score });
	}
	return scored
		.sort((a, b) => b.score - a.score)
		.slice(0, max)
		.map((s) => toHex(s.rgb));
}

/** The best text colour for a box: an accent from the design when one reads well, else dark or white. */
export function inkFor(img: TemplateImage, box: Box): string {
	const best = suggestColors(img, box, 1)[0];
	if (best) return best;
	const lum = backgroundUnder(img, box).lum;
	return contrast(lum, luminance(fromHex(DARK_INK))) >= contrast(lum, luminance(fromHex(LIGHT_INK))) ? DARK_INK : LIGHT_INK;
}

/** Keeps a colour that already reads well on the design under the box; otherwise swaps in the best one. */
export function readableOn(img: TemplateImage, box: Box, color: string): string {
	const lum = backgroundUnder(img, box).lum;
	return contrast(lum, luminance(fromHex(color))) >= 3 ? color : inkFor(img, box);
}
