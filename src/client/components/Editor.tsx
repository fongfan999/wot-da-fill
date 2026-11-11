import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampBox } from "../lib/fields";
import { ensureFont } from "../lib/fonts";
import { useT } from "../lib/i18n";
import { renderCard } from "../lib/render";
import { Icon } from "./ui";
import type { Box, Field, TemplateImage } from "../types";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

interface Drag {
	mode: "move" | "resize" | "draw";
	handle?: Handle;
	id?: string;
	startX: number;
	startY: number;
	startBox: Box;
	moved: boolean;
	/** Started by a finger, which needs to travel further than a mouse before it counts as drawing a box. */
	touch: boolean;
}

export interface EditorProps {
	image: TemplateImage;
	fields: Field[];
	texts: string[];
	selectedId: string | null;
	showGuides: boolean;
	/** Short name for each box's tag, same order as fields. */
	labels: string[];
	/** Boxes the full check found too long for the name on show (shrunk far below the rest). */
	flagged: Set<string>;
	onSelect(id: string | null): void;
	/** A box was clicked (pressed and released without dragging). */
	onOpen(id: string): void;
	onChangeBox(id: string, box: Box): void;
	onCreate(box: Box): void;
	/** Shown beside the mouse over empty parts of the design, to teach that dragging there adds a box. Null hides it. */
	drawHint: string | null;
}

const SNAP_PX = 6;

