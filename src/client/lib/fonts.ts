import { UserError } from "./errors";
import { tr } from "./i18n";
import type { CustomFont, FontRef } from "../types";

export type FontCategory = "serif" | "sans" | "display" | "script" | "mono";

export interface GoogleFont {
	family: string;
	category: FontCategory;
	/** e.g. ["400", "700", "400i"] */
	variants: string[];
	vietnamese: boolean;
}

/** Hand-picked faces that work well for invitations and include Vietnamese glyphs. */
export const CURATED_FAMILIES = [
	"Great Vibes",
	"Dancing Script",
	"Charm",
	"Alex Brush",
	"Allura",
	"Pinyon Script",
	"Imperial Script",
	"Corinthia",
	"Ephesis",
	"Italianno",
	"Mea Culpa",
	"Bonheur Royale",
	"Playfair Display",
	"Cormorant Garamond",
	"EB Garamond",
	"Lora",
	"Prata",
	"Be Vietnam Pro",
	"Montserrat",
	"Josefin Sans",
	"Quicksand",
];

export const DEFAULT_FONT: FontRef = { family: "Great Vibes", source: "google", weight: 400, italic: false };

let catalog: Promise<GoogleFont[]> | null = null;

export function loadCatalog(): Promise<GoogleFont[]> {
	catalog ??= import("../data/google-fonts.json").then((m) =>
		(m.default as [string, FontCategory, string, number][]).map(([family, category, variants, vi]) => ({
			family,
			category,
			variants: variants.split(","),
			vietnamese: vi === 1,
		})),
	);
	return catalog;
}

export function fontCss(font: FontRef, size: number): string {
	return `${font.italic ? "italic " : ""}${font.weight} ${size}px "${font.family.replace(/"/g, "")}", sans-serif`;
}

const faceRequests = new Map<string, Promise<void>>();

/**
 * Registers the @font-face rules for one Google Fonts variant with document.fonts.
 * Font files themselves are fetched lazily per unicode-range when text needs them.
 */
export function registerGoogleFont(family: string, weight: number, italic: boolean, alias = family, text?: string) {
	const key = `${alias}|${weight}|${italic}|${text ?? ""}`;
	let req = faceRequests.get(key);
	if (!req) {
		req = (async () => {
			const spec = `${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@${italic ? 1 : 0},${weight}`;
			const url = `https://fonts.googleapis.com/css2?family=${spec}&display=block${text ? `&text=${encodeURIComponent(text)}` : ""}`;
			const res = await fetch(url);
			if (!res.ok) throw new UserError(tr().fontNoStyle(family, weight, italic));
			const css = await res.text();
			const faces = parseFontFaces(css, alias);
			if (!faces.length) throw new UserError(tr().fontUnreadable(family));
			for (const face of faces) document.fonts.add(face);
		})();
		faceRequests.set(key, req);
		req.catch(() => faceRequests.delete(key));
	}
	return req;
}

function parseFontFaces(css: string, family: string): FontFace[] {
	const faces: FontFace[] = [];
	for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
		const body = block[1];
		const prop = (name: string) => body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();
		const src = prop("src")?.match(/url\(([^)]+)\)/)?.[1];
		if (!src) continue;
		faces.push(
			new FontFace(family, `url(${src})`, {
				style: prop("font-style") ?? "normal",
				weight: prop("font-weight") ?? "400",
				unicodeRange: prop("unicode-range") ?? "U+0-10FFFF",
				display: "block",
			}),
		);
	}
	return faces;
}

/** Loads a tiny subset of a family (just its own name) under an alias, for the font picker. */
export function previewFamily(family: string): string {
	const alias = `__preview ${family}`;
	registerGoogleFont(family, 400, false, alias, family)
		.then(() => document.fonts.load(`400 16px "${alias}"`, family))
		.catch(() => {});
	return alias;
}

export function closestVariant(font: GoogleFont, weight: number, italic: boolean): { weight: number; italic: boolean } {
	const parsed = font.variants.map((v) => ({ weight: parseInt(v, 10), italic: v.endsWith("i") }));
	const sameStyle = parsed.filter((v) => v.italic === italic);
	const pool = sameStyle.length ? sameStyle : parsed;
	pool.sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight));
	return pool[0] ?? { weight: 400, italic: false };
}

export async function addCustomFont(file: File, existing: CustomFont[]): Promise<CustomFont> {
	const base = file.name.replace(/\.(ttf|otf|woff2?|)$/i, "").trim() || tr().yourFont;
	let family = base;
	let n = 2;
	while (existing.some((f) => f.family === family)) family = `${base} ${n++}`;
	const font: CustomFont = {
		id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
		family,
		fileName: file.name,
		blob: file,
	};
	await registerCustomFont(font);
	return font;
}

const customRegistered = new Set<string>();

export async function registerCustomFont(font: CustomFont): Promise<void> {
	if (customRegistered.has(font.id)) return;
	const face = new FontFace(font.family, await font.blob.arrayBuffer());
	await face.load().catch(() => {
		throw new UserError(tr().notAFont(font.fileName));
	});
	document.fonts.add(face);
	customRegistered.add(font.id);
}

/** Ensures every glyph needed for `text` is downloaded before drawing to canvas. */
export async function ensureFont(font: FontRef, text: string): Promise<void> {
	if (font.source === "google") await registerGoogleFont(font.family, font.weight, font.italic);
	const sample = uniqueChars(text) || "A";
	await document.fonts.load(fontCss(font, 32), sample);
}

export function uniqueChars(text: string): string {
	return [...new Set(text.replace(/\s/g, ""))].join("");
}
