import encodeJpeg from "@jsquash/jpeg/encode.js";
import optimisePng from "@jsquash/oxipng/optimise.js";
import encodeWebp from "@jsquash/webp/encode.js";
import { buildPaletteSync, utils } from "image-q";
import type { CodecSettings } from "./codec";

export interface EncodeRequest {
	id: number;
	runId: string;
	width: number;
	height: number;
	pixels: ArrayBuffer;
	codec: CodecSettings;
}

export type EncodeResponse = { id: number; ok: true; buffer: ArrayBuffer } | { id: number; ok: false; error: string };

// The app tsconfig uses DOM typings; describe just the worker scope we need.
const scope = self as unknown as {
	onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
	postMessage(message: EncodeResponse, transfer?: Transferable[]): void;
};

// The palette is built once per run (per worker) from the first card: every card shares the same
// design, so later cards only need their pixels matched to it.
let palette: { key: string; colors: Uint8Array } | null = null;

/** At most this many pixels are looked at when choosing the palette, however large the design. */
const PALETTE_SAMPLE = 250_000;

/**
 * The colours to keep, chosen from an even sample of the picture. image-q holds an object per pixel
 * it is given, so it only ever sees the sample: a whole 2000 x 1400 card through it costs about half
 * a gigabyte per worker, and six of those at once take the tab past the browser's memory limit.
 */
function buildPalette(image: ImageData, colors: number): Uint8Array {
	const stride = Math.max(1, Math.ceil(Math.sqrt((image.width * image.height) / PALETTE_SAMPLE)));
	const sw = Math.ceil(image.width / stride);
	const sh = Math.ceil(image.height / stride);
	const sample = new Uint8Array(sw * sh * 4);
	const src = image.data;
	for (let y = 0; y < sh; y++) {
		for (let x = 0; x < sw; x++) {
			const s = (y * stride * image.width + x * stride) * 4;
			const d = (y * sw + x) * 4;
			sample[d] = src[s];
			sample[d + 1] = src[s + 1];
			sample[d + 2] = src[s + 2];
			sample[d + 3] = src[s + 3];
		}
	}
	const built = buildPaletteSync([utils.PointContainer.fromUint8Array(sample, sw, sh)], {
		colors,
		paletteQuantization: "wuquant",
		colorDistanceFormula: "euclidean-bt709",
	});
	const points = built.getPointContainer().getPointArray();
	const out = new Uint8Array(points.length * 4);
	points.forEach((p, i) => out.set([p.r, p.g, p.b, p.a], i * 4));
	return out;
}

/**
 * Matches every pixel to the palette with Floyd-Steinberg dithering, row by row in alternating
 * directions, on plain byte arrays: two copies of the picture and two rows of carried error is all
 * the memory it takes.
 */
function applyPalette(image: ImageData, pal: Uint8Array): ImageData {
	const { width: w, height: h } = image;
	const src = image.data;
	const out = new Uint8ClampedArray(src.length);
	const n = pal.length / 4;
	// Nearest palette entry for each colour already met, keyed by its top bits (5 per colour, 4 of alpha).
	const cache = new Int16Array(1 << 19).fill(-1);
	const nearest = (r: number, g: number, b: number, a: number) => {
		let best = 0;
		let bestD = Infinity;
		for (let p = 0, o = 0; p < n; p++, o += 4) {
			const dr = r - pal[o];
			const dg = g - pal[o + 1];
			const db = b - pal[o + 2];
			const da = a - pal[o + 3];
			const d = 0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db + da * da;
			if (d < bestD) {
				bestD = d;
				best = p;
			}
		}
		return best;
	};
	// Error carried into this row and the next, four channels a pixel, with a spare pixel at each end.
	let cur = new Float32Array((w + 2) * 4);
	let next = new Float32Array((w + 2) * 4);
	for (let y = 0; y < h; y++) {
		const forward = y % 2 === 0;
		const step = forward ? 1 : -1;
		for (let k = 0, x = forward ? 0 : w - 1; k < w; k++, x += step) {
			const i = (y * w + x) * 4;
			const e = (x + 1) * 4;
			const r = Math.max(0, Math.min(255, src[i] + cur[e]));
			const g = Math.max(0, Math.min(255, src[i + 1] + cur[e + 1]));
			const b = Math.max(0, Math.min(255, src[i + 2] + cur[e + 2]));
			const a = Math.max(0, Math.min(255, src[i + 3] + cur[e + 3]));
			const key = ((r >> 3) << 14) | ((g >> 3) << 9) | ((b >> 3) << 4) | (a >> 4);
			let p = cache[key];
			if (p < 0) cache[key] = p = nearest(r, g, b, a);
			const o = p * 4;
			out[i] = pal[o];
			out[i + 1] = pal[o + 1];
			out[i + 2] = pal[o + 2];
			out[i + 3] = pal[o + 3];
			const ahead = e + step * 4;
			const behind = e - step * 4;
			for (let c = 0; c < 4; c++) {
				const err = (c === 0 ? r : c === 1 ? g : c === 2 ? b : a) - pal[o + c];
				cur[ahead + c] += (err * 7) / 16;
				next[behind + c] += (err * 3) / 16;
				next[e + c] += (err * 5) / 16;
				next[ahead + c] += err / 16;
			}
		}
		const swap = cur;
		cur = next;
		next = swap;
		next.fill(0);
	}
	return new ImageData(out, w, h);
}

function quantize(image: ImageData, colors: number, key: string): ImageData {
	if (palette?.key !== key) palette = { key, colors: buildPalette(image, colors) };
	return applyPalette(image, palette.colors);
}

async function encode(req: EncodeRequest): Promise<ArrayBuffer> {
	const image = new ImageData(new Uint8ClampedArray(req.pixels), req.width, req.height);
	const c = req.codec;
	switch (c.format) {
		case "jpeg":
			return encodeJpeg(image, {
				quality: c.quality,
				progressive: true,
				optimize_coding: true,
				auto_subsample: !c.chroma444,
				chroma_subsample: c.chroma444 ? 1 : 2,
			});
		case "webp":
			return encodeWebp(image, { quality: c.quality, method: 4, use_sharp_yuv: 1 });
		case "png": {
			const source = c.colors ? quantize(image, c.colors, `${req.runId}:${c.colors}`) : image;
			return optimisePng(source, { level: c.level, interlace: false, optimiseAlpha: true });
		}
	}
}

scope.onmessage = async (event: MessageEvent<EncodeRequest>) => {
	const req = event.data;
	try {
		const buffer = await encode(req);
		scope.postMessage({ id: req.id, ok: true, buffer } satisfies EncodeResponse, [buffer]);
	} catch (err) {
		scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies EncodeResponse);
	}
};
