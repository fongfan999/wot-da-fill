import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataPanel } from "./components/DataPanel";
import { Editor } from "./components/Editor";
import { FieldPanel } from "./components/FieldPanel";
import { GenerateDialog } from "./components/GenerateDialog";
import { ShareDialog } from "./components/ShareDialog";
import { FileDrop, Icon, Section, Toasts, type ToastMessage } from "./components/ui";
import { buildTable, sampleSource } from "./lib/data";
import { clampBox, newField } from "./lib/fields";
import { addCustomFont, DEFAULT_FONT, ensureFont } from "./lib/fonts";
import { textsForRow } from "./lib/generate";
import { loadTemplateImage } from "./lib/image";
import { createSampleTemplate } from "./lib/sample";
import { useUndoable } from "./lib/useUndoable";
import { loadSharedTemplate, shareTemplate } from "./lib/share";
import { formatBytes, matchColumn, placeholdersIn, ROW_NUMBER } from "./lib/text";
import type { Box, CustomFont, DataSource, Field, TemplateImage } from "./types";

const SHARE_PATH = /^\/t\/([A-Za-z0-9]{16})\/?$/;

export function App() {
	const [image, setImage] = useState<TemplateImage | null>(null);
	const { value: fields, change: changeFields, reset: resetFields, undo, redo, canUndo, canRedo } = useUndoable<Field[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
	const [source, setSource] = useState<DataSource | null>(null);
	const [previewRow, setPreviewRow] = useState(0);
	const [showGuides, setShowGuides] = useState(true);
	const [expectedColumns, setExpectedColumns] = useState<string[]>([]);
	const [loading, setLoading] = useState<string | null>(null);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);
	const [generating, setGenerating] = useState(false);
	const [sharing, setSharing] = useState(false);
	const toastId = useRef(0);

	const table = useMemo(() => (source ? buildTable(source.grid, source.hasHeader) : null), [source]);
	const columns = table?.columns ?? [];
	const rowCount = table?.rows.length ?? 0;
	const previewIndex = Math.min(previewRow, Math.max(0, rowCount - 1));
	const texts = useMemo(() => textsForRow(fields, table, previewIndex), [fields, table, previewIndex]);
	const selected = fields.find((f) => f.id === selectedId) ?? null;
	// Undo can remove the selected text area; drop the stale selection.
	useEffect(() => {
		if (selectedId && !selected) setSelectedId(null);
	}, [selectedId, selected]);

	const toast = useCallback((text: string, kind: ToastMessage["kind"] = "info") => {
		const id = ++toastId.current;
		setToasts((t) => [...t, { id, kind, text }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
	}, []);

	// Open a shared template from /t/<id>.
	useEffect(() => {
		const id = location.pathname.match(SHARE_PATH)?.[1];
		if (!id) return;
		let cancelled = false;
		setLoading("Opening shared template...");
		loadSharedTemplate(id)
			.then((t) => {
				if (cancelled) return;
				setImage(t.image);
				resetFields(t.fields);
				setCustomFonts(t.customFonts);
				setExpectedColumns(t.columns);
				setSelectedId(t.fields[0]?.id ?? null);
				toast("Template loaded. Add your list to generate cards.", "success");
			})
			.catch((err: Error) => {
				if (cancelled) return;
				toast(err.message, "error");
				history.replaceState(null, "", "/");
			})
			.finally(() => !cancelled && setLoading(null));
		return () => {
			cancelled = true;
		};
	}, [toast, resetFields]);

	const updateField = useCallback(
		(next: Field) => {
			changeFields(
				(fs) => fs.map((f) => (f.id === next.id ? next : f)),
				mergeKeyFor(fields.find((f) => f.id === next.id), next),
			);
		},
		[changeFields, fields],
	);

	// Surface font problems (e.g. a weight the family doesn't have) as soon as a field changes font.
	const fontKey = fields.map((f) => `${f.font.source}|${f.font.family}|${f.font.weight}|${f.font.italic}`).join(";");
	useEffect(() => {
		fields.forEach((f) => ensureFont(f.font, "Aa").catch((err: Error) => toast(err.message, "error")));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fontKey]);

	const applySource = useCallback((next: DataSource | null) => {
		setSource(next);
		setPreviewRow(0);
		if (!next) return;
		const cols = buildTable(next.grid, next.hasHeader).columns;
		if (!cols.length) return;
		// Re-point fields that only hold one placeholder for a column this list doesn't have.
		changeFields((fs) => {
			let changed = false;
			const next = fs.map((f) => {
				const ph = placeholdersIn(f.text).filter((p) => p !== ROW_NUMBER);
				const lone = ph.length === 1 && f.text.trim() === `{${ph[0]}}`;
				if (!lone || matchColumn(ph[0], cols)) return f;
				changed = true;
				return { ...f, text: `{${cols[0]}}` };
			});
			return changed ? next : fs;
		});
	}, [changeFields]);

	const openImage = async (file: File) => {
		if (!file.type.startsWith("image/")) return toast("That isn't an image. Use JPG, PNG or WebP.", "error");
		setLoading("Opening design...");
		try {
			const next = await loadTemplateImage(file, file.name);
			// Replacing the design keeps the layout, scaled to the new size.
			if (image && fields.length && (image.width !== next.width || image.height !== next.height)) {
				const kx = next.width / image.width;
				const ky = next.height / image.height;
				// The old layout can't be undone back onto the new design, so the history starts over.
				resetFields(
					fields.map((f) => ({
						...f,
						box: clampBox({ x: f.box.x * kx, y: f.box.y * ky, w: f.box.w * kx, h: f.box.h * ky }, next.width, next.height),
						fontSize: Math.round(f.fontSize * kx),
					})),
				);
			}
			setImage(next);
			if (location.pathname !== "/") history.replaceState(null, "", "/");
		} catch (err) {
			toast(err instanceof Error ? err.message : "Couldn't open that image.", "error");
		} finally {
			setLoading(null);
		}
	};

	const trySample = async () => {
		setLoading("Drawing a sample invitation...");
		try {
			const { blob, fields: sampleFields } = await createSampleTemplate();
			setImage(await loadTemplateImage(blob, "sample-invitation.png"));
			resetFields(sampleFields);
			setSelectedId(sampleFields[0].id);
			if (!source) applySource(sampleSource());
		} catch (err) {
			toast(err instanceof Error ? err.message : "Couldn't create the sample.", "error");
		} finally {
			setLoading(null);
		}
	};

	const firstColumnText = `{${columns[0] ?? "Name"}}`;
	const styleFrom = selected ?? fields.at(-1);

	const createField = (box: Box) => {
		const f = newField(box, firstColumnText, styleFrom?.font ?? DEFAULT_FONT);
		if (styleFrom) {
			f.color = styleFrom.color;
			f.align = styleFrom.align;
		}
		changeFields((fs) => [...fs, f]);
		setSelectedId(f.id);
	};

	const addCenteredField = () => {
		if (!image) return;
		const w = Math.round(image.width * 0.6);
		const h = Math.round(image.height * 0.1);
		createField({ x: (image.width - w) / 2, y: (image.height - h) / 2, w, h });
	};

	const duplicateField = (f: Field) => {
		if (!image) return;
		const copy: Field = {
			...f,
			id: newField(f.box, f.text).id,
			box: clampBox({ ...f.box, y: f.box.y + f.box.h + 10 }, image.width, image.height),
		};
		changeFields((fs) => [...fs, copy]);
		setSelectedId(copy.id);
	};

	const deleteField = useCallback((f: Field) => {
		changeFields((fs) => fs.filter((x) => x.id !== f.id));
		setSelectedId(null);
	}, []);

	const uploadFont = async (file: File) => {
		try {
			const font = await addCustomFont(file, customFonts);
			setCustomFonts((fs) => [...fs, font]);
			toast(`Added font "${font.family}".`, "success");
			return font;
		} catch (err) {
			toast(err instanceof Error ? err.message : "Couldn't load that font.", "error");
			return null;
		}
	};

	// Keyboard: nudge / delete the selected text area.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement;
			// Undo/redo everywhere except inside text inputs, which keep their own native undo.
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === "z" || key === "y")) {
				if (t.closest("input, textarea, select, [contenteditable], dialog")) return;
				e.preventDefault();
				if (key === "y" || e.shiftKey) redo();
				else undo();
				return;
			}
			// Only when the design itself (or nothing) has focus, so buttons and fields keep their own keys.
			if (t !== document.body && !t.closest(".overlay")) return;
			if (!selected || !image) return;
			const step = e.shiftKey ? 10 : 1;
			const moves: Record<string, [number, number]> = {
				ArrowLeft: [-step, 0],
				ArrowRight: [step, 0],
				ArrowUp: [0, -step],
				ArrowDown: [0, step],
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

	const longestRow = () => {
		if (!table) return;
		const fi = Math.max(0, fields.findIndex((f) => f.id === selectedId));
		let best = 0;
		let bestLen = -1;
		table.rows.forEach((_, i) => {
			const len = textsForRow([fields[fi]], table, i)[0]?.length ?? 0;
			if (len > bestLen) {
				bestLen = len;
				best = i;
			}
		});
		setPreviewRow(best);
	};

	const problems = [
		!image && "upload your design",
		!fields.length && "drag a text box onto the design",
		!rowCount && "add your list",
	].filter(Boolean) as string[];

	const startOver = () => {
		if ((image || source) && !confirm("Clear the design, text boxes and list?")) return;
		setImage(null);
		resetFields([]);
		setSelectedId(null);
		setSource(null);
		setExpectedColumns([]);
		history.replaceState(null, "", "/");
	};

	return (
		<div className="app">
			<header className="topbar">
				<div className="product">
					<ProductIcon />
					<span className="product-name">
						Wot Da <em>Fill</em>
					</span>
				</div>
				<p className="tagline">One design, a list of names, every card ready to send.</p>
				<div className="topbar-actions">
					{(image || source) && (
						<button type="button" className="btn ghost" onClick={startOver}>
							<Icon name="refresh" /> Start over
						</button>
					)}
					{image && fields.length > 0 && (
						<button type="button" className="btn ghost" onClick={() => setSharing(true)} title="Get a link to this template">
							<Icon name="share" /> Share template
						</button>
					)}
				</div>
			</header>

			<main className={`workspace${image ? " open" : ""}`}>
				<div className="canvas-col">
					{image ? (
						<>
							<div className="toolbar">
								{rowCount > 0 && (
								<div className="row-nav" aria-label="Preview row">
									<button
										type="button"
										className="icon-btn"
										aria-label="Previous row"
										disabled={previewIndex <= 0}
										onClick={() => setPreviewRow(previewIndex - 1)}
									>
										<Icon name="left" />
									</button>
									<span className="row-label">
										<span className="mono">
											{previewIndex + 1}/{rowCount}
										</span>{" "}
										<span className="row-text">{texts[0] || <i>empty</i>}</span>
									</span>
									<button
										type="button"
										className="icon-btn"
										aria-label="Next row"
										disabled={previewIndex >= rowCount - 1}
										onClick={() => setPreviewRow(previewIndex + 1)}
									>
										<Icon name="right" />
									</button>
									{rowCount > 1 && (
										<button type="button" className="btn ghost small" onClick={longestRow} title="Jump to the longest text to check it fits">
											<Icon name="ruler" /> Longest
										</button>
									)}
								</div>
								)}
								<div className="toolbar-right">
									<div className="history" role="group" aria-label="History">
									<button
										type="button"
										className="icon-btn"
										aria-label="Undo"
										title={`Undo (${MOD}Z)`}
										disabled={!canUndo}
										onClick={undo}
									>
										<Icon name="undo" />
									</button>
									<button
										type="button"
										className="icon-btn"
										aria-label="Redo"
										title={`Redo (${MOD === "⌘" ? "⇧⌘Z" : "Ctrl+Y"})`}
										disabled={!canRedo}
										onClick={redo}
									>
										<Icon name="redo" />
									</button>
									</div>
									<span className="muted small dims">
										{image.width} × {image.height} · {formatBytes(image.size)}
									</span>
									<button
										type="button"
										className="icon-btn"
										aria-pressed={!showGuides}
										aria-label={showGuides ? "Hide text boxes" : "Show text boxes"}
										title={showGuides ? "Hide text boxes" : "Show text boxes"}
										onClick={() => setShowGuides((s) => !s)}
									>
										<Icon name={showGuides ? "eye" : "eyeOff"} />
									</button>
								</div>
							</div>
							<Editor
								image={image}
								fields={fields}
								texts={texts}
								selectedId={selectedId}
								showGuides={showGuides}
								onSelect={setSelectedId}
								onChangeBox={(id, box) => changeFields((fs) => fs.map((f) => (f.id === id ? { ...f, box } : f)), `${id}:box`)}
								onCreate={createField}
							/>
							<p className="stage-hint muted small">
								{fields.length ? (
									<>
										<span className="fine-pointer">
											Drag on empty space to add another text box. Arrow keys nudge, Shift for 10px. Hold Alt to resize from the
											center or skip snapping.
										</span>
										<span className="coarse-pointer">Drag on empty space to add a text box. Drag a box or its handles to adjust.</span>
									</>
								) : (
									"Drag a box on the design where the name should go."
								)}
							</p>
						</>
					) : (
						<div className="empty">
							<FileDrop accept="image/jpeg,image/png,image/webp" onFile={openImage} label="Upload your design" className="drop-hero">
								<span className="drop-icon">
									<Icon name="image" size={28} />
								</span>
								<h1>
									Drop your <em>design</em> here
								</h1>
								<p className="muted">An invitation, certificate or name card without the names. JPG, PNG or WebP.</p>
								<span className="btn primary">
									<Icon name="upload" /> Choose image
								</span>
							</FileDrop>
							<button type="button" className="link" onClick={trySample}>
								or try an example
							</button>
						</div>
					)}
					{loading && (
						<div className="loading" role="status">
							<span className="spinner" aria-hidden="true" /> {loading}
						</div>
					)}
				</div>

				{/* Hidden until there is a design, then slides in from the right. */}
				<aside className="sidebar" inert={!image} aria-hidden={!image || undefined}>
					<Section
						step={1}
						title="Design"
						done={!!image}
						aside={
							image && (
								<FileDrop accept="image/jpeg,image/png,image/webp" onFile={openImage} label="Replace design" className="drop-link">
									Replace
								</FileDrop>
							)
						}
					>
						{image && (
							<p className="muted small file-line">
								<Icon name="image" size={14} /> <span className="truncate">{image.name}</span>
							</p>
						)}
					</Section>

					<Section step={2} title="Text on the card" done={fields.length > 0}>
						{image && (
							<FieldPanel
								fields={fields}
								selected={selected}
								columns={columns}
								customFonts={customFonts}
								imageWidth={image.width}
								previewText={selected ? (texts[fields.indexOf(selected)] ?? "") : ""}
								onSelect={setSelectedId}
								onChange={updateField}
								onAdd={addCenteredField}
								onDuplicate={duplicateField}
								onDelete={deleteField}
								onUploadFont={uploadFont}
							/>
						)}
					</Section>

					<Section step={3} title="Your list" done={rowCount > 0}>
						<DataPanel
							source={source}
							table={table}
							previewRow={previewIndex}
							expectedColumns={expectedColumns}
							onSource={applySource}
							onPreviewRow={setPreviewRow}
							onError={(m) => toast(m, "error")}
						/>
					</Section>

					<div className="generate-bar">
						<button
							type="button"
							className="btn primary big"
							disabled={problems.length > 0}
							onClick={() => setGenerating(true)}
						>
							<Icon name="sparkle" /> Generate {rowCount ? `${rowCount.toLocaleString("en-US")} ${rowCount === 1 ? "card" : "cards"}` : "cards"}
						</button>
						{problems.length > 0 && <p className="muted small">Next: {problems[0]}</p>}
					</div>

					<footer className="credit small">
						<a className="maker" href="https://wotdafong.dev" target="_blank" rel="noreferrer" aria-label="Made by Wot Da Fong">
							<picture>
								<source srcSet="/wotdafong-paper.svg" media="(prefers-color-scheme: dark)" />
								<img src="/wotdafong-ink.svg" alt="" width="16" height="16" />
							</picture>
							Wot Da Fong <span aria-hidden="true">↗</span>
						</a>
					</footer>
				</aside>
			</main>

			{generating && image && table && (
				<GenerateDialog
					params={{ template: image, fields, customFonts, table }}
					onClose={() => setGenerating(false)}
				/>
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
			<Toasts items={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
		</div>
	);
}

const MERGEABLE = new Set<keyof Field>(["text", "box", "color", "fontSize", "letterSpacing", "lineHeight"]);

/** One-property continuous edits (typing, color drags, nudges) share a key so they undo as one step. */
function mergeKeyFor(prev: Field | undefined, next: Field): string | null {
	if (!prev) return null;
	const changed = (Object.keys(next) as (keyof Field)[]).filter((k) => prev[k] !== next[k]);
	return changed.length === 1 && MERGEABLE.has(changed[0]) ? `${next.id}:${changed[0]}` : null;
}

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

/** Product icon: a card with a filled-in name line. Deliberately not the Wot Da Fong mark. */
function ProductIcon() {
	return (
		<svg className="product-icon" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
			<rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
			<rect x="7" y="9" width="18" height="14" rx="2" fill="var(--paper-raised)" />
			<path d="M10.5 17.2c1.6-2.6 3-2.6 3.4-.6.3 1.4 1.4 1.6 2.6-.2.8-1.2 1.7-1.3 2.2-.3.4.8 1.2.9 2.3.1" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
			<path d="M10 20.3h12" stroke="var(--ink-soft)" strokeWidth="1" strokeLinecap="round" />
		</svg>
	);
}
