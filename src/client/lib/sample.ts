import type { Field } from "../types";
import { EXAMPLE, type ExampleLang } from "./example";
import { ensureFont } from "./fonts";
import { newField } from "./fields";

const W = 2000;
const H = 1400;
const GOLD = "#b08a4f";
const INK = "#5b4630";

/**
 * Draws a demo wedding invitation (with an empty name line) so people can try the flow instantly.
 * English by default, or the Vietnamese one; both use the same fonts and layout.
 */
export async function createSampleTemplate(lang: ExampleLang = "en"): Promise<{ blob: Blob; fields: Field[] }> {
	const ex = EXAMPLE[lang];
	const words = ex.card;
	const serif = { family: "Playfair Display", source: "google" as const, weight: 400, italic: true };
	const serifBold = { ...serif, weight: 600, italic: false };
	const sans = { family: "Montserrat", source: "google" as const, weight: 500, italic: false };
	const script = { family: "Great Vibes", source: "google" as const, weight: 400, italic: false };
	await Promise.all([
		ensureFont(serif, `${words.invite} ${words.occasion}`),
		ensureFont(serifBold, words.kicker),
		ensureFont(sans, `${words.when} ${ex.tableText.toLocaleUpperCase("vi")} 0123456789`),
		ensureFont(script, `${words.couple} ${ex.guests.join(" ")}`),
	]);

	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;

	const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
	bg.addColorStop(0, "#fffaf2");
	bg.addColorStop(1, "#f1e4cf");
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, W, H);

	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 6;
	ctx.strokeRect(70, 70, W - 140, H - 140);
	ctx.lineWidth = 2;
	ctx.strokeRect(95, 95, W - 190, H - 190);

	// Corner flourishes
	for (const [cx, cy, sx, sy] of [
		[95, 95, 1, 1],
		[W - 95, 95, -1, 1],
		[95, H - 95, 1, -1],
		[W - 95, H - 95, -1, -1],
	]) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(sx, sy);
		ctx.lineWidth = 3;
		for (const r of [60, 90, 120]) {
			ctx.beginPath();
			ctx.arc(0, 0, r, 0.1, Math.PI / 2 - 0.1);
			ctx.stroke();
		}
		ctx.fillStyle = GOLD;
		ctx.beginPath();
		ctx.arc(40, 40, 7, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	const text = (t: string, font: string, color: string, y: number, spacing = 0) => {
		ctx.font = font;
		ctx.fillStyle = color;
		ctx.textAlign = "center";
		if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
		ctx.fillText(t, W / 2 + spacing / 2, y);
		if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
	};

	text(words.kicker, '600 76px "Playfair Display"', GOLD, 290, 18);
	ctx.fillStyle = GOLD;
	ctx.fillRect(W / 2 - 120, 330, 240, 3);
	text(words.invite, 'italic 400 54px "Playfair Display"', INK, 470);

	// Name line
	ctx.fillStyle = GOLD;
	ctx.fillRect(W / 2 - 520, 735, 1040, 2);
	ctx.beginPath();
	ctx.arc(W / 2, 736, 7, 0, Math.PI * 2);
	ctx.fill();

	text(words.occasion, 'italic 400 44px "Playfair Display"', INK, 840);
	text(words.couple, '400 120px "Great Vibes"', GOLD, 1010);
	text(words.when, '500 28px "Montserrat"', INK, 1110, 4);

	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw sample"))), "image/png"),
	);

	const name = newField({ x: 420, y: 560, w: 1160, h: 160 }, ex.nameText, script);
	name.fontSize = 130;
	name.color = "#8a6730";

	const table = newField({ x: 760, y: 1170, w: 480, h: 56 }, ex.tableText, sans);
	table.fontSize = 32;
	table.letterSpacing = 12;
	table.textCase = "upper";
	table.color = INK;

	return { blob, fields: [name, table] };
}
