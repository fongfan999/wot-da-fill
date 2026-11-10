import { makeZip, predictLength } from "client-zip";
import type { CustomFont, Field, OutputSettings, Table, TemplateImage } from "../types";
import { codecFor, EXTENSION, MIME, type CodecSettings } from "./codec";
import { ensureFont, registerCustomFont } from "./fonts";
import { EncoderPool } from "./pool";
import { outputSize, renderCard } from "./render";
import { applyCase, buildFilenames, fillTemplate } from "./text";

export interface GeneratedFile {
	name: string;
	blob: Blob;
	row: number;
}

export type Phase = "fonts" | "render" | "zip" | "done";

export interface Progress {
	phase: Phase;
	done: number;
	total: number;
	bytes: number;
	startedAt: number;
	zipWritten?: number;
	zipTotal?: number;
}

export interface GenerateResult {
	files: GeneratedFile[];
	zip: Blob;
	zipName: string;
	totalBytes: number;
	elapsedMs: number;
	width: number;
	height: number;
	failed: { row: number; error: string }[];
}

export interface Job {
	template: TemplateImage;
	fields: Field[];
	customFonts: CustomFont[];
	table: Table;
	output: OutputSettings;
	signal: AbortSignal;
	onProgress(p: Progress): void;
}

export function textsForRow(fields: Field[], table: Table | null, index: number): string[] {
	const row = table?.rows[index] ?? null;
	return fields.map((f) => applyCase(fillTemplate(f.text, row, table?.columns ?? [], index + 1), f.textCase));
}

/** Download every font face needed by any row before drawing a single card. */
export async function prepareFonts(fields: Field[], customFonts: CustomFont[], table: Table | null) {
	await Promise.all(customFonts.map(registerCustomFont));
	const rows = table?.rows.length ? table.rows.length : 1;
	await Promise.all(
		fields.map((f) => {
			let all = "";
			for (let r = 0; r < rows; r++) all += textsForRow([f], table, r)[0];
			return ensureFont(f.font, all + "H");
		}),
	);
}

function createCanvas(width: number, height: number) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: true });
	if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
	return { canvas, ctx };
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/** Native browser encoder, used only if a WASM encode fails for some reason. */
function nativeEncode(canvas: HTMLCanvasElement, format: OutputSettings["format"], quality: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), MIME[format], quality / 100),
	);
}

function codecQuality(c: CodecSettings): number {
	return c.format === "png" ? 100 : c.quality;
}

