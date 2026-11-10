import encodeJpeg from "@jsquash/jpeg/encode.js";
import optimisePng from "@jsquash/oxipng/optimise.js";
import encodeWebp from "@jsquash/webp/encode.js";
import { applyPaletteSync, buildPaletteSync, utils } from "image-q";
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

// Palette is built once per run (per worker) from the first card: every card shares the
// same design, so this is ~3x faster than quantizing each card from scratch.
let palette: { key: string; value: ReturnType<typeof buildPaletteSync> } | null = null;

function quantize(image: ImageData, colors: number, key: string): ImageData {
	const container = utils.PointContainer.fromUint8Array(
		new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
		image.width,
		image.height,
	);
	if (palette?.key !== key) {
		// Sample every other pixel in each direction – same palette, 4x less work.
		const sw = Math.ceil(image.width / 2);
		const sh = Math.ceil(image.height / 2);
		const sample = new Uint8Array(sw * sh * 4);
		const src = image.data;
		for (let y = 0; y < sh; y++) {
			for (let x = 0; x < sw; x++) {
				const s = (y * 2 * image.width + x * 2) * 4;
				const d = (y * sw + x) * 4;
				sample[d] = src[s];
				sample[d + 1] = src[s + 1];
				sample[d + 2] = src[s + 2];
				sample[d + 3] = src[s + 3];
			}
		}
		const sampleContainer = utils.PointContainer.fromUint8Array(sample, sw, sh);
		palette = {
			key,
			value: buildPaletteSync([sampleContainer], {
				colors,
				paletteQuantization: "wuquant",
				colorDistanceFormula: "euclidean-bt709",
			}),
		};
	}
	const out = applyPaletteSync(container, palette.value, {
		imageQuantization: "floyd-steinberg",
		colorDistanceFormula: "euclidean-bt709",
	});
	return new ImageData(new Uint8ClampedArray(out.toUint8Array()), image.width, image.height);
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
