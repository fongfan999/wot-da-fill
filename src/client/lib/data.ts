import type { DataSource, Row, Table } from "../types";
import { EXAMPLE, getExampleLang, type ExampleLang } from "./example";
import { cleanCell } from "./text";

export type Delimiter = "auto" | "tab" | "comma" | "semicolon" | "line";

const TEXT_EXT = /\.(csv|tsv|txt)$/i;

export interface Workbook {
	sheets: string[];
	read(sheet: string): string[][];
}

/** Reads CSV/TSV/XLSX/XLS/ODS. SheetJS is loaded lazily so it doesn't weigh down first paint. */
export async function readSpreadsheet(file: File): Promise<Workbook> {
	const buffer = await file.arrayBuffer();
	if (TEXT_EXT.test(file.name) || file.type.startsWith("text/")) {
		const text = decodeText(buffer);
		const grid = parseDelimited(text, /\.tsv$/i.test(file.name) ? "tab" : sniffDelimiter(text));
		return { sheets: ["Sheet1"], read: () => grid };
	}
	const XLSX = await import("xlsx");
	// Dates without an explicit format follow Vietnamese convention (dd/mm/yyyy) instead of US m/d/yy.
	const wb = XLSX.read(buffer, { type: "array", dense: true, cellDates: true, dateNF: "dd/mm/yyyy" });
	return {
		sheets: wb.SheetNames,
		read(sheet) {
			const ws = wb.Sheets[sheet];
			if (!ws) return [];
			const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: false });
			return rows.map((r) => r.map(cleanCell));
		},
	};
}

/**
 * Excel's "CSV UTF-8" has a BOM, "Unicode Text" is UTF-16, and plain "CSV" on Vietnamese
 * Windows is windows-1258. Try them in that order.
 */
function decodeText(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder("windows-1258").decode(bytes);
	}
}

function sniffDelimiter(text: string): Delimiter {
	const sample = text.split(/\r?\n/).slice(0, 20).join("\n");
	const counts: [Delimiter, number][] = [
		["tab", (sample.match(/\t/g) ?? []).length],
		["semicolon", (sample.match(/;/g) ?? []).length],
		["comma", (sample.match(/,/g) ?? []).length],
	];
	counts.sort((a, b) => b[1] - a[1]);
	return counts[0][1] > 0 ? counts[0][0] : "line";
}

/**
 * Pasted text: tabs mean it came from Excel/Sheets; otherwise one value per line,
 * since names may legitimately contain commas.
 */
export function resolvePasteDelimiter(text: string, delimiter: Delimiter): Exclude<Delimiter, "auto"> {
	if (delimiter !== "auto") return delimiter;
	return text.includes("\t") ? "tab" : "line";
}

/** RFC 4180-style parser (quoted fields, embedded newlines, doubled quotes). */
export function parseDelimited(text: string, delimiter: Delimiter): string[][] {
	const src = text.replace(/^﻿/, "");
	const mode = delimiter === "auto" ? resolvePasteDelimiter(src, "auto") : delimiter;
	if (mode === "line") {
		return src
			.split(/\r?\n/)
			.map(cleanCell)
			.filter(Boolean)
			.map((v) => [v]);
	}
	const sep = mode === "tab" ? "\t" : mode === "semicolon" ? ";" : ",";
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (quoted) {
			if (ch === '"') {
				if (src[i + 1] === '"') {
					cell += '"';
					i++;
				} else quoted = false;
			} else cell += ch;
		} else if (ch === '"' && cell === "") {
			quoted = true;
		} else if (ch === sep) {
			row.push(cell);
			cell = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && src[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else cell += ch;
	}
	if (cell !== "" || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows.map((r) => r.map(cleanCell));
}

const HEADER_HINTS =
	/^(name|full ?name|guest|guests|first ?name|last ?name|title|email|phone|table|seat|company|tên|họ tên|họ và tên|khách|khách mời|danh xưng|xưng hô|chức vụ|bàn|số bàn|công ty|địa chỉ|stt|no\.?|#)$/i;

export function guessHasHeader(grid: string[][], kind: DataSource["kind"]): boolean {
	if (!grid.length) return false;
	if (kind === "file") return grid.length > 1;
	return grid[0].some((c) => HEADER_HINTS.test(c.trim()));
}

const columnLetter = (i: number): string => {
	let s = "";
	let n = i + 1;
	while (n > 0) {
		const r = (n - 1) % 26;
		s = String.fromCharCode(65 + r) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
};

export function buildTable(grid: string[][], hasHeader: boolean): Table {
	const nonEmpty = grid.filter((r) => r.some((c) => c !== ""));
	const width = nonEmpty.reduce((w, r) => {
		let last = r.length - 1;
		while (last >= 0 && r[last] === "") last--;
		return Math.max(w, last + 1);
	}, 0);
	const header = hasHeader ? (nonEmpty[0] ?? []) : [];
	const body = hasHeader ? nonEmpty.slice(1) : nonEmpty;

	const columns: string[] = [];
	const used = new Set<string>();
	for (let i = 0; i < width; i++) {
		let name = (header[i] ?? "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim() || `Column ${columnLetter(i)}`;
		const base = name;
		let n = 2;
		while (used.has(name.toLowerCase())) name = `${base} (${n++})`;
		used.add(name.toLowerCase());
		columns.push(name);
	}

	const rows: Row[] = body.map((r) => {
		const row: Row = {};
		columns.forEach((c, i) => (row[c] = r[i] ?? ""));
		return row;
	});
	return { columns, rows };
}

/** The example's list: the names and table numbers that go with the sample invitation. */
export function sampleSource(lang: ExampleLang = getExampleLang()): DataSource {
	const ex = EXAMPLE[lang];
	return {
		kind: "sample",
		name: "sample",
		grid: [[...ex.columns], ...ex.guests.map((n, i) => [n, String(Math.floor(i / 2) + 1)])],
		hasHeader: true,
	};
}
