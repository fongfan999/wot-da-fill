import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataPanel } from "./components/DataPanel";
import { Editor } from "./components/Editor";
import { FieldPanel, fieldLabel } from "./components/FieldPanel";
import { GenerateDialog } from "./components/GenerateDialog";
import { HomePage } from "./components/HomePage";
import { ShareDialog } from "./components/ShareDialog";
import {
	Button,
	FileDrop,
	Icon,
	IconButton,
	MadeBy,
	Menu,
	Notice,
	ProductMark,
	Section,
	Steps,
	Toast,
	type StepState,
	type ToastMessage,
} from "./components/ui";
import { buildTable, guessHasHeader, parseDelimited, sampleSource, type Delimiter } from "./lib/data";
import { clampBox, newField } from "./lib/fields";
import { findTooLong, type TooLong } from "./lib/fit";
import { addCustomFont, DEFAULT_FONT, ensureFont } from "./lib/fonts";
import { textsForRow } from "./lib/generate";
import { loadTemplateImage } from "./lib/image";
import { getSampleTemplate } from "./lib/showcase";
import { loadSharedTemplate, shareTemplate } from "./lib/share";
import { formatBytes, matchColumn, placeholdersIn, ROW_NUMBER, unknownPlaceholders } from "./lib/text";
import { useUndoable } from "./lib/useUndoable";
import type { Box, CustomFont, DataSource, Field, TemplateImage } from "./types";

const SHARE_PATH = /^\/t\/([A-Za-z0-9]{16})\/?$/;
const IMAGES = "image/jpeg,image/png,image/webp";

type Step = "design" | "names" | "text";
const STEPS: { id: Step; label: string }[] = [
	{ id: "design", label: "Design" },
	{ id: "names", label: "Names" },
	{ id: "text", label: "Text" },
];

const count = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