export async function generateAll(job: Job): Promise<GenerateResult> {
	const { template, fields, table, output, signal } = job;
	const startedAt = performance.now();
	const total = table.rows.length;
	const progress: Progress = { phase: "fonts", done: 0, total, bytes: 0, startedAt };
	let lastEmit = 0;
	const emit = (force = false) => {
		const now = performance.now();
		if (!force && now - lastEmit < 60) return;
		lastEmit = now;
		job.onProgress({ ...progress });
	};
	emit(true);

	await prepareFonts(fields, job.customFonts, table);
	signal.throwIfAborted();

	const { width, height } = outputSize(template.width, template.height, output.maxEdge);
	const codec = codecFor(output.format, output.compression);
	const ext = EXTENSION[output.format];
	const names = buildFilenames(output.filenamePattern, table.rows, table.columns, ext, output.asciiFilenames);
	const background = output.format === "jpeg" && template.hasAlpha ? output.background : null;
	const runId = Math.random().toString(36).slice(2);

	const { ctx } = createCanvas(width, height);
	const cardInput = (i: number) => ({
		image: template.bitmap,
		width: template.width,
		height: template.height,
		fields,
		texts: textsForRow(fields, table, i),
		background,
	});
	const pool = new EncoderPool();
	const abort = () => pool.close();
	signal.addEventListener("abort", abort, { once: true });

	const results: (GeneratedFile | undefined)[] = new Array(total);
	const failed: { row: number; error: string }[] = [];
	const inflight = new Set<Promise<void>>();
	progress.phase = "render";
	emit(true);

	try {
		for (let i = 0; i < total; i++) {
			signal.throwIfAborted();
			// Back-pressure: keep every worker busy plus one card ready, never more.
			while (pool.load > pool.size) await Promise.race(inflight);

			renderCard(ctx, cardInput(i));
			const pixels = ctx.getImageData(0, 0, width, height);

			const task = pool
				.encode(runId, pixels, codec)
				.then((buf) => new Blob([buf], { type: MIME[output.format] }))
				.catch(async (err: Error) => {
					if (signal.aborted) throw err;
					// Rare: re-render this card on its own canvas and use the browser's encoder.
					console.warn(`Row ${i + 1}: WASM encode failed, using browser encoder`, err);
					const spare = createCanvas(width, height);
					renderCard(spare.ctx, cardInput(i));
					return nativeEncode(spare.canvas, output.format, codecQuality(codec));
				})
				.then((blob) => {
					results[i] = { name: names[i], blob, row: i };
					progress.done++;
					progress.bytes += blob.size;
					emit();
				})
				.catch((err: Error) => {
					if (!signal.aborted) failed.push({ row: i, error: err.message });
				});
			inflight.add(task);
			void task.finally(() => inflight.delete(task));
			await nextFrame();
		}
		await Promise.all(inflight);
	} finally {
		signal.removeEventListener("abort", abort);
		pool.close();
	}
	signal.throwIfAborted();

	const files = results.filter((f): f is GeneratedFile => !!f);
	const manifest = new Blob([manifestCsv(files, table)], { type: "text/csv" });
	const entries = [
		...files.map((f) => ({ name: f.name, input: f.blob, lastModified: new Date() })),
		{ name: "_manifest.csv", input: manifest, lastModified: new Date() },
	];

	progress.phase = "zip";
	progress.zipWritten = 0;
	progress.zipTotal = Number(predictLength(entries.map((e) => ({ name: e.name, size: e.input.size }))));
	emit(true);
	const counter = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, ctrl) {
			progress.zipWritten! += chunk.byteLength;
			emit();
			ctrl.enqueue(chunk);
		},
	});
	const zip = await new Response(makeZip(entries).pipeThrough(counter)).blob();
	signal.throwIfAborted();

	progress.phase = "done";
	emit(true);
	const base = template.name.replace(/\.[^.]+$/, "") || "cards";
	return {
		files,
		zip: new Blob([zip], { type: "application/zip" }),
		zipName: `${base}-${files.length}-cards.zip`,
		totalBytes: progress.bytes,
		elapsedMs: performance.now() - startedAt,
		width,
		height,
		failed,
	};
}

function csvCell(v: string): string {
	return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** File ↔ row mapping, handy for mail merges. BOM so Excel opens Vietnamese text correctly. */
function manifestCsv(files: GeneratedFile[], table: Table): string {
	const header = ["file", ...table.columns].map(csvCell).join(",");
	const lines = files.map((f) => [f.name, ...table.columns.map((c) => table.rows[f.row][c] ?? "")].map(csvCell).join(","));
	return "﻿" + [header, ...lines].join("\r\n");
}

/** Encodes one card with the real pipeline to estimate size/quality before a full run. */
export async function encodeOne(
	template: TemplateImage,
	fields: Field[],
	customFonts: CustomFont[],
	table: Table | null,
	rowIndex: number,
	output: OutputSettings,
): Promise<Blob> {
	await prepareFonts(fields, customFonts, table);
	const { width, height } = outputSize(template.width, template.height, output.maxEdge);
	const { ctx } = createCanvas(width, height);
	renderCard(ctx, {
		image: template.bitmap,
		width: template.width,
		height: template.height,
		fields,
		texts: textsForRow(fields, table, rowIndex),
		background: output.format === "jpeg" && template.hasAlpha ? output.background : null,
	});
	const pool = new EncoderPool(1);
	try {
		const codec = codecFor(output.format, output.compression);
		const buf = await pool.encode("test", ctx.getImageData(0, 0, width, height), codec);
		return new Blob([buf], { type: MIME[output.format] });
	} finally {
		pool.close();
	}
}
