import type { OutputFormat } from "../types";

/**
 * Encoder settings sent to the worker. Chosen automatically, TinyPNG/Clop style: keep the
 * design's format and size, compress as far as it goes without visible loss.
 */
export type CodecSettings =
	| { format: "jpeg"; quality: number; chroma444: boolean }
	| { format: "webp"; quality: number }
	| { format: "png"; colors: number | null; level: number };

export function formatFor(mimeType: string): OutputFormat {
	if (mimeType === "image/jpeg") return "jpeg";
	if (mimeType === "image/webp") return "webp";
	return "png";
}

export function codecFor(format: OutputFormat): CodecSettings {
	switch (format) {
		case "jpeg":
			return { format, quality: 80, chroma444: false };
		case "webp":
			return { format, quality: 80 };
		case "png":
			// 256-color dithered palette + OxiPNG, the TinyPNG approach.
			return { format, colors: 256, level: 2 };
	}
}

export const EXTENSION: Record<OutputFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };
export const MIME: Record<OutputFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
