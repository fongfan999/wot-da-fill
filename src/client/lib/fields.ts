import type { Box, Field, FontRef } from "../types";
import { DEFAULT_FONT } from "./fonts";
import { uid } from "./text";

export function newField(box: Box, text: string, font: FontRef = DEFAULT_FONT): Field {
	return {
		id: uid("fld_"),
		text,
		box: roundBox(box),
		font: { ...font },
		fontSize: Math.max(12, Math.round(box.h * 0.75)),
		autoFit: true,
		wrap: false,
		lineHeight: 1.2,
		letterSpacing: 0,
		color: "#222222",
		align: "center",
		valign: "middle",
		textCase: "none",
	};
}

export function roundBox(b: Box): Box {
	return { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) };
}

export function clampBox(b: Box, width: number, height: number): Box {
	const w = Math.min(Math.max(4, b.w), width);
	const h = Math.min(Math.max(4, b.h), height);
	return roundBox({ x: Math.min(Math.max(0, b.x), width - w), y: Math.min(Math.max(0, b.y), height - h), w, h });
}


const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, min: number, max: number, dflt: number) =>
	typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
const pick = <T extends string>(v: unknown, options: readonly T[], dflt: T): T =>
	options.includes(v as T) ? (v as T) : dflt;
const str = (v: unknown, dflt: string, max = 500) => (typeof v === "string" ? v.slice(0, max) : dflt);

/** Shared templates come from the network: rebuild every field defensively. */
export function sanitizeField(input: unknown, width: number, height: number): Field {
	const f = (input ?? {}) as Partial<Field>;
	const box = (f.box ?? {}) as Partial<Box>;
	const font = (f.font ?? {}) as Partial<FontRef>;
	const base = newField(
		clampBox({ x: num(box.x, 0, width, 0), y: num(box.y, 0, height, 0), w: num(box.w, 4, width, 200), h: num(box.h, 4, height, 60) }, width, height),
		str(f.text, "{Name}"),
		{
			family: str(font.family, DEFAULT_FONT.family, 100),
			source: pick(font.source, ["google", "custom"] as const, "google"),
			weight: num(font.weight, 100, 1000, 400),
			italic: font.italic === true,
		},
	);
	return {
		...base,
		fontSize: num(f.fontSize, 1, 2000, base.fontSize),
		autoFit: f.autoFit !== false,
		wrap: f.wrap === true,
		lineHeight: num(f.lineHeight, 0.5, 4, 1.2),
		letterSpacing: num(f.letterSpacing, -50, 200, 0),
		color: typeof f.color === "string" && HEX.test(f.color) ? f.color : "#222222",
		align: pick(f.align, ["left", "center", "right"] as const, "center"),
		valign: pick(f.valign, ["top", "middle", "bottom"] as const, "middle"),
		textCase: pick(f.textCase, ["none", "upper", "lower", "title"] as const, "none"),
	};
}

