import type { Table } from "../types";
import { EXAMPLE, EXAMPLE_SIZE, exampleGrid, type ExampleKind, type ExampleLang } from "./example";
import { prepareFonts, textsForRow } from "./generate";
import { renderCard } from "./render";
import { createSampleTemplate } from "./sample";

type Template = Awaited<ReturnType<typeof createSampleTemplate>>;
const templates = new Map<string, Promise<Template>>();

/** One example in one language, drawn once and shared by the home page and "Try an example". */
export function getSampleTemplate(lang: ExampleLang, kind: ExampleKind): Promise<Template> {
	const key = `${lang}:${kind}`;
	let made = templates.get(key);
	if (!made) {
		made = createSampleTemplate(lang, kind);
		templates.set(key, made);
		made.catch(() => templates.delete(key));
	}
	return made;
}

/** The example's list as a table, the same one "Try an example" loads. */
export function exampleTable(lang: ExampleLang, kind: ExampleKind): Table {
	const [head, ...body] = exampleGrid(lang, kind);
	return { columns: head, rows: body.map((r) => Object.fromEntries(head.map((c, i) => [c, r[i] ?? ""]))) };
}

export interface Showcase {
	/** The design with nothing filled in. */
	blank: string;
	/** For each sample name, just its text on a transparent layer the size of the design, so it can be laid over `blank`. */
	names: string[];
}

const showcases = new Map<string, Promise<Showcase>>();

/** Wide enough to stay sharp at twice the size the home page shows it. */
const RENDER_WIDTH: Record<ExampleKind, number> = { invitation: 960, certificate: 960, badge: 560 };

/**
 * The home page's pictures, made with the same renderer as the download: the blank design, and
 * each sample name (with its table or company) as its own transparent layer. Laying a layer over
 * the blank gives the finished card; swapping layers changes the name while the design stays put.
 */
export function getShowcase(lang: ExampleLang, kind: ExampleKind): Promise<Showcase> {
	const key = `${lang}:${kind}`;
	let made = showcases.get(key);
	if (!made) {
		made = (async () => {
			const { blob, fields } = await getSampleTemplate(lang, kind);
			const bitmap = await createImageBitmap(blob);
			const table = exampleTable(lang, kind);
			await prepareFonts(fields, [], table);
			const { w, h } = EXAMPLE_SIZE[kind];
			const width = RENDER_WIDTH[kind];
			const height = Math.round((width * h) / w);
			const empty = document.createElement("canvas");
			empty.width = empty.height = 1;
			const draw = async (withDesign: boolean, row: number | null) => {
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Canvas 2D is not available.");
				const shown = row === null ? [] : fields;
				renderCard(ctx, { image: withDesign ? bitmap : empty, width: w, height: h, fields: shown, texts: textsForRow(shown, table, row ?? 0) });
				const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
				return out ? URL.createObjectURL(out) : canvas.toDataURL("image/png");
			};
			const blank = await draw(true, null);
			const names = await Promise.all(EXAMPLE[lang].names.map((_, i) => draw(false, i)));
			return { blank, names };
		})();
		showcases.set(key, made);
		made.catch(() => showcases.delete(key));
	}
	return made;
}
