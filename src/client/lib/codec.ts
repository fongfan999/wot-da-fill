import type { Compression, OutputFormat } from "../types";

/** Encoder settings sent to the worker. Mirrors what Clop does: mozjpeg, quantized PNG + oxipng, WebP. */
export type CodecSettings =
	| { format: "jpeg"; quality: number; chroma444: boolean }
	| { format: "webp"; quality: number }
	| { format: "png"; colors: number | null; level: number };

export function codecFor(format: OutputFormat, compression: Compression): CodecSettings {
	switch (format) {
		case "jpeg":
			return {
				format,
				quality: { small: 70, balanced: 80, high: 90 }[compression],
				// Full-resolution color keeps thin colored script text crisp.
				chroma444: compression === "high",
			};
		case "webp":
			return { format, quality: { small: 70, balanced: 80, high: 92 }[compression] };
		case "png":
			return { format, colors: { small: 128, balanced: 256, high: null }[compression], level: 2 };
	}
}

export function describeCodec(c: CodecSettings): string {
	switch (c.format) {
		case "jpeg":
			return `MozJPEG · quality ${c.quality} · progressive${c.chroma444 ? " · 4:4:4 color" : ""}`;
		case "webp":
			return `WebP · quality ${c.quality}`;
		case "png":
			return c.colors ? `${c.colors}-color palette (dithered) + OxiPNG` : "Lossless · OxiPNG";
	}
}

export const EXTENSION: Record<OutputFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };
export const MIME: Record<OutputFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
