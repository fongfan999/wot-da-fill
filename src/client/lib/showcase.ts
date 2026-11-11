import type { Field, Table } from "../types";
import { prepareFonts, textsForRow } from "./generate";
import { renderCard } from "./render";
import { createSampleTemplate } from "./sample";

/** Names on the home page's list and on the cards drawn from it, in the design system's order. */
export const SHOWCASE_NAMES = ["Nguyễn Văn An", "Trần Thị Bích Ngọc", "Lê Hoàng Minh Châu", "Phạm Quốc Bảo"];

let sample: ReturnType<typeof createSampleTemplate> | null = null;

/** The example invitation, drawn once and shared by the home page and "Try an example". */
export function getSampleTemplate() {
	sample ??= createSampleTemplate();
	sample.catch(() => (sample = null));
	return sample;
}

export interface Showcase {
	/** The invitation with no name on it, for "Add your design". */
	blank: string;
	/** One finished card per name in SHOWCASE_NAMES. */
	cards: string[];
}

let showcase: Promise<Showcase> | null = null;

/**
 * Real cards for the home page: the example invitation run through the same renderer as the
 * download, with each name filled in. Small PNG data URLs, made once per visit.
 */
export function getShowcase(width = 560): Promise<Showcase> {
	showcase ??= (async () => {
		const { blob, fields } = await getSampleTemplate();
		const bitmap = await createImageBitmap(blob);
		const table: Table = {
			columns: ["Họ tên", "Bàn"],
			rows: SHOWCASE_NAMES.map((n, i) => ({ "Họ tên": n, Bàn: String(Math.floor(i / 2) + 1) })),
		};
		await prepareFonts(fields, [], table);
		const draw = (shown: Field[], row: number) => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = Math.round((width * bitmap.height) / bitmap.width);
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas 2D is not available.");
			renderCard(ctx, { image: bitmap, width: bitmap.width, height: bitmap.height, fields: shown, texts: textsForRow(shown, table, row) });
			return canvas.toDataURL("image/png");
		};
		return { blank: draw([], 0), cards: SHOWCASE_NAMES.map((_, i) => draw(fields, i)) };
	})();
	showcase.catch(() => (showcase = null));
	return showcase;
}
