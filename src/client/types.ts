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
	/** Font size in template pixels (the maximum when autoFit is on). */
	fontSize: number;
	minFontSize: number;
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
export type Compression = "small" | "balanced" | "high";

export interface OutputSettings {
	format: OutputFormat;
	compression: Compression;
	/** Longest edge in pixels; null keeps the template's size. */
	maxEdge: number | null;
	filenamePattern: string;
	asciiFilenames: boolean;
	/** Used to flatten transparent templates when exporting JPEG. */
	background: string;
}

export interface TemplateImage {
	blob: Blob;
	name: string;
	type: string;
	size: number;
	width: number;
	height: number;
	hasAlpha: boolean;
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
	sheets?: string[];
	sheet?: string;
}

/** What gets uploaded when sharing a template (no guest data). */
export interface SharedTemplateConfig {
	version: 1;
	image: { name: string; type: string; width: number; height: number };
	fields: Field[];
	fonts: { id: string; family: string; fileName: string }[];
	output: OutputSettings;
	columns: string[];
}
