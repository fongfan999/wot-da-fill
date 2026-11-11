import type { Row, TextCase } from "../types";
import { EXAMPLE, getExampleLang } from "./example";

const PLACEHOLDER = /\{([^{}]+)\}/g;

/** Placeholder used for the 1-based row number. */
export const ROW_NUMBER = "#";

export function placeholdersIn(template: string): string[] {
	return [...template.matchAll(PLACEHOLDER)].map((m) => m[1].trim());
}

const fold = (s: string) => stripDiacritics(s).toLowerCase().replace(/\s+/g, " ").trim();

/** Finds the column a placeholder refers to, forgiving case/diacritics/spacing differences. */
export function matchColumn(name: string, columns: string[]): string | undefined {
	if (columns.includes(name)) return name;
	const target = fold(name);
	return columns.find((c) => fold(c) === target);
}

export function unknownPlaceholders(template: string, columns: string[]): string[] {
	return placeholdersIn(template).filter((p) => p !== ROW_NUMBER && !matchColumn(p, columns));
}

export function fillTemplate(
	template: string,
	row: Row | null,
	columns: string[],
	rowNumber: number,
	pad = 0,
): string {
	return template.replace(PLACEHOLDER, (_, raw: string) => {
		const key = raw.trim();
		if (key === ROW_NUMBER) return String(rowNumber).padStart(pad, "0");
		// No list yet: names get the example name (in the example's language) so sizing looks right; other columns stay visible as {Column}.
		if (!row) return NAME_LIKE.test(fold(key)) ? EXAMPLE[getExampleLang()].name : `{${key}}`;
		const col = matchColumn(key, columns);
		return col ? (row[col] ?? "") : "";
	});
}

const NAME_LIKE = /\b(name|ten|ho ten|ho va ten|guest|khach|khach moi|nguoi nhan|recipient)\b|^column a$/;

export function applyCase(text: string, mode: TextCase): string {
	switch (mode) {
		case "upper":
			return text.toLocaleUpperCase("vi");
		case "lower":
			return text.toLocaleLowerCase("vi");
		case "title":
			return text
				.toLocaleLowerCase("vi")
				.replace(/(^|[\s\-'(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("vi"));
		default:
			return text;
	}
}

/** Unicode NFC + tidy whitespace. Excel/Word often produce decomposed Vietnamese text. */
export function cleanCell(value: unknown): string {
	if (value == null) return "";
	return String(value)
		.normalize("NFC")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t ​]+/g, " ")
		.split("\n")
		.map((l) => l.trim())
		.join("\n")
		.trim();
}

export function stripDiacritics(s: string): string {
	return s
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.normalize("NFC");
}

const ILLEGAL_FILENAME = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;

export function sanitizeFilename(name: string, ascii: boolean): string {
	let s = name.normalize("NFC").replace(/\s*\n\s*/g, " ");
	if (ascii) s = stripDiacritics(s).replace(/[^\x20-\x7e]/g, "");
	s = s.replace(ILLEGAL_FILENAME, "").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "");
	if (s.length > 120) s = s.slice(0, 120).trim();
	return s;
}

export function buildFilenames(
	pattern: string,
	rows: Row[],
	columns: string[],
	ext: string,
	ascii: boolean,
): string[] {
	const pad = String(rows.length).length;
	const seen = new Map<string, number>();
	return rows.map((row, i) => {
		// Trim separators left dangling by empty cells, e.g. "007-" when the name is blank.
		let base = sanitizeFilename(fillTemplate(pattern, row, columns, i + 1, pad), ascii).replace(/^[-_ ]+|[-_ ]+$/g, "");
		if (!base) base = String(i + 1).padStart(pad, "0");
		const key = base.toLowerCase();
		const count = seen.get(key) ?? 0;
		seen.set(key, count + 1);
		return `${count ? `${base} (${count + 1})` : base}.${ext}`;
	});
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function uid(prefix = ""): string {
	return prefix + Math.random().toString(36).slice(2, 10);
}