export function Editor({
	image,
	fields,
	texts,
	selectedId,
	showGuides,
	labels,
	flagged,
	onSelect,
	onOpen,
	onChangeBox,
	onCreate,
	drawHint,
}: EditorProps) {
	const t = useT();
	const stageRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);
	const hintRef = useRef<HTMLDivElement>(null);
	const [stage, setStage] = useState({ w: 0, h: 0 });
	const [fontTick, setFontTick] = useState(0);
	const [overflow, setOverflow] = useState<Set<string>>(new Set());
	const [draft, setDraft] = useState<Box | null>(null);
	const [guides, setGuides] = useState({ v: false, h: false });
	const drag = useRef<Drag | null>(null);

	useLayoutEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const ro = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			setStage({ w: Math.floor(width), h: Math.floor(height) });
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Fit the design inside the stage.
	const view = useMemo(() => {
		if (!stage.w || !stage.h) return null;
		const k = Math.min(stage.w / image.width, stage.h / image.height);
		return { w: Math.max(1, Math.floor(image.width * k)), h: Math.max(1, Math.floor(image.height * k)), k };
	}, [stage, image.width, image.height]);

	const dpr = Math.min(2, window.devicePixelRatio || 1);

	// Pre-scaled copy of the design so dragging only redraws text, not a 20-megapixel image.
	const background = useMemo(() => {
		if (!view) return null;
		const c = document.createElement("canvas");
		c.width = Math.round(view.w * dpr);
		c.height = Math.round(view.h * dpr);
		const ctx = c.getContext("2d");
		if (!ctx) return null;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(image.bitmap, 0, 0, c.width, c.height);
		return c;
	}, [image, view, dpr]);

	// Make sure every glyph in the preview text is downloaded, then redraw.
	useEffect(() => {
		let alive = true;
		Promise.allSettled(fields.map((f, i) => ensureFont(f.font, (texts[i] ?? "") + "H"))).then(() => {
			if (alive) setFontTick((t) => t + 1);
		});
		return () => {
			alive = false;
		};
	}, [fields, texts]);

	useEffect(() => {
		const onDone = () => setFontTick((t) => t + 1);
		document.fonts.addEventListener("loadingdone", onDone);
		return () => document.fonts.removeEventListener("loadingdone", onDone);
	}, []);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !view || !background) return;
		canvas.width = background.width;
		canvas.height = background.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const layouts = renderCard(ctx, { image: background, width: image.width, height: image.height, fields, texts });
		const next = new Set(fields.filter((_, i) => layouts[i]?.overflow).map((f) => f.id));
		setOverflow((prev) => (sameSet(prev, next) ? prev : next));
	}, [background, fields, texts, view, image.width, image.height, fontTick]);

	if (!view) return <div className="editor" ref={stageRef} />;

	const toImage = (dx: number, dy: number) => ({ x: dx / view.k, y: dy / view.k });
	const pct = (b: Box) => ({
		left: `${(b.x / image.width) * 100}%`,
		top: `${(b.y / image.height) * 100}%`,
		width: `${(b.w / image.width) * 100}%`,
		height: `${(b.h / image.height) * 100}%`,
	});

	// The hint follows the mouse by direct style changes, so moving the mouse never re-renders the editor.
	const moveHint = (e: ReactPointerEvent | null) => {
		const hint = hintRef.current;
		const overlay = overlayRef.current;
		if (!hint || !overlay) return;
		const show = !!e && e.pointerType === "mouse" && e.target === overlay && !drag.current;
		hint.toggleAttribute("data-show", show);
		if (!show) return;
		const r = overlay.getBoundingClientRect();
		const x = e.clientX - r.left;
		const y = e.clientY - r.top;
		// Keep it inside the design: flip to the left of the mouse near the right edge, above it near the bottom.
		const left = x + 14 + hint.offsetWidth > r.width ? x - 10 - hint.offsetWidth : x + 14;
		const top = y + 18 + hint.offsetHeight > r.height ? y - 10 - hint.offsetHeight : y + 18;
		hint.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
	};

	const begin = (e: ReactPointerEvent, d: Omit<Drag, "startX" | "startY" | "moved" | "touch">) => {
		if (e.button !== 0) return;
		moveHint(null);
		e.stopPropagation();
		e.preventDefault();
		// preventDefault stops the browser moving focus, so do it ourselves: otherwise arrow/delete
		// keys would keep editing whatever text box was focused before (e.g. the pasted list).
		overlayRef.current?.focus({ preventScroll: true });
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag.current = { ...d, startX: e.clientX, startY: e.clientY, moved: false, touch: e.pointerType === "touch" };
	};

	const overlayRect = () => overlayRef.current!.getBoundingClientRect();

	const onPointerDownEmpty = (e: ReactPointerEvent) => {
		const r = overlayRect();
		const p = toImage(e.clientX - r.left, e.clientY - r.top);
		begin(e, { mode: "draw", startBox: { x: p.x, y: p.y, w: 0, h: 0 } });
	};

	const onPointerMove = (e: ReactPointerEvent) => {
		const d = drag.current;
		if (!d) return moveHint(e);
		const dxPx = e.clientX - d.startX;
		const dyPx = e.clientY - d.startY;
		if (!d.moved && Math.hypot(dxPx, dyPx) < 3) return;
		d.moved = true;
		const { x: dx, y: dy } = toImage(dxPx, dyPx);
		const b = d.startBox;

		if (d.mode === "draw") {
			setDraft(normalize({ x: b.x, y: b.y, w: dx, h: dy }, image.width, image.height));
			return;
		}
		if (d.mode === "move" && d.id) {
			let x = b.x + dx;
			let y = b.y + dy;
			const snap = SNAP_PX / view.k;
			const v = !e.altKey && Math.abs(x + b.w / 2 - image.width / 2) < snap;
			const h = !e.altKey && Math.abs(y + b.h / 2 - image.height / 2) < snap;
			if (v) x = image.width / 2 - b.w / 2;
			if (h) y = image.height / 2 - b.h / 2;
			setGuides({ v, h });
			onChangeBox(d.id, clampBox({ ...b, x, y }, image.width, image.height));
			return;
		}
		if (d.mode === "resize" && d.id && d.handle) {
			// Alt/Option resizes symmetrically around the center, handy for centered names.
			const k = e.altKey ? 2 : 1;
			let { x, y, w, h } = b;
			if (d.handle.includes("e")) {
				w = b.w + dx * k;
				if (e.altKey) x = b.x - dx;
			}
			if (d.handle.includes("w")) {
				w = b.w - dx * k;
				x = b.x + dx;
			}
			if (d.handle.includes("s")) {
				h = b.h + dy * k;
				if (e.altKey) y = b.y - dy;
			}
			if (d.handle.includes("n")) {
				h = b.h - dy * k;
				y = b.y + dy;
			}
			onChangeBox(d.id, clampBox(normalize({ x, y, w, h }, image.width, image.height), image.width, image.height));
		}
	};

	const onPointerUp = () => {
		const d = drag.current;
		drag.current = null;
		setGuides({ v: false, h: false });
		if (!d) return;
		if (d.mode === "move" && d.id && !d.moved) onOpen(d.id);
		if (d.mode === "draw") {
			setDraft(null);
			const least = d.touch ? 24 : 8;
			if (draft && draft.w * view.k > least && draft.h * view.k > least) onCreate(clampBox(draft, image.width, image.height));
			else onSelect(null);
		}
	};

	return (
		<div className="editor" ref={stageRef}>
			<div className="canvas-wrap" style={{ width: view.w, height: view.h }}>
				<canvas ref={canvasRef} style={{ width: view.w, height: view.h }} aria-label={t.cardPreview} role="img" />
				{/* Move/up handlers live here only: captured pointer events bubble up from boxes and handles. */}
				<div
					ref={overlayRef}
					tabIndex={0}
					role="application"
					aria-label={t.editorLabel}
					className="overlay"
					onPointerDown={onPointerDownEmpty}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onPointerLeave={() => moveHint(null)}
				>
					{fields.map((f, i) => {
						const selected = f.id === selectedId;
						const tooLong = overflow.has(f.id) || flagged.has(f.id);
						return (
							<div
								key={f.id}
								className={`wf-box${selected ? " wf-box-selected" : ""}${tooLong ? " wf-box-overflow" : ""}${showGuides ? "" : " wf-box-hidden"}`}
								style={pct(f.box)}
								onPointerDown={(e) => {
									onSelect(f.id);
									begin(e, { mode: "move", id: f.id, startBox: f.box });
								}}
							>
								{/* Only on screen, never on the cards: an empty box would otherwise show nothing at all. */}
								{!f.text.trim() && <span className="wf-box-empty">{t.emptyBox}</span>}
								{/* The number always shows; what the box says joins it when the box is selected, pointed at or too long. */}
								<span className="wf-box-tag">
									{i + 1}
									<span className="wf-box-tag-rest">
										{labels[i].slice(String(i + 1).length)}
										{tooLong ? ` · ${t.tooLongTag}` : ""}
									</span>
								</span>
								{selected &&
									HANDLES.map((hd) => (
										<span
											key={hd}
											className={`wf-handle h-${hd}`}
											onPointerDown={(e) => begin(e, { mode: "resize", handle: hd, id: f.id, startBox: f.box })}
										/>
									))}
							</div>
						);
					})}
					{draft && <div className="wf-box wf-box-drafting" style={pct(draft)} />}
					{guides.v && <div className="wf-guide wf-guide-v" />}
					{guides.h && <div className="wf-guide wf-guide-h" />}
					{drawHint && (
						<div ref={hintRef} className="wf-draw-hint" aria-hidden="true">
							<Icon name="plus" size={16} />
							{drawHint}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function normalize(b: Box, width: number, height: number): Box {
	let { x, y, w, h } = b;
	if (w < 0) {
		x += w;
		w = -w;
	}
	if (h < 0) {
		y += h;
		h = -h;
	}
	if (x < 0) {
		w += x;
		x = 0;
	}
	if (y < 0) {
		h += y;
		y = 0;
	}
	w = Math.max(0, w);
	h = Math.max(0, h);
	return { x, y, w: Math.min(w, width - x), h: Math.min(h, height - y) };
}

function sameSet(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
}
