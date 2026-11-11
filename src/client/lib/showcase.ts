import type { Field, Table } from "../types";
import { EXAMPLE, type ExampleLang } from "./example";
import { prepareFonts, textsForRow } from "./generate";
import { renderCard } from "./render";
import { createSampleTemplate } from "./sample";

const samples: Partial<Record<ExampleLang, ReturnType<typeof createSampleTemplate>>> = {};

/** The example invitation in one language, drawn once and shared by the home page and "Try an example". */
export function getSampleTemplate(lang: ExampleLang) {
	const made = (samples[lang] ??= createSampleTemplate(lang));
	made.catch(() => delete samples[lang]);
	return made;
}

export interface Showcase {
	/** The invitation with no name on it, for "Add your design". */
	blank: string;
	/** One finished card per name in the language's showcase list. */
	cards: string[];
}

const showcases: Partial<Record<ExampleLang, Promise<Showcase>>> = {};

/**
 * Real cards for the home page: the example invitation run through the same renderer as the
 * download, with each showcase name filled in. Small PNG data URLs, made once per language.
 */
export function getShowcase(lang: ExampleLang, width = 560): Promise<Showcase> {
	const made = (showcases[lang] ??= (async () => {
		const ex = EXAMPLE[lang];
		const { blob, fields } = await getSampleTemplate(lang);
		const bitmap = await createImageBitmap(blob);
		const [nameCol, tableCol] = ex.columns;
		const table: Table = {
			columns: [...ex.columns],
			rows: ex.showcase.map((n, i) => ({ [nameCol]: n, [tableCol]: String(Math.floor(i / 2) + 1) })),
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
		return { blank: draw([], 0), cards: ex.showcase.map((_, i) => draw(fields, i)) };
	})());
	made.catch(() => delete showcases[lang]);
	return made;
}
