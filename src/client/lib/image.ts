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
		bitmap,
	};
}
