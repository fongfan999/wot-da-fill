export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type TextCase = "none" | "upper" | "lower" | "title";

/** Rectangle in template-image pixels. */
export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface FontRef {
	family: string;
	source: "google" | "custom";
	weight: number;
	italic: boolean;
}

export interface Field {
	id: string;
	/** Text with {Column} placeholders, e.g. "Kính mời {Họ tên}". */
	text: string;
	box: Box;
	font: FontRef;
	/** Font size in template pixels; with autoFit, long text shrinks below it as far as needed. */
	fontSize: number;
	autoFit: boolean;
	wrap: boolean;
	lineHeight: number;
	/** Tracking as a percentage of the font size, like design tools. */
	letterSpacing: number;
	color: string;
	align: Align;
	valign: VAlign;
	textCase: TextCase;
}

export interface CustomFont {
	id: string;
	family: string;
	fileName: string;
	blob: Blob;
}

export type OutputFormat = "jpeg" | "png" | "webp";

export interface TemplateImage {
	blob: Blob;
	name: string;
	type: string;
	size: number;
	width: number;
	height: number;
	bitmap: ImageBitmap;
}

export type Row = Record<string, string>;

export interface Table {
	columns: string[];
	rows: Row[];
}

export interface DataSource {
	kind: "file" | "paste" | "sample";
	name: string;
	/** Raw cell grid before header handling. */
	grid: string[][];
	hasHeader: boolean;
	/** Sheets that have something in them; the picker only shows when there are several. */
	sheets?: string[];
	sheet?: string;
	readSheet?(sheet: string): string[][];
}

/** What gets uploaded when sharing a template (no guest data). */
export interface SharedTemplateConfig {
	version: 1;
	image: { name: string; type: string; width: number; height: number };
	fields: Field[];
	fonts: { id: string; family: string; fileName: string }[];
	columns: string[];
}