export function App() {
	const [image, setImage] = useState<TemplateImage | null>(null);
	const { value: fields, change: changeFields, reset: resetFields, undo, redo, canUndo, canRedo } = useUndoable<Field[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
	const [source, setSource] = useState<DataSource | null>(null);
	const [paste, setPaste] = useState("");
	const [delimiter, setDelimiter] = useState<Delimiter>("auto");
	const [previewRow, setPreviewRow] = useState(0);
	const [showBoxes, setShowBoxes] = useState(true);
	const [expectedColumns, setExpectedColumns] = useState<string[]>([]);
	const [step, setStep] = useState<Step>("design");
	const [busy, setBusy] = useState<string | null>(null);
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const [generating, setGenerating] = useState(false);
	const [sharing, setSharing] = useState(false);
	const [tooLong, setTooLong] = useState<TooLong[] | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const table = useMemo(() => (source ? buildTable(source.grid, source.hasHeader) : null), [source]);
	const columns = table?.columns ?? [];
	const rowCount = table?.rows.length ?? 0;
	const previewIndex = Math.min(previewRow, Math.max(0, rowCount - 1));
	const texts = useMemo(() => textsForRow(fields, table, previewIndex), [fields, table, previewIndex]);
	const selected = fields.find((f) => f.id === selectedId) ?? null;
	const labels = fields.map(fieldLabel);

	// Undo can remove the selected text box; drop the stale selection.
	useEffect(() => {
		if (selectedId && !selected) setSelectedId(null);
	}, [selectedId, selected]);

	// The Text step always edits something when there is something to edit.
	useEffect(() => {
		if (step === "text" && !selected && fields.length) setSelectedId(fields[0].id);
	}, [step, selected, fields]);

	/** One message at a time. Errors stay until dismissed; the rest go after a few seconds. */
	const say = useCallback((text: string, kind: "info" | "error" = "info", action?: ToastMessage["action"], ms = 4000) => {
		clearTimeout(toastTimer.current);
		setToast({ id: Date.now(), kind, text, action });
		if (kind !== "error") toastTimer.current = setTimeout(() => setToast(null), ms);
	}, []);

	// Open a shared layout from /t/<id>.
	useEffect(() => {
		const id = location.pathname.match(SHARE_PATH)?.[1];
		if (!id) return;
		let cancelled = false;
		setBusy("Opening the shared layout…");
		loadSharedTemplate(id)
			.then((t) => {
				if (cancelled) return;
				setImage(t.image);
				resetFields(t.fields);
				setCustomFonts(t.customFonts);
				setExpectedColumns(t.columns);
				setSelectedId(t.fields[0]?.id ?? null);
				setStep("names");
			})
			.catch((err: Error) => {
				if (cancelled) return;
				say(err.message, "error");
				history.replaceState(null, "", "/");
			})
			.finally(() => !cancelled && setBusy(null));
		return () => {
			cancelled = true;
		};
	}, [say, resetFields]);

	// Check every name against its box whenever the names or the text change.
	useEffect(() => {
		// The last result stays up while the next check runs, so tags and notices don't flicker during a drag.
		if (!table || !rowCount || !fields.length) return setTooLong(null);
		const ac = new AbortController();
		const t = setTimeout(() => {
			findTooLong(fields, customFonts, table, ac.signal)
				.then((rows) => !ac.signal.aborted && setTooLong(rows))
				.catch(() => {});
		}, 400);
		return () => {
			clearTimeout(t);
			ac.abort();
		};
	}, [fields, customFonts, table, rowCount]);

	const updateField = useCallback(
		(next: Field) => {
			changeFields((fs) => fs.map((f) => (f.id === next.id ? next : f)), mergeKeyFor(fields.find((f) => f.id === next.id), next));
		},
		[changeFields, fields],
	);

	// Surface font problems (e.g. a weight the family doesn't have) as soon as a box changes font.
	const fontKey = fields.map((f) => `${f.font.source}|${f.font.family}|${f.font.weight}|${f.font.italic}`).join(";");
	useEffect(() => {
		fields.forEach((f) => ensureFont(f.font, "Aa").catch((err: Error) => say(err.message, "error")));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fontKey]);

	const applySource = useCallback(
		(next: DataSource | null) => {
			setSource(next);
			setPreviewRow(0);
			if (!next) return;
			const cols = buildTable(next.grid, next.hasHeader).columns;
			if (!cols.length) return;
			// A box that holds only one piece the new list doesn't have points at the list's first column instead.
			changeFields((fs) => {
				let changed = false;
				const updated = fs.map((f) => {
					const ph = placeholdersIn(f.text).filter((p) => p !== ROW_NUMBER);
					const lone = ph.length === 1 && f.text.trim() === `{${ph[0]}}`;
					if (!lone || matchColumn(ph[0], cols)) return f;
					changed = true;
					return { ...f, text: `{${cols[0]}}` };
				});
				return changed ? updated : fs;
			});
		},
		[changeFields],
	);

	// Read pasted names as they're typed. This lives here, not in the Names panel, so opening the
	// panel again doesn't re-read the list and jump back to the first name.
	const parsedFrom = useRef<{ text: string; delimiter: Delimiter } | null>(null);
	useEffect(() => {
		if (source && source.kind !== "paste") return;
		if (source && parsedFrom.current?.text === paste && parsedFrom.current.delimiter === delimiter) return;
		const t = setTimeout(() => {
			if (!paste.trim()) {
				if (source?.kind === "paste") applySource(null);
				return;
			}
			const grid = parseDelimited(paste, delimiter);
			const hasHeader = source?.kind === "paste" ? source.hasHeader : guessHasHeader(grid, "paste");
			parsedFrom.current = { text: paste, delimiter };
			applySource({ kind: "paste", name: "what you pasted", grid, hasHeader });
		}, 200);
		return () => clearTimeout(t);
		// Only new text or a new way of splitting it means reading it again.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paste, delimiter]);

	const firstColumnText = `{${columns[0] ?? "Name"}}`;
	const styleFrom = selected ?? fields.at(-1);

	const makeField = (box: Box, text = firstColumnText) => {
		const f = newField(box, text, styleFrom?.font ?? DEFAULT_FONT);
		if (styleFrom) {
			f.color = styleFrom.color;
			f.align = styleFrom.align;
		}
		return f;
	};

	const centredBox = (img: TemplateImage): Box => {
		const w = Math.round(img.width * 0.6);
		const h = Math.round(img.height * 0.1);
		return { x: (img.width - w) / 2, y: (img.height - h) / 2, w, h };
	};

	const createField = (box: Box) => {
		const f = makeField(box);
		changeFields((fs) => [...fs, f]);
		setSelectedId(f.id);
		setStep("text");
	};

	const openImage = async (file: File) => {
		if (!file.type.startsWith("image/")) return say("That file is not a picture. Use a JPG, PNG or WebP.", "error");
		setBusy("Opening your design…");
		try {
			const next = await loadTemplateImage(file, file.name);
			if (image && fields.length) {
				// Replacing the design keeps the layout, scaled to the new size. The old layout can't be undone onto the new design.
				if (image.width !== next.width || image.height !== next.height) {
					const kx = next.width / image.width;
					const ky = next.height / image.height;
					resetFields(
						fields.map((f) => ({
							...f,
							box: clampBox({ x: f.box.x * kx, y: f.box.y * ky, w: f.box.w * kx, h: f.box.h * ky }, next.width, next.height),
							fontSize: Math.round(f.fontSize * kx),
						})),
					);
				}
			} else {
				// Nobody should have to discover dragging: the first box is placed for them.
				const f = newField(centredBox(next), firstColumnText);
				resetFields([f]);
				setSelectedId(f.id);
				setStep(rowCount ? "text" : "names");
			}
			setImage(next);
			if (location.pathname !== "/") history.replaceState(null, "", "/");
		} catch (err) {
			say(err instanceof Error ? err.message : "Couldn't open that picture.", "error");
		} finally {
			setBusy(null);
		}
	};

	const trySample = async () => {
		setBusy("Drawing an example invitation…");
		try {
			const sample = await getSampleTemplate();
			// The drawing is shared with the home page; the boxes are copied so edits never reach it.
			const sampleFields = sample.fields.map((f) => ({ ...f, box: { ...f.box }, font: { ...f.font } }));
			setImage(await loadTemplateImage(sample.blob, "example-invitation.png"));
			resetFields(sampleFields);
			setSelectedId(sampleFields[0].id);
			if (!source) applySource(sampleSource());
			setStep("text");
		} catch (err) {
			say(err instanceof Error ? err.message : "Couldn't draw the example.", "error");
		} finally {
			setBusy(null);
		}
	};

	const addText = () => {
		if (image) createField(centredBox(image));
	};

	const duplicateField = (f: Field) => {
		if (!image) return;
		const copy: Field = { ...f, id: newField(f.box, f.text).id, box: clampBox({ ...f.box, y: f.box.y + f.box.h + 10 }, image.width, image.height) };
		changeFields((fs) => [...fs, copy]);
		setSelectedId(copy.id);
	};

	const deleteField = useCallback(
		(f: Field) => {
			let index = -1;
			changeFields((fs) => {
				index = fs.findIndex((x) => x.id === f.id);
				return fs.filter((x) => x.id !== f.id);
			});
			setSelectedId(null);
			// Undo puts this box back where it was, even if other changes came after.
			const restore = () => {
				changeFields((fs) => (fs.some((x) => x.id === f.id) ? fs : [...fs.slice(0, Math.max(0, index)), f, ...fs.slice(Math.max(0, index))]));
				setSelectedId(f.id);
				setToast(null);
			};
			say("Text box removed.", "info", { label: "Undo", onClick: restore });
		},
		[changeFields, say],
	);

	const uploadFont = async (file: File) => {
		try {
			const font = await addCustomFont(file, customFonts);
			setCustomFonts((fs) => [...fs, font]);
			say(`Added your font “${font.family}”.`);
			return font;
		} catch (err) {
			say(err instanceof Error ? err.message : "Couldn't read that font.", "error");
			return null;
		}
	};

	// Keyboard: undo/redo anywhere; nudge, remove and deselect the selected box when the design has focus.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement;
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === "z" || key === "y")) {
				// Text inputs keep their own undo.
				if (t.closest("input, textarea, select, [contenteditable], dialog")) return;
				e.preventDefault();
				if (key === "y" || e.shiftKey) redo();
				else undo();
				return;
			}
			if (t !== document.body && !t.closest(".overlay")) return;
			if (!selected || !image) return;
			const stepPx = e.shiftKey ? 10 : 1;
			const moves: Record<string, [number, number]> = {
				ArrowLeft: [-stepPx, 0],
				ArrowRight: [stepPx, 0],
				ArrowUp: [0, -stepPx],
				ArrowDown: [0, stepPx],
			};
			if (moves[e.key]) {
				e.preventDefault();
				const [dx, dy] = moves[e.key];
				updateField({ ...selected, box: clampBox({ ...selected.box, x: selected.box.x + dx, y: selected.box.y + dy }, image.width, image.height) });
			} else if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				deleteField(selected);
			} else if (e.key === "Escape") {
				setSelectedId(null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selected, image, updateField, deleteField, undo, redo]);

	/** Clears everything at once and offers Undo instead of asking first. */
	const startOver = () => {
		const snapshot = { image, fields, customFonts, source, paste, expectedColumns, step, selectedId };
		setImage(null);
		resetFields([]);
		setSelectedId(null);
		setSource(null);
		setPaste("");
		setExpectedColumns([]);
		setStep("design");
		history.replaceState(null, "", "/");
		say(
			"Everything cleared.",
			"info",
			{
				label: "Undo",
				onClick: () => {
					setImage(snapshot.image);
					resetFields(snapshot.fields);
					setCustomFonts(snapshot.customFonts);
					setSource(snapshot.source);
					setPaste(snapshot.paste);
					setExpectedColumns(snapshot.expectedColumns);
					setStep(snapshot.step);
					setSelectedId(snapshot.selectedId);
					setToast(null);
				},
			},
			8000,
		);
	};

	/** Steps the design through the names that don't fit, starting after the one on show. */
	const showNextTooLong = () => {
		if (!tooLong?.length) return;
		setPreviewRow((tooLong.find((r) => r.row > previewIndex) ?? tooLong[0]).row);
	};

	// Pieces of text the list doesn't have print as nothing on every card.
	const missingColumns = columns.length ? [...new Set(fields.flatMap((f) => unknownPlaceholders(f.text, columns)))] : [];
	const showMissing = () => {
		const f = fields.find((x) => unknownPlaceholders(x.text, columns).length);
		if (f) setSelectedId(f.id);
		setStep("text");
	};
	const flagged = new Set(tooLong?.find((r) => r.row === previewIndex)?.fields ?? []);

	const missing = !image ? "Add your design first." : !rowCount ? "Add your names first." : !fields.length ? "Add a text box first." : null;
	const stepState = (id: Step): StepState => {
		if (id === step) return "current";
		const done = id === "design" ? !!image : id === "names" ? rowCount > 0 : fields.length > 0;
		return done ? "done" : "todo";
	};

	const boxWord = fields.length > 1 ? "their boxes" : "the box";
	const spills = tooLong?.some((r) => r.spill);
	const shrinks = tooLong?.some((r) => !r.spill);
	const fitNotice =
		rowCount > 0 && missingColumns.length ? (
			<Notice tone="warn" action={step === "text" && selected && unknownPlaceholders(selected.text, columns).length ? undefined : { label: "Show me", onClick: showMissing }}>
				Your list has no <b>{missingColumns.join(" or ")}</b>, so that part of every card will be blank.
			</Notice>
		) : rowCount > 0 && fields.length > 0 && tooLong ? (
			tooLong.length ? (
				<Notice tone="warn" action={{ label: "Show me", onClick: showNextTooLong }}>
					<b>{plural(tooLong.length, "name is", "names are")} too long</b> for {boxWord}.{" "}
					{spills && shrinks
						? "Some come out much smaller than the others, some spill over."
						: spills
							? `${tooLong.length === 1 ? "It spills" : "They spill"} over the edge.`
							: `${tooLong.length === 1 ? "It comes" : "They come"} out much smaller than the others.`}
				</Notice>
			) : (
				<Notice icon="check">
					All {plural(rowCount, "name fits", "names fit")} in {boxWord}.
				</Notice>
			)
		) : null;

	const primary =
		step === "design" ? (
			<Button variant="primary" size="lg" full iconRight="right" onClick={() => setStep("names")}>
				Next: Names
			</Button>
		) : step === "names" ? (
			<Button variant="primary" size="lg" full iconRight="right" disabled={!rowCount} onClick={() => setStep("text")}>
				Next: Text
			</Button>
		) : (
			<Button variant="primary" size="lg" full disabled={!!missing} onClick={() => setGenerating(true)}>
				{rowCount ? `Make ${plural(rowCount, "card", "cards")}` : "Make the cards"}
			</Button>
		);

	const hint = !fields.length ? (
		"Drag on the design to add a text box."
	) : step === "text" ? (
		<>
			<span className="fine-pointer">Drag the box to move it. Drag on an empty spot to add another. Arrow keys nudge it, Shift for 10px.</span>
			<span className="coarse-pointer">Drag the box to move it. Drag on an empty spot to add another.</span>
		</>
	) : (
		"Drag the box to where the name belongs. Pull its corners to resize it."
	);

	const toasts = (
		<div className="wf-toasts">
			{busy && <Toast toast={{ id: 0, kind: "busy", text: busy }} />}
			{toast && !busy && <Toast key={toast.id} toast={toast} onDismiss={() => setToast(null)} />}
		</div>
	);

	// No design yet: the home page, with no steps bar or side panel.
	if (!image)
		return (
			<>
				<HomePage onFile={openImage} onExample={trySample} />
				{toasts}
			</>
		);

	return (
		<div className="wf-app">
			<header className="wf-topbar">
				<ProductMark />
				<Steps
					steps={STEPS.map((s) => ({ label: s.label, state: stepState(s.id) }))}
					onSelect={(i) => setStep(STEPS[i].id)}
				/>
				<div className="wf-topbar-actions">
					{image && fields.length > 0 && (
						<Button variant="ghost" icon="share" onClick={() => setSharing(true)} title="Share this layout">
							Share
						</Button>
					)}
					{(image || source) && <Menu label="More" items={[{ label: "Start over", icon: "refresh", onClick: startOver }]} />}
				</div>
			</header>

			<main className="wf-work">
				<div className="wf-stage">
					<div className="wf-stage-bar">
						{rowCount > 0 ? (
							<div className="wf-switcher" role="group" aria-label="Which name to show">
								<IconButton icon="left" label="Previous name" disabled={previewIndex <= 0} onClick={() => setPreviewRow(previewIndex - 1)} />
								<span className="wf-switcher-label" aria-live="polite">
									<span className="wf-meta">
										{count(previewIndex + 1)} of {count(rowCount)}
									</span>
									<span className="wf-switcher-name">{texts.find((t) => t.trim()) || <i className="wf-muted">empty</i>}</span>
								</span>
								<IconButton
									icon="right"
									label="Next name"
									disabled={previewIndex >= rowCount - 1}
									onClick={() => setPreviewRow(previewIndex + 1)}
								/>
							</div>
						) : (
							<span className="wf-stage-label">Example name</span>
						)}
						<div className="wf-stage-tools">
							<IconButton icon="undo" label="Undo" title={`Undo (${MOD}Z)`} disabled={!canUndo} onClick={undo} />
							<IconButton icon="redo" label="Redo" title={`Redo (${MOD === "⌘" ? "⇧⌘Z" : "Ctrl+Y"})`} disabled={!canRedo} onClick={redo} />
							<span className="wf-sep" aria-hidden="true" />
							<IconButton
								icon={showBoxes ? "eye" : "eyeOff"}
								label={showBoxes ? "Hide the boxes" : "Show the boxes"}
								pressed={!showBoxes}
								onClick={() => setShowBoxes((s) => !s)}
							/>
						</div>
					</div>
					<Editor
						image={image}
						fields={fields}
						texts={texts}
						labels={labels}
						flagged={flagged}
						selectedId={selectedId}
						showGuides={showBoxes}
						onSelect={setSelectedId}
						onOpen={() => setStep("text")}
						onChangeBox={(id, box) => changeFields((fs) => fs.map((f) => (f.id === id ? { ...f, box } : f)), `${id}:box`)}
						onCreate={createField}
					/>
					<p className="wf-stage-hint">{hint}</p>
				</div>

				<aside className="wf-panel" aria-label={STEPS.find((s) => s.id === step)?.label}>
					<div className="wf-panel-body">
						{step === "design" && (
							<Section title="Design">
								<div className="wf-file">
									<Icon name="image" size={22} />
									<span>
										<b>{image.name}</b>
										<span className="wf-meta">
											{image.width} × {image.height} · {formatBytes(image.size)}
										</span>
									</span>
								</div>
								<FileDrop accept={IMAGES} onFile={openImage} label="Replace the design" className="wf-drop-compact">
									<Icon name="upload" size={22} />
									<span className="wf-drop-text">
										<span className="wf-drop-title">Use a different picture</span>
										<span className="wf-drop-hint">Your text boxes stay where they are.</span>
									</span>
								</FileDrop>
							</Section>
						)}
						{step === "names" && (
							<DataPanel
								source={source}
								table={table}
								previewRow={previewIndex}
								expectedColumns={expectedColumns}
								paste={paste}
								delimiter={delimiter}
								onPaste={setPaste}
								onDelimiter={setDelimiter}
								onSource={applySource}
								onPreviewRow={setPreviewRow}
								onError={(m) => say(m, "error")}
								onBusy={setBusy}
							/>
						)}
						{step === "text" && (
							<FieldPanel
								fields={fields}
								selected={selected}
								columns={columns}
								customFonts={customFonts}
								imageWidth={image.width}
								onSelect={setSelectedId}
								onChange={updateField}
								onAdd={addText}
								onDuplicate={duplicateField}
								onDelete={deleteField}
								onUploadFont={uploadFont}
							/>
						)}
					</div>
					<div className="wf-panel-foot">
						{step !== "design" && fitNotice}
						{primary}
						{step !== "design" && (step === "names" ? !rowCount : !!missing) && (
							<p className="wf-hint" style={{ textAlign: "center" }}>
								{step === "names" ? "Add your names first." : missing}
							</p>
						)}
						<MadeBy />
					</div>
				</aside>
			</main>

			{toasts}

			{generating && image && table && (
				<GenerateDialog params={{ template: image, fields, customFonts, table }} onClose={() => setGenerating(false)} />
			)}
			{sharing && image && (
				<ShareDialog
					onShare={async () => {
						const url = await shareTemplate(image, fields, customFonts, columns);
						history.replaceState(null, "", new URL(url).pathname);
						return url;
					}}
					onClose={() => setSharing(false)}
				/>
			)}
		</div>
	);
}

const MERGEABLE = new Set<keyof Field>(["text", "box", "color", "fontSize", "letterSpacing", "lineHeight"]);

/** One-property continuous edits (typing, colour drags, nudges) share a key so they undo as one step. */
function mergeKeyFor(prev: Field | undefined, next: Field): string | null {
	if (!prev) return null;
	const changed = (Object.keys(next) as (keyof Field)[]).filter((k) => prev[k] !== next[k]);
	return changed.length === 1 && MERGEABLE.has(changed[0]) ? `${next.id}:${changed[0]}` : null;
}

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
