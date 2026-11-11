import type { Field, FontRef } from "../types";
import { EXAMPLE, EXAMPLE_SIZE, type ExampleKind, type ExampleLang } from "./example";
import { newField } from "./fields";
import { ensureFont, fontCss } from "./fonts";

/*
 * The three example designs (design system ExampleCard), drawn as real pictures. The design system
 * lays them out in cqw (1cqw = 1% of the card's width); here every measurement is that number times
 * W / 100 at the picture's full size, and every line of text sits on the baseline CSS would give it
 * (line height 1.2, half-leading above the font's ascent). Their colours and fonts belong to the
 * pictures, not to the interface.
 */

const g = (family: string, weight: number, italic = false): FontRef => ({ family, source: "google", weight, italic });
const VN = "Be Vietnam Pro";
const CORMORANT = "Cormorant Garamond";
const PLAYFAIR = "Playfair Display";

type Ctx = CanvasRenderingContext2D;
interface Run {
	text: string;
	font: FontRef;
	size: number;
	color: string;
	/** Letter spacing in em, as in the CSS. */
	ls?: number;
}

function setRun(ctx: Ctx, r: Run) {
	ctx.font = fontCss(r.font, r.size);
	if ("letterSpacing" in ctx) ctx.letterSpacing = `${(r.ls ?? 0) * r.size}px`;
}

/** Width as CSS lays it out: letter spacing after every glyph, the last one included. */
function width(ctx: Ctx, r: Run) {
	setRun(ctx, r);
	return ctx.measureText(r.text).width;
}

/** Distance from the top of a 1.2 line box to the baseline, as CSS places it. */
function baselineOffset(ctx: Ctx, r: Run) {
	setRun(ctx, r);
	const m = ctx.measureText("Hg");
	const a = m.fontBoundingBoxAscent ?? r.size * 0.92;
	const d = m.fontBoundingBoxDescent ?? r.size * 0.24;
	return (1.2 * r.size - (a + d)) / 2 + a;
}

