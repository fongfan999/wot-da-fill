import type { TemplateImage } from "../types";

const MAX_PIXELS = 60_000_000;

export async function loadTemplateImage(blob: Blob, name: string): Promise<TemplateImage> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
	} catch {
		throw new Error("This browser can't open that image. Use JPG, PNG or WebP.");
	}
	if (bitmap.width * bitmap.height > MAX_PIXELS) {
		bitmap.close();
		throw new Error("That image is over 60 megapixels. Please scale it down first.");
	}
	return {
		blob,
		name,
		type: blob.type || "image/png",
		size: blob.size,
		width: bitmap.width,
		height: bitmap.height,
		hasAlpha: blob.type === "image/jpeg" ? false : detectAlpha(bitmap),
		bitmap,
	};
}

/** Cheap transparency check on a thumbnail. */
function detectAlpha(bitmap: ImageBitmap): boolean {
	const k = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
	const w = Math.max(1, Math.round(bitmap.width * k));
	const h = Math.max(1, Math.round(bitmap.height * k));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return false;
	ctx.drawImage(bitmap, 0, 0, w, h);
	const data = ctx.getImageData(0, 0, w, h).data;
	for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
	return false;
}
