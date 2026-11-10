import { Hono } from "hono";

/**
 * API for shareable templates. A template is the design image, the text-field layout
 * and any custom fonts. Guest lists stay in the browser and are never uploaded.
 *
 * R2 layout:  t/<id>/config.json · t/<id>/image · t/<id>/fonts/<fontId>
 */

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_FONT_BYTES = 8 * 1024 * 1024;
const MAX_FONTS = 8;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_FIELDS = 50;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + MAX_FONTS * MAX_FONT_BYTES + MAX_CONFIG_BYTES + 64 * 1024;

const ID_RE = /^[A-Za-z0-9]{16}$/;
const FONT_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const IMMUTABLE = "public, max-age=31536000, immutable";

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

app.post("/templates", async (c) => {
	const ip = c.req.header("cf-connecting-ip") ?? "local";
	const { success } = await c.env.SHARE_LIMITER.limit({ key: ip });
	if (!success) return c.json({ error: "Too many shares from your network. Try again in a minute." }, 429);

	const declared = Number(c.req.header("content-length") ?? 0);
	if (declared > MAX_REQUEST_BYTES) return c.json({ error: "Upload is too large." }, 413);

	let form: FormData;
	try {
		form = await c.req.formData();
	} catch {
		return c.json({ error: "Expected multipart form data." }, 400);
	}

	const rawConfig = form.get("config");
	if (typeof rawConfig !== "string" || rawConfig.length > MAX_CONFIG_BYTES) {
		return c.json({ error: "Missing or oversized config." }, 400);
	}
	let config: Record<string, unknown>;
	try {
		config = JSON.parse(rawConfig);
	} catch {
		return c.json({ error: "Config is not valid JSON." }, 400);
	}
	if (
		!config ||
		typeof config !== "object" ||
		config.version !== 1 ||
		!Array.isArray(config.fields) ||
		config.fields.length > MAX_FIELDS
	) {
		return c.json({ error: "Config has an unexpected shape." }, 400);
	}

	const image = form.get("image");
	if (!(image instanceof File) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
		return c.json({ error: `Design image is missing or larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` }, 400);
	}
	const imageBytes = new Uint8Array(await image.arrayBuffer());
	const imageType = sniffImage(imageBytes);
	if (!imageType) return c.json({ error: "Design must be a JPEG, PNG or WebP image." }, 400);

	const fontFiles = form.getAll("font").filter((f): f is File => f instanceof File);
	if (fontFiles.length > MAX_FONTS) return c.json({ error: `At most ${MAX_FONTS} custom fonts.` }, 400);
	const fonts: { id: string; bytes: Uint8Array; type: string }[] = [];
	for (const file of fontFiles) {
		if (!FONT_ID_RE.test(file.name) || file.size > MAX_FONT_BYTES) {
			return c.json({ error: "A font file is invalid or too large." }, 400);
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		const type = sniffFont(bytes);
		if (!type) return c.json({ error: `"${file.name}" is not a TTF, OTF, WOFF or WOFF2 font.` }, 400);
		fonts.push({ id: file.name, bytes, type });
	}

	const id = newId();
	const prefix = `t/${id}/`;
	const bucket = c.env.TEMPLATES;
	await Promise.all([
		bucket.put(`${prefix}image`, imageBytes, { httpMetadata: { contentType: imageType } }),
		...fonts.map((f) => bucket.put(`${prefix}fonts/${f.id}`, f.bytes, { httpMetadata: { contentType: f.type } })),
	]);
	// Written last, so a template only becomes visible once all of its files exist.
	await bucket.put(`${prefix}config.json`, JSON.stringify({ ...config, id, createdAt: new Date().toISOString() }), {
		httpMetadata: { contentType: "application/json" },
	});

	return c.json({ id }, 201);
});

app.get("/templates/:id", async (c) => {
	const id = c.req.param("id");
	if (!ID_RE.test(id)) return c.json({ error: "Not found" }, 404);
	return serveObject(c.env.TEMPLATES, `t/${id}/config.json`);
});

app.get("/templates/:id/image", async (c) => {
	const id = c.req.param("id");
	if (!ID_RE.test(id)) return c.json({ error: "Not found" }, 404);
	return serveObject(c.env.TEMPLATES, `t/${id}/image`);
});

app.get("/templates/:id/fonts/:fontId", async (c) => {
	const { id, fontId } = c.req.param();
	if (!ID_RE.test(id) || !FONT_ID_RE.test(fontId)) return c.json({ error: "Not found" }, 404);
	return serveObject(c.env.TEMPLATES, `t/${id}/fonts/${fontId}`);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
	console.error(err);
	return c.json({ error: "Something went wrong." }, 500);
});

async function serveObject(bucket: R2Bucket, key: string): Promise<Response> {
	const object = await bucket.get(key);
	if (!object) return Response.json({ error: "Not found" }, { status: 404 });
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", IMMUTABLE);
	headers.set("x-content-type-options", "nosniff");
	return new Response(object.body, { headers });
}

function newId(): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let id = "";
	for (const b of bytes) id += alphabet[b % alphabet.length];
	return id;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
	return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));

function sniffImage(bytes: Uint8Array): string | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
	if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
	return null;
}

function sniffFont(bytes: Uint8Array): string | null {
	if (startsWith(bytes, [0x00, 0x01, 0x00, 0x00]) || startsWith(bytes, ascii("true"))) return "font/ttf";
	if (startsWith(bytes, ascii("OTTO"))) return "font/otf";
	if (startsWith(bytes, ascii("wOFF"))) return "font/woff";
	if (startsWith(bytes, ascii("wOF2"))) return "font/woff2";
	return null;
}

export default app;
