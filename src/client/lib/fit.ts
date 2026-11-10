import type { CustomFont, Field, Table } from "../types";
import { prepareFonts, textsForRow } from "./generate";
import { layoutText } from "./render";

/**
 * Checks every name against its box, the same way the cards are drawn, and returns the
 * rows where some text still doesn't fit at the smallest size. Yields to the page every
 * few hundred rows so typing stays smooth on long lists.
 */
export async function findTooLong(
	fields: Field[],
	customFonts: CustomFont[],
	table: Table,
	signal: AbortSignal,
): Promise<number[]> {
	await prepareFonts(fields, customFonts, table);
	if (signal.aborted) return [];
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return [];
	const bad: number[] = [];
	for (let i = 0; i < table.rows.length; i++) {
		if (i % 250 === 249) {
			await new Promise((r) => setTimeout(r, 0));
			if (signal.aborted) return [];
		}
		const texts = textsForRow(fields, table, i);
		if (fields.some((f, k) => texts[k].trim() && layoutText(ctx, f, texts[k]).overflow)) bad.push(i);
	}
	return bad;
}
