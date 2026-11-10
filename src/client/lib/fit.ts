import type { CustomFont, Field, Table } from "../types";
import { prepareFonts, textsForRow } from "./generate";
import { layoutText } from "./render";

/** A name shrunk below this share of the usual size for its box looks like a mistake next to the others. */
export const SMALL_SHARE = 0.6;

export interface TooLong {
	row: number;
	/** Boxes whose text is too long on this row. */
	fields: string[];
	/** Some text spills out of its box (shrinking is off, or it can't shrink enough). */
	spill: boolean;
}

/**
 * Checks every name against its box, the same way the cards are drawn. A row is flagged when
 * text spills out of its box, or when it had to shrink to well under the size most rows get in
 * that box (so one long name doesn't come out tiny while the rest look normal). Yields to the
 * page every few hundred rows so typing stays smooth on long lists.
 */
export async function findTooLong(fields: Field[], customFonts: CustomFont[], table: Table, signal: AbortSignal): Promise<TooLong[]> {
	await prepareFonts(fields, customFonts, table);
	if (signal.aborted) return [];
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return [];

	// Size each box's text gets on every row (null where the text is empty).
	const sizes: (number | null)[][] = fields.map(() => []);
	const spills: boolean[][] = fields.map(() => []);
	for (let i = 0; i < table.rows.length; i++) {
		if (i % 250 === 249) {
			await new Promise((r) => setTimeout(r, 0));
			if (signal.aborted) return [];
		}
		const texts = textsForRow(fields, table, i);
		fields.forEach((f, k) => {
			if (!texts[k].trim()) {
				sizes[k].push(null);
				spills[k].push(false);
				return;
			}
			const layout = layoutText(ctx, f, texts[k]);
			sizes[k].push(layout.size);
			spills[k].push(layout.overflow);
		});
	}

	const usual = sizes.map((s) => median(s.filter((v): v is number => v !== null)));
	const out: TooLong[] = [];
	for (let i = 0; i < table.rows.length; i++) {
		const flagged: string[] = [];
		let spill = false;
		fields.forEach((f, k) => {
			const size = sizes[k][i];
			if (size === null) return;
			const tooSmall = f.autoFit && size < usual[k] * SMALL_SHARE;
			if (spills[k][i]) spill = true;
			if (spills[k][i] || tooSmall) flagged.push(f.id);
		});
		if (flagged.length) out.push({ row: i, fields: flagged, spill });
	}
	return out;
}

function median(values: number[]): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
