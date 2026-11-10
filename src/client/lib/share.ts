import type { CustomFont, Field, OutputSettings, SharedTemplateConfig, TemplateImage } from "../types";
import { registerCustomFont } from "./fonts";
import { sanitizeField, sanitizeOutput } from "./fields";
import { loadTemplateImage } from "./image";

export async function shareTemplate(
	image: TemplateImage,
	fields: Field[],
	customFonts: CustomFont[],
	output: OutputSettings,
	columns: string[],
): Promise<string> {
	const used = customFonts.filter((f) => fields.some((fl) => fl.font.source === "custom" && fl.font.family === f.family));
	const config: SharedTemplateConfig = {
		version: 1,
		image: { name: image.name, type: image.type, width: image.width, height: image.height },
		fields,
		fonts: used.map(({ id, family, fileName }) => ({ id, family, fileName })),
		output,
		columns,
	};
	const form = new FormData();
	form.set("config", JSON.stringify(config));
	form.set("image", image.blob, image.name);
	for (const f of used) form.append("font", f.blob, f.id);

	const res = await fetch("/api/templates", { method: "POST", body: form });
	const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
	if (!res.ok || !body.id) throw new Error(body.error ?? `Share failed (${res.status})`);
	return `${location.origin}/t/${body.id}`;
}

export interface LoadedTemplate {
	image: TemplateImage;
	fields: Field[];
	customFonts: CustomFont[];
	output: OutputSettings;
	columns: string[];
}

export async function loadSharedTemplate(id: string): Promise<LoadedTemplate> {
	const res = await fetch(`/api/templates/${encodeURIComponent(id)}`);
	if (res.status === 404) throw new Error("This template link doesn't exist (or has expired).");
	if (!res.ok) throw new Error(`Couldn't load template (${res.status})`);
	const config = (await res.json()) as SharedTemplateConfig;

	const imageRes = await fetch(`/api/templates/${encodeURIComponent(id)}/image`);
	if (!imageRes.ok) throw new Error("Template image is missing.");
	const image = await loadTemplateImage(await imageRes.blob(), String(config.image?.name ?? "template"));

	const customFonts: CustomFont[] = await Promise.all(
		(Array.isArray(config.fonts) ? config.fonts : []).map(async (f) => {
			const r = await fetch(`/api/templates/${encodeURIComponent(id)}/fonts/${encodeURIComponent(f.id)}`);
			if (!r.ok) throw new Error(`Font "${f.family}" is missing.`);
			const font: CustomFont = { id: String(f.id), family: String(f.family), fileName: String(f.fileName), blob: await r.blob() };
			await registerCustomFont(font);
			return font;
		}),
	);

	return {
		image,
		fields: (Array.isArray(config.fields) ? config.fields : []).map((f) => sanitizeField(f, image.width, image.height)),
		customFonts,
		output: sanitizeOutput(config.output),
		columns: Array.isArray(config.columns) ? config.columns.filter((c) => typeof c === "string") : [],
	};
}
