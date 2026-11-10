import type { CodecSettings } from "./codec";
import type { EncodeRequest, EncodeResponse } from "./encoder.worker";

interface Pending {
	resolve(buffer: ArrayBuffer): void;
	reject(err: Error): void;
}

interface Slot {
	worker: Worker;
	/** Id of the job this worker is running, if any. */
	job: number | null;
	dead: boolean;
}

/** Fixed-size pool of WASM encoder workers. Pixels are transferred, never copied. */
export class EncoderPool {
	readonly size: number;
	private slots: Slot[] = [];
	private queue: EncodeRequest[] = [];
	private pending = new Map<number, Pending>();
	private nextId = 1;
	private closed = false;

	constructor(size = defaultPoolSize()) {
		this.size = size;
		for (let i = 0; i < size; i++) {
			const worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), { type: "module" });
			const slot: Slot = { worker, job: null, dead: false };
			worker.onmessage = (e: MessageEvent<EncodeResponse>) => this.settle(slot, e.data);
			// Uncaught errors (failed module load, out of memory) kill the worker. Fail only its own job
			// and keep using the others; if none are left, reject everything so callers can fall back.
			worker.onerror = (e) => {
				e.preventDefault();
				this.retire(slot, new Error(e.message || "Encoder worker crashed"));
			};
			this.slots.push(slot);
		}
	}

	encode(runId: string, pixels: ImageData, codec: CodecSettings): Promise<ArrayBuffer> {
		if (this.closed) return Promise.reject(new Error("Encoder pool closed"));
		if (this.slots.every((s) => s.dead)) return Promise.reject(new Error("No encoder workers available"));
		const id = this.nextId++;
		const buffer = pixels.data.buffer as ArrayBuffer;
		const req: EncodeRequest = { id, runId, width: pixels.width, height: pixels.height, pixels: buffer, codec };
		return new Promise<ArrayBuffer>((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.queue.push(req);
			this.pump();
		});
	}

	/** Jobs queued or running. */
	get load(): number {
		return this.pending.size;
	}

	close() {
		this.closed = true;
		for (const s of this.slots) s.worker.terminate();
		this.rejectAll(new Error("Cancelled"));
	}

	private pump() {
		for (const slot of this.slots) {
			if (slot.dead || slot.job !== null) continue;
			const req = this.queue.shift();
			if (!req) return;
			slot.job = req.id;
			slot.worker.postMessage(req, [req.pixels]);
		}
	}

	private settle(slot: Slot, res: EncodeResponse) {
		slot.job = null;
		const p = this.pending.get(res.id);
		this.pending.delete(res.id);
		if (p) {
			if (res.ok) p.resolve(res.buffer);
			else p.reject(new Error(res.error));
		}
		this.pump();
	}

	private retire(slot: Slot, err: Error) {
		slot.dead = true;
		slot.worker.terminate();
		if (slot.job !== null) {
			this.pending.get(slot.job)?.reject(err);
			this.pending.delete(slot.job);
			slot.job = null;
		}
		if (this.slots.every((s) => s.dead)) this.rejectAll(err);
		else this.pump();
	}

	private rejectAll(err: Error) {
		for (const p of this.pending.values()) p.reject(err);
		this.pending.clear();
		this.queue = [];
	}
}

export function defaultPoolSize(): number {
	const cores = navigator.hardwareConcurrency || 4;
	// Each worker holds a WASM heap sized to the largest image; stay modest on memory.
	const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
	return Math.max(1, Math.min(cores - 1, memoryGb <= 4 ? 2 : 6));
}