/** One line of text made of runs, with its line box's top at `top`, placed by `x` and `align`. */
function line(ctx: Ctx, runs: Run[], top: number, x: number, align: "left" | "center" | "right") {
	const total = runs.reduce((w, r) => w + width(ctx, r), 0);
	const base = top + Math.max(...runs.map((r) => baselineOffset(ctx, r)));
	let left = align === "left" ? x : align === "right" ? x - total : x - total / 2;
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	for (const r of runs) {
		setRun(ctx, r);
		ctx.fillStyle = r.color;
		ctx.fillText(r.text, left, base);
		left += ctx.measureText(r.text).width;
	}
	if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function text(ctx: Ctx, r: Run, top: number, x: number, align: "left" | "center" | "right" = "center") {
	line(ctx, [r], top, x, align);
}

/** Every face and character an example needs, loaded before the first stroke. */
async function loadFonts(lang: ExampleLang, kind: ExampleKind) {
	const ex = EXAMPLE[lang];
	const words = JSON.stringify(ex[kind]) + ex.names.join("") + ex.companies.join("") + ex.tableText.toLocaleUpperCase("vi") + "0123456789";
	const faces =
		kind === "invitation"
			? [g(CORMORANT, 500), g(CORMORANT, 400, true), g(CORMORANT, 500, true), g(VN, 500), g(VN, 600)]
			: kind === "certificate"
				? [g(PLAYFAIR, 600), g(PLAYFAIR, 500, true), g(VN, 400), g(VN, 500), g(VN, 600)]
				: [g(VN, 500), g(VN, 600), g(VN, 800)];
	await Promise.all(faces.map((f) => ensureFont(f, words)));
}

function drawInvitation(ctx: Ctx, lang: ExampleLang) {
	const { w: W, h: H } = EXAMPLE_SIZE.invitation;
	const cq = W / 100;
	const c = EXAMPLE[lang].invitation;
	const green = "#1f3a2e";
	const terracotta = "#c8623f";
	const deep = "#b5522f";
	const sage = "#4f6a5b";

	ctx.fillStyle = "#f4efe6";
	ctx.fillRect(0, 0, W, H);
	for (const [x, y, fill] of [
		[0, 0, terracotta],
		[W, H, green],
	] as const) {
		ctx.beginPath();
		ctx.arc(x, y, 10 * cq, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
	}

	text(ctx, { text: c.kicker, font: g(VN, 600), size: 1.45 * cq, color: sage, ls: 0.42 }, 0.105 * H, W / 2);
	const couple = { font: g(CORMORANT, 500), size: 8 * cq, color: green, ls: -0.01 };
	line(
		ctx,
		[
			{ ...couple, text: `${c.couple[0]} ` },
			{ ...couple, text: "&", font: g(CORMORANT, 400, true), color: deep },
			{ ...couple, text: ` ${c.couple[1]}` },
		],
		0.165 * H,
		W / 2,
		"center",
	);
	text(ctx, { text: c.invite, font: g(CORMORANT, 400, true), size: 2.8 * cq, color: green }, 0.325 * H, W / 2);
	ctx.fillStyle = terracotta;
	ctx.fillRect(33 * cq, 0.555 * H, 34 * cq, 0.16 * cq);
	text(ctx, { text: c.occasion, font: g(CORMORANT, 400, true), size: 2.8 * cq, color: green }, 0.585 * H, W / 2);

	// Day | date | time, in one row centred on the card, each item centred on the row.
	const small = { font: g(VN, 600), size: 1.45 * cq, color: green, ls: 0.3 };
	const date = { text: c.date, font: g(CORMORANT, 500), size: 5.4 * cq, color: green };
	const span = 16 * cq;
	const gap = 3 * cq;
	const pad = 3 * cq;
	const border = 0.16 * cq;
	const dateBox = pad * 2 + border * 2 + width(ctx, date);
	const rowTop = 0.685 * H;
	const rowH = 1.2 * date.size;
	const mid = rowTop + rowH / 2;
	const left = W / 2 - (span * 2 + gap * 2 + dateBox) / 2;
	text(ctx, { ...small, text: c.day }, mid - 0.6 * small.size, left + span, "right");
	const boxX = left + span + gap;
	ctx.fillStyle = "#1f3a2e66";
	ctx.fillRect(boxX, rowTop, border, rowH);
	ctx.fillRect(boxX + dateBox - border, rowTop, border, rowH);
	text(ctx, date, rowTop, boxX + border + pad, "left");
	text(ctx, { ...small, text: c.time }, mid - 0.6 * small.size, boxX + dateBox + gap, "left");

	text(ctx, { text: c.venue, font: g(VN, 500), size: 1.35 * cq, color: sage, ls: 0.34 }, 0.85 * H, W / 2);
}

function drawCertificate(ctx: Ctx, lang: ExampleLang) {
	const { w: W, h: H } = EXAMPLE_SIZE.certificate;
	const cq = W / 100;
	const c = EXAMPLE[lang].certificate;
	const navy = "#17233f";
	const ochre = "#d6a444";
	const grey = "#4b556b";
	const hair = "#17233f55";
	const x = 33 * cq;

	ctx.fillStyle = "#fbfaf6";
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = navy;
	ctx.fillRect(0, 0, 26 * cq, H);

	// The seal: an ochre ring, a navy band, then a thin ochre ring inside it.
	const sx = 6 * cq + 7 * cq;
	const sy = 20 * cq + 7 * cq;
	const ring = (outer: number, inner: number, fill: string) => {
		ctx.beginPath();
		ctx.arc(sx, sy, outer, 0, Math.PI * 2);
		ctx.arc(sx, sy, inner, 0, Math.PI * 2, true);
		ctx.fillStyle = fill;
		ctx.fill();
	};
	const r = 7 * cq;
	const b = 0.45 * cq;
	ring(r, r - b, ochre);
	ring(r - b - 1.1 * cq, r - b - 1.35 * cq, ochre);
	const seal = { text: "2026", font: g(PLAYFAIR, 600), size: 2.7 * cq, color: ochre };
	text(ctx, seal, sy - 0.6 * seal.size, sx);
	const org = { text: c.org, font: g(VN, 600), size: 1.15 * cq, color: "#e9e4d6", ls: 0.3 };
	text(ctx, org, H - 6 * cq - 1.2 * org.size, 13 * cq);

	text(ctx, { text: c.title, font: g(PLAYFAIR, 600), size: 4.5 * cq, color: navy, ls: -0.01 }, 9.5 * cq, x, "left");
	text(ctx, { text: c.lead, font: g(VN, 400), size: 1.85 * cq, color: grey }, 21.4 * cq, x, "left");
	ctx.fillStyle = hair;
	ctx.fillRect(x, 37.6 * cq, W - 6 * cq - x, 0.16 * cq);
	text(ctx, { text: c.after, font: g(VN, 400), size: 1.85 * cq, color: grey }, 40 * cq, x, "left");
	text(ctx, { text: c.course, font: g(VN, 600), size: 2.9 * cq, color: navy }, 43.6 * cq, x, "left");
	text(ctx, { text: c.meta, font: g(VN, 400), size: 1.6 * cq, color: grey }, 48.6 * cq, x, "left");

	// Signature and date: each a column standing on the same bottom line, a label under a hairline.
	const bottom = 55.6 * cq + 9 * cq;
	const label = { font: g(VN, 600), size: 1.1 * cq, color: grey, ls: 0.3 };
	const labelTop = bottom - 1.2 * label.size;
	const ruleTop = labelTop - 1 * cq - 0.16 * cq;
	const column = (left: number, caption: string) => {
		ctx.fillStyle = hair;
		ctx.fillRect(left, ruleTop, 22 * cq, 0.16 * cq);
		text(ctx, { ...label, text: caption }, labelTop, left, "left");
	};
	column(x, c.sign);
	column(62 * cq, c.dateLabel);
	const date = { text: c.date, font: g(VN, 500), size: 1.9 * cq, color: navy };
	text(ctx, date, ruleTop - 1 * cq - 1.2 * date.size, 62 * cq, "left");

	// The signature: the design system's line, scaled from its 120 x 36 drawing to 14cqw x 4.2cqw.
	const sw = 14 * cq;
	const sh = 4.2 * cq;
	ctx.save();
	ctx.translate(x, ruleTop - 0.6 * cq - sh);
	ctx.scale(sw / 120, sh / 36);
	ctx.strokeStyle = navy;
	ctx.lineWidth = 2;
	ctx.lineCap = "round";
	ctx.stroke(new Path2D("M4 28c10-18 18-24 22-12 3 9 8 6 14-4 5-8 10-6 11 3 1 8 6 8 14-2 6-8 12-7 14 0 2 6 8 6 20-3"));
	ctx.restore();
}

function drawBadge(ctx: Ctx, lang: ExampleLang) {
	const { w: W, h: H } = EXAMPLE_SIZE.badge;
	const cq = W / 100;
	const c = EXAMPLE[lang].badge;
	const ink = "#16181d";

	// Rounded corners: the picture is a badge, so outside them stays transparent.
	ctx.beginPath();
	ctx.roundRect(0, 0, W, H, 5 * cq);
	ctx.clip();
	ctx.fillStyle = "#fbfaf6";
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = "#e4572e";
	ctx.fillRect(0, 0, W, 60 * cq);
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.roundRect(W / 2 - 9 * cq, 6 * cq, 18 * cq, 4 * cq, 2 * cq);
	ctx.fill();

	// The event name: two lines at line height 0.92, so each line box is 0.92 x the size.
	const event = { font: g(VN, 800), size: 14.5 * cq, color: "#ffffff", ls: -0.035 };
	const lh = 0.92 * event.size;
	c.event.forEach((word, i) => text(ctx, { ...event, text: word }, 17 * cq + i * lh - (1.2 * event.size - lh) / 2, W / 2));
	text(ctx, { text: c.sub, font: g(VN, 600), size: 2.9 * cq, color: ink, ls: 0.3 }, 48.5 * cq, W / 2);

	ctx.fillStyle = ink;
	ctx.fillRect(0, H - 16 * cq, W, 16 * cq);
	const band = { text: c.band, font: g(VN, 600), size: 3.4 * cq, color: "#ffffff", ls: 0.36 };
	text(ctx, band, H - 8 * cq - 0.6 * band.size, W / 2);
}

/** The text boxes each example arrives with, placed and styled where ExampleCard draws them. */
function fieldsFor(lang: ExampleLang, kind: ExampleKind): Field[] {
	const ex = EXAMPLE[lang];
	const name = `{${ex.nameColumn}}`;
	const field = (box: Field["box"], text: string, font: FontRef, size: number, color: string, extra: Partial<Field> = {}): Field => ({
		...newField(box, text, font),
		fontSize: size,
		color,
		...extra,
	});
	if (kind === "certificate") {
		// Left-aligned from a third across, 39% to 53% down.
		return [field({ x: 660, y: 548, w: 1220, h: 192 }, name, g(PLAYFAIR, 500, true), 116, "#17233f", { align: "left" })];
	}
	if (kind === "badge") {
		return [
			field({ x: 72, y: 792, w: 1056, h: 240 }, name, g(VN, 800), 120, "#16181d", { letterSpacing: -3 }),
			field({ x: 72, y: 1037, w: 1056, h: 80 }, `{${ex.companyColumn}}`, g(VN, 500), 55, "#5b6170"),
		];
	}
	return [
		// Centred, 38% to 53% down.
		field({ x: 240, y: 532, w: 1520, h: 210 }, name, g(CORMORANT, 500, true), 132, "#b5522f"),
		field({ x: 600, y: 1256, w: 800, h: 68 }, ex.tableText, g(VN, 600), 27, "#b5522f", { letterSpacing: 34, textCase: "upper" }),
	];
}

/** Draws one example as a real picture, with its text boxes ready to fill. */
export async function createSampleTemplate(
	lang: ExampleLang = "en",
	kind: ExampleKind = "invitation",
): Promise<{ blob: Blob; fields: Field[]; fileName: string }> {
	await loadFonts(lang, kind);
	const { w, h } = EXAMPLE_SIZE[kind];
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D is not available.");
	if (kind === "certificate") drawCertificate(ctx, lang);
	else if (kind === "badge") drawBadge(ctx, lang);
	else drawInvitation(ctx, lang);
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the example"))), "image/png"),
	);
	return { blob, fields: fieldsFor(lang, kind), fileName: EXAMPLE[lang].file[kind] };
}
