import type { Field } from "../types";
import { fontCss } from "./fonts";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Line {
	text: string;
	width: number;
}

export interface TextLayout {
	size: number;
	lines: Line[];
	/** Baseline of the first line, in template pixels. */
	baseline: number;
	lineGap: number;
	spacing: number;
	/** True when text is wider/taller than its box even at the smallest allowed size. */
	overflow: boolean;
}

const supportsLetterSpacing =
	typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype;

function setFont(ctx: Ctx, field: Field, size: number): number {
	ctx.font = fontCss(field.font, size);
	const spacing = (field.letterSpacing / 100) * size;
	if (supportsLetterSpacing) ctx.letterSpacing = `${spacing}px`;
	return supportsLetterSpacing ? spacing : 0;
}

function measure(ctx: Ctx, text: string, spacing: number): number {
	if (!text) return 0;
	// Canvas adds letter-spacing after the last glyph too; drop it so alignment is exact.
	return ctx.measureText(text).width - spacing;
}

function wrapParagraph(ctx: Ctx, paragraph: string, maxWidth: number, spacing: number): Line[] {
	const words = paragraph.split(" ");
	const lines: Line[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (!current || measure(ctx, candidate, spacing) <= maxWidth) {
			current = candidate;
		} else {
			lines.push({ text: current, width: measure(ctx, current, spacing) });
			current = word;
		}
	}
	lines.push({ text: current, width: measure(ctx, current, spacing) });
	return lines;
}

function linesAt(ctx: Ctx, field: Field, text: string, size: number): { lines: Line[]; spacing: number } {
	const spacing = setFont(ctx, field, size);
	const paragraphs = text.split("\n");
	const lines = field.wrap
		? paragraphs.flatMap((p) => wrapParagraph(ctx, p, field.box.w, spacing))
		: paragraphs.map((p) => ({ text: p, width: measure(ctx, p, spacing) }));
	return { lines, spacing };
}

/** Cap height (baseline to top of "H") as a fraction of the font size. */
function capHeightRatio(ctx: Ctx, field: Field): number {
	setFont(ctx, field, 100);
	const m = ctx.measureText("H");
	const cap = m.actualBoundingBoxAscent;
	return cap > 0 ? cap / 100 : 0.7;
}

export function layoutText(ctx: Ctx, field: Field, text: string): TextLayout {
	const { box } = field;
	const cap = capHeightRatio(ctx, field);
	const blockHeight = (size: number, n: number) => size * cap + (n - 1) * size * field.lineHeight;
	const widest = (lines: Line[]) => lines.reduce((w, l) => Math.max(w, l.width), 0);
	const fits = (size: number, lines: Line[]) =>
		widest(lines) <= box.w + 0.5 && (!field.wrap || blockHeight(size, lines.length) <= box.h + 0.5);

	const max = Math.max(1, field.fontSize);
	const min = 1;
	let size = max;
	let result = linesAt(ctx, field, text, size);

	if (field.autoFit && !fits(size, result.lines)) {
		if (!field.wrap) {
			// Width scales ~linearly with size: jump straight there, then nudge for hinting.
			size = Math.max(min, (max * box.w) / Math.max(1, widest(result.lines)));
			result = linesAt(ctx, field, text, size);
			while (size > min && !fits(size, result.lines)) {
				size = Math.max(min, size * 0.98);
				result = linesAt(ctx, field, text, size);
			}
		} else {
			let lo = min;
			let hi = max;
			for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
				const mid = (lo + hi) / 2;
				if (fits(mid, linesAt(ctx, field, text, mid).lines)) lo = mid;
				else hi = mid;
			}
			size = lo;
			result = linesAt(ctx, field, text, size);
		}
	}

	const lineGap = size * field.lineHeight;
	const capPx = size * cap;
	const n = result.lines.length;
	let baseline: number;
	if (field.valign === "top") baseline = box.y + capPx;
	else if (field.valign === "bottom") baseline = box.y + box.h - (n - 1) * lineGap;
	else baseline = box.y + (box.h - blockHeight(size, n)) / 2 + capPx;

	return {
		size,
		lines: result.lines,
		baseline,
		lineGap,
		spacing: result.spacing,
		overflow: !fits(size, result.lines),
	};
}

export function drawText(ctx: Ctx, field: Field, text: string): TextLayout | null {
	if (!text.trim()) return null;
	const layout = layoutText(ctx, field, text);
	setFont(ctx, field, layout.size);
	ctx.fillStyle = field.color;
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	layout.lines.forEach((line, i) => {
		const { x, w } = field.box;
		const left = field.align === "left" ? x : field.align === "right" ? x + w - line.width : x + (w - line.width) / 2;
		ctx.fillText(line.text, left, layout.baseline + i * layout.lineGap);
	});
	return layout;
}

export interface CardInput {
	image: CanvasImageSource;
	width: number;
	height: number;
	fields: Field[];
	/** Final text for each field (placeholders filled, case applied), same order as fields. */
	texts: string[];
}

/** Draws the design + all text into ctx, scaled to fill ctx.canvas. Returns per-field layouts. */
export function renderCard(ctx: Ctx, input: CardInput): (TextLayout | null)[] {
	const { width: cw, height: ch } = ctx.canvas;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, cw, ch);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(input.image, 0, 0, cw, ch);
	// Lay text out in template coordinates so output size never changes the composition.
	ctx.setTransform(cw / input.width, 0, 0, ch / input.height, 0, 0);
	const layouts = input.fields.map((f, i) => drawText(ctx, f, input.texts[i] ?? ""));
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	return layouts;
}
