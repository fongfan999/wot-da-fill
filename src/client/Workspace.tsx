import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataPanel } from "./components/DataPanel";
import { Editor } from "./components/Editor";
import { FieldPanel, fieldLabel } from "./components/FieldPanel";
import { GenerateDialog } from "./components/GenerateDialog";
import { HomePage } from "./components/HomePage";
import { ShareDialog } from "./components/ShareDialog";
import {
	Button,
	Flag,
	GITHUB_URL,
	feedbackHref,
	GitHubMark,
	Icon,
	IconButton,
	MadeBy,
	Menu,
	Notice,
	HomeLink,
	pickFile,
	Tabs,
	useRemembered,
	Toast,
	type ToastMessage,
} from "./components/ui";
import { buildTable, sampleSource } from "./lib/data";
import { clampBox, newField } from "./lib/fields";
import { findTooLong, type TooLong } from "./lib/fit";
import { addCustomFont, DEFAULT_FONT, ensureFont } from "./lib/fonts";
import { textsForRow } from "./lib/generate";
import { inkFor, loadTemplateImage, readableOn, suggestColors } from "./lib/image";
import { getSampleTemplate } from "./lib/showcase";
import { EXAMPLE, EXAMPLE_KINDS, exampleGrid, type ExampleKind } from "./lib/example";
import { messageOf } from "./lib/errors";
import { getLang, HOME_PATH, langFromPath, tr, useLang, useT } from "./lib/i18n";
import { useTheme } from "./lib/theme";
import { loadSharedTemplate, shareTemplate } from "./lib/share";
import { matchColumn, placeholdersIn, ROW_NUMBER, unknownPlaceholders } from "./lib/text";
import { useUndoable } from "./lib/useUndoable";
import type { Box, CustomFont, DataSource, Field, TemplateImage } from "./types";

const SHARE_PATH = /^\/t\/([A-Za-z0-9]{16})\/?$/;
const IMAGES = "image/jpeg,image/png,image/webp";

/** The side panel's two tabs. Neither depends on the other, so people fill them in any order. */
type Tab = "text" | "names";

/** How the editor was opened from the home page: with a picture, or with one of the examples. */
export type Start = { file: File } | { example: ExampleKind };

/**
 * Everything after the home page: the editor, its panels and dialogs, and the home page again
 * once it is cleared (so Undo can bring the work back). Loaded on its own, after the home page.
 */
export function Workspace({ start }: { start?: Start }) {
	const [image, setImage] = useState<TemplateImage | null>(null);
	// Which example the design is, while it still is one, so a language switch can redraw it.
	const [exampleKind, setExampleKind] = useState<ExampleKind | null>(null);
	const { value: fields, change: changeFields, reset: resetFields, undo, redo, canUndo, canRedo } = useUndoable<Field[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
	const [source, setSource] = useState<DataSource | null>(null);
	const [previewRow, setPreviewRow] = useState(0);
	const [showBoxes, setShowBoxes] = useState(true);
	const [expectedColumns, setExpectedColumns] = useState<string[]>([]);
	const [tab, setTab] = useState<Tab>("text");
	// Once someone has drawn a box themselves, they know how; the hint by the mouse stops showing.
	const [drewBox, setDrewBox] = useRemembered("wdf:drew-box", false);
	const [busy, setBusy] = useState<string | null>(null);
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const [generating, setGenerating] = useState(false);
	const [sharing, setSharing] = useState(false);
	const [tooLong, setTooLong] = useState<TooLong[] | null>(null);
	const [lang, setLang] = useLang();
	const [theme, setTheme] = useTheme();
	const t = useT();
	const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	// The design as it is right now, for work that finishes later and must not overwrite a newer one.
	const imageRef = useRef(image);
	imageRef.current = image;

	// A column with no heading is named in the page's language ("Column A", "Cột A"), so the language is a dependency.
	const table = useMemo(() => (source ? buildTable(source.grid, source.hasHeader) : null), [source, lang]);
	const columns = table?.columns ?? [];
	const rowCount = table?.rows.length ?? 0;
	const previewIndex = Math.min(previewRow, Math.max(0, rowCount - 1));
	// The example name shown before there is a list follows the language, so it is a dependency here.
	const texts = useMemo(() => textsForRow(fields, table, previewIndex), [fields, table, previewIndex, lang]);
	const selected = fields.find((f) => f.id === selectedId) ?? null;
	// Numbered, so boxes that say the same thing can still be told apart on the design.
	// Before there is a list, boxes that take from it show an example name; their tags say so.
	const labels = fields.map(
		(f, i) => `${i + 1}. ${fieldLabel(f)}${!rowCount && placeholdersIn(f.text).length ? ` · ${t.exampleTag}` : ""}`,
	);
	// What the bar calls the card on show: what its first box says, else the row's own first entry.
	const shownName = texts.find((x) => x.trim()) || Object.values(table?.rows[previewIndex] ?? {}).find((v) => v.trim()) || "";
	const selectedBox = selected?.box;
	const colorSuggestions = useMemo(
		() => (image && selectedBox ? suggestColors(image, selectedBox) : []),
		[image, selectedBox],
	);

	// A file dropped anywhere outside a drop zone would make the browser open it and leave the app.
	useEffect(() => {
		const stop = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
		};
		window.addEventListener("dragover", stop);
		window.addEventListener("drop", stop);
		return () => {
			window.removeEventListener("dragover", stop);
			window.removeEventListener("drop", stop);
		};
	}, []);

	// Undo can remove the selected text box; drop the stale selection.
	useEffect(() => {
		if (selectedId && !selected) setSelectedId(null);
	}, [selectedId, selected]);

	// The Text tab always edits something when there is something to edit.
	useEffect(() => {
		if (tab === "text" && !selected && fields.length) setSelectedId(fields[0].id);
	}, [tab, selected, fields]);

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
		setBusy(t.openingShared);
		loadSharedTemplate(id)
			.then((t) => {
				if (cancelled) return;
				setImage(t.image);
				setExampleKind(null);
				resetFields(t.fields);
				setCustomFonts(t.customFonts);
				setExpectedColumns(t.columns);
				setSelectedId(t.fields[0]?.id ?? null);
				// A shared layout brings its text boxes; the list is what's left to add.
				setTab("names");
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				console.error(err);
				say(messageOf(err, tr().sharedCouldntLoad), "error");
				history.replaceState(null, "", HOME_PATH[getLang()]);
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
			const prev = fields.find((f) => f.id === next.id);
			// Pressing what is already chosen, or nudging against an edge, changes nothing: no undo step for it.
			if (prev && sameField(prev, next)) return;
			changeFields((fs) => fs.map((f) => (f.id === next.id ? next : f)), mergeKeyFor(prev, next));
		},
		[changeFields, fields],
	);

	// Surface font problems (e.g. a weight the family doesn't have) as soon as a box changes font.
	const fontKey = fields.map((f) => `${f.font.source}|${f.font.family}|${f.font.weight}|${f.font.italic}`).join(";");
	useEffect(() => {
		fields.forEach((f) => ensureFont(f.font, "Aa").catch((err: unknown) => say(messageOf(err, tr().fontLoadFailed), "error")));
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

	/** A new list, or none. Clearing one offers Undo instead of asking first. */
	const replaceSource = useCallback(
		(next: DataSource | null) => {
			const before = source;
			applySource(next);
			if (next || !before) return;
			const restore = () => {
				setSource(before);
				setToast(null);
			};
			say(tr().listCleared, "info", { label: tr().undo, onClick: restore }, 8000);
		},
		[source, applySource, say],
	);

	/**
	 * The same list, changed in the grid. Unlike a new list, the design keeps the name on show,
	 * and a renamed heading takes its boxes along: {Column A} becomes {Guest}.
	 */
	const editSource = useCallback(
		(next: DataSource | null) => {
			if (!source || !next) return applySource(next);
			const before = buildTable(source.grid, source.hasHeader).columns;
			const after = buildTable(next.grid, next.hasHeader).columns;
			setSource(next);
			const renamed = new Map<string, string>();
			before.forEach((c, i) => {
				if (after[i] && after[i] !== c && !after.includes(c)) renamed.set(c, after[i]);
			});
			if (!renamed.size) return;
			const rename = (text: string) =>
				text.replace(/\{([^{}]+)\}/g, (m, p: string) => {
					const from = [...renamed.keys()].find((c) => matchColumn(p.trim(), [c]));
					return from ? `{${renamed.get(from)}}` : m;
				});
			// Typing a heading letter by letter is one undo step, not one per letter.
			changeFields((fs) => (fs.some((f) => rename(f.text) !== f.text) ? fs.map((f) => ({ ...f, text: rename(f.text) })) : fs), "list:rename");
		},
		[source, applySource, changeFields],
	);

	// Before there is a list, a new box holds the example's name column in the site's language.
	const firstColumnText = `{${columns[0] ?? EXAMPLE[lang].nameColumn}}`;
	const styleFrom = selected ?? fields.at(-1);

	// Each new box starts with the first column no box shows yet, so boxes don't all read "Name".
	// Once every column is in use (or before there is a list), it falls back to the first one.
	const usedColumns = new Set(
		fields.flatMap((f) => placeholdersIn(f.text).map((p) => matchColumn(p, columns))).filter((c) => c !== undefined),
	);
	const unusedColumn = columns.find((c) => !usedColumns.has(c));
	const nextColumnText = unusedColumn ? `{${unusedColumn}}` : firstColumnText;

	const makeField = (box: Box, text = nextColumnText) => {
		const f = newField(box, text, styleFrom?.font ?? DEFAULT_FONT);
		if (styleFrom) {
			f.color = styleFrom.color;
			f.align = styleFrom.align;
		} else if (image) {
			f.color = inkFor(image, f.box);
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
		setTab("text");
	};

	const openImage = async (file: File) => {
		// Only the kinds the page names: a GIF or HEIC would open here and then fail to share or to keep its format.
		if (!IMAGES.split(",").includes(file.type)) return say(t.notPicture, "error");
		setBusy(t.openingDesign);
		try {
			const next = await loadTemplateImage(file, file.name);
			setExampleKind(null);
			if (image && fields.length) {
				// Replacing the design keeps the layout, scaled to the new size, with any text that would vanish
				// into the new background switched to dark or light. The old layout can't be undone onto the new design.
				const resized = image.width !== next.width || image.height !== next.height;
				const kx = next.width / image.width;
				const ky = next.height / image.height;
				const moved = fields.map((f) => {
					const box = resized
						? clampBox({ x: f.box.x * kx, y: f.box.y * ky, w: f.box.w * kx, h: f.box.h * ky }, next.width, next.height)
						: f.box;
					return {
						...f,
						box,
						fontSize: resized ? Math.round(f.fontSize * kx) : f.fontSize,
						color: readableOn(next, box, f.color),
					};
				});
				if (resized || moved.some((f, i) => f.color !== fields[i].color)) resetFields(moved);
			} else {
				// Nobody should have to discover dragging: the first box is placed for them.
				const f = newField(centredBox(next), firstColumnText);
				f.color = inkFor(next, f.box);
				resetFields([f]);
				setSelectedId(f.id);
				setTab("text");
			}
			setImage(next);
			if (!langFromPath(location.pathname)) history.replaceState(null, "", HOME_PATH[getLang()]);
		} catch (err) {
			say(messageOf(err, t.couldntOpenPicture), "error");
		} finally {
			setBusy(null);
		}
	};

	/** Opens one example as a finished setup: its design, its text boxes placed and styled, and its list. */
	const trySample = async (kind: ExampleKind = "invitation") => {
		setBusy(t.drawingExample);
		try {
			const sample = await getSampleTemplate(lang, kind);
			// The drawing is shared with the home page; the boxes are copied so edits never reach it.
			const sampleFields = sample.fields.map((f) => ({ ...f, box: { ...f.box }, font: { ...f.font } }));
			setImage(await loadTemplateImage(sample.blob, sample.fileName));
			setExampleKind(kind);
			resetFields(sampleFields);
			setSelectedId(sampleFields[0].id);
			if (!source) applySource(sampleSource(lang, kind));
			setTab("text");
		} catch (err) {
			console.error(err);
			say(messageOf(err, t.couldntDrawExample), "error");
		} finally {
			setBusy(null);
		}
	};

	// Opened by a picture or an example on the home page: carry it out once.
	const started = useRef(false);
	useEffect(() => {
		if (!start || started.current) return;
		started.current = true;
		if ("file" in start) openImage(start.file);
		else trySample(start.example);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [start]);

	const addText = () => {
		if (image) createField(centredBox(image));
	};

	/**
	 * Switching language mid-edit takes the example along: its drawing, its sample list, and any box
	 * that still says what the example said or points at the example's columns. A person's own design,
	 * list and words are left as they are.
	 */
	const switchLang = async () => {
		const next = lang === "en" ? "vi" : "en";
		const same = (a: string[][], b: string[][]) => JSON.stringify(a) === JSON.stringify(b);
		const sampleKind =
			source?.kind === "sample" ? EXAMPLE_KINDS.find((k) => same(exampleGrid(lang, k), source.grid)) : undefined;
		setLang(next);
		if (source && !sampleKind) return;

		const columns = new Map<string, string>(
			(["nameColumn", "tableColumn", "companyColumn"] as const).map((k) => [EXAMPLE[lang][k], EXAMPLE[next][k]]),
		);
		const texts = new Map<string, string>([[EXAMPLE[lang].tableText, EXAMPLE[next].tableText]]);
		const startedWith = image;
		try {
			if (exampleKind) {
				const [from, to] = await Promise.all([getSampleTemplate(lang, exampleKind), getSampleTemplate(next, exampleKind)]);
				from.fields.forEach((f, i) => to.fields[i] && texts.set(f.text, to.fields[i].text));
				const drawn = await loadTemplateImage(to.blob, to.fileName);
				// Replaced or cleared while the other language's drawing was loading: leave the new work alone.
				if (imageRef.current !== startedWith) return;
				setImage(drawn);
			}
		} catch {
			// The old drawing stays; only the words change.
		}
		if (imageRef.current !== startedWith && !exampleKind) return;
		const swap = (text: string) =>
			texts.get(text) ?? text.replace(/\{([^{}]+)\}/g, (m, p: string) => (columns.has(p.trim()) ? `{${columns.get(p.trim())}}` : m));
		changeFields((fs) => (fs.some((f) => swap(f.text) !== f.text) ? fs.map((f) => ({ ...f, text: swap(f.text) })) : fs));
		if (sampleKind) applySource(sampleSource(next, sampleKind));
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
			say(tr().boxRemoved, "info", { label: tr().undo, onClick: restore });
		},
		[changeFields, say],
	);

	const uploadFont = async (file: File) => {
		try {
			const font = await addCustomFont(file, customFonts);
			setCustomFonts((fs) => [...fs, font]);
			say(t.fontAdded(font.family));
			return font;
		} catch (err) {
			say(messageOf(err, t.couldntReadFont), "error");
			return null;
		}
	};

	// Keyboard: undo/redo anywhere; nudge, remove and deselect the selected box when the design has focus.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// A dialog is on top: the design behind it must not move, lose a box or undo.
			if (document.querySelector("dialog[open]")) return;
			const t = e.target as HTMLElement;
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === "z" || key === "y")) {
				// Places where typing happens keep their own undo; switches, colour pickers and menus have none.
				const typing =
					t.closest("textarea, [contenteditable]") ||
					(t instanceof HTMLInputElement && !["checkbox", "radio", "color", "range", "file", "button"].includes(t.type));
				if (typing) return;
				e.preventDefault();
				if (key === "y" || e.shiftKey) redo();
				else undo();
				return;
			}
			// Only with the design itself focused (a click on it does that): never from the list or a button.
			if (!t.closest(".overlay")) return;
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
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selected, image, updateField, deleteField, undo, redo]);

	/** Clears everything at once and offers Undo instead of asking first. */
	const startOver = () => {
		const snapshot = { image, exampleKind, fields, customFonts, source, expectedColumns, tab, selectedId };
		setImage(null);
		setExampleKind(null);
		resetFields([]);
		setSelectedId(null);
		setSource(null);
		setExpectedColumns([]);
		setTab("text");
		history.replaceState(null, "", HOME_PATH[getLang()]);
		say(
			t.cleared,
			"info",
			{
				label: t.undo,
				onClick: () => {
					setImage(snapshot.image);
					setExampleKind(snapshot.exampleKind);
					resetFields(snapshot.fields);
					setCustomFonts(snapshot.customFonts);
					setSource(snapshot.source);
					setExpectedColumns(snapshot.expectedColumns);
					setTab(snapshot.tab);
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
		setTab("text");
	};
	const flagged = new Set(tooLong?.find((r) => r.row === previewIndex)?.fields ?? []);

	const missing = !image ? t.missingDesign : !rowCount ? t.missingNames : !fields.length ? t.missingBox : null;
	const replaceDesign = async () => {
		const file = await pickFile(IMAGES);
		if (file) openImage(file);
	};

	const spills = tooLong?.some((r) => r.spill);
	const shrinks = tooLong?.some((r) => !r.spill);
	const fitNotice =
		rowCount > 0 && missingColumns.length ? (
			<Notice tone="warn" action={tab === "text" && selected && unknownPlaceholders(selected.text, columns).length ? undefined : { label: t.showMe, onClick: showMissing }}>
				{t.missingColumns(missingColumns)}
			</Notice>
		) : rowCount > 0 && fields.length > 0 && tooLong ? (
			tooLong.length ? (
				<Notice tone="warn" action={{ label: t.showMe, onClick: showNextTooLong }}>
					{t.tooLong(tooLong.length, fields.length > 1, !!spills, !!shrinks)}
				</Notice>
			) : (
				<Notice icon="check">{t.allFit(rowCount, fields.length > 1)}</Notice>
			)
		) : null;

	// The button always says what comes next: with no list yet, that's adding one.
	const addNamesFirst = !rowCount && tab === "text";
	const primary = addNamesFirst ? (
		<Button variant="primary" size="lg" full iconRight="right" onClick={() => setTab("names")}>
			{t.addNames}
		</Button>
	) : (
		<Button variant="primary" size="lg" full disabled={!!missing} onClick={() => setGenerating(true)}>
			{t.makeCards(rowCount)}
		</Button>
	);

	const hint = !fields.length ? (
		t.hintNoBox
	) : (
		<>
			<span className="fine-pointer">{t.hintTextFine}</span>
			<span className="coarse-pointer">{t.hintTextCoarse}</span>
		</>
	);

	const holdToast = () => clearTimeout(toastTimer.current);
	const releaseToast = () => {
		if (toast && toast.kind !== "error") toastTimer.current = setTimeout(() => setToast(null), 4000);
	};
	const toasts = (
		<div
			className={`wf-toasts${image ? " wf-toasts-editor" : ""}`}
			role="status"
			aria-live="polite"
			// An Undo that is being reached for doesn't vanish on the way.
			onPointerEnter={holdToast}
			onPointerLeave={releaseToast}
			onFocus={holdToast}
			onBlur={releaseToast}
		>
			{busy && <Toast toast={{ id: 0, kind: "busy", text: busy }} />}
			{toast && !busy && <Toast key={toast.id} toast={toast} onDismiss={() => setToast(null)} />}
		</div>
	);

	// No design yet: the home page, with no side panel.
	if (!image)
		return (
			<>
				<HomePage onFile={openImage} onExample={trySample} />
				{toasts}
			</>
		);

	return (
		<div className="wf-app">
			{/* One bar: the name on show, the edit tools and the app's own actions, so the design gets the height. */}
			<header className="wf-topbar">
				<h1 className="wf-sr">Wot Da Fill</h1>
				<HomeLink onClick={startOver} />
				<span className="wf-topbar-sep" aria-hidden="true" />
				<div className="wf-topbar-name">
					{rowCount > 0 ? (
						<div className="wf-switcher" role="group" aria-label={t.whichName}>
							<IconButton icon="left" label={t.prevName} disabled={previewIndex <= 0} onClick={() => setPreviewRow(previewIndex - 1)} />
							{/* The name on show is where people look to change it, so it opens the list. */}
							<button type="button" className="wf-switcher-label wf-stage-link" title={t.openList} onClick={() => setTab("names")}>
								<span className="wf-meta">
									{t.nOfM(previewIndex + 1, rowCount)}
								</span>
								<span className="wf-switcher-name">
									{shownName || <i className="wf-muted">{t.empty}</i>}
								</span>
							</button>
							<IconButton
								icon="right"
								label={t.nextName}
								disabled={previewIndex >= rowCount - 1}
								onClick={() => setPreviewRow(previewIndex + 1)}
							/>
						</div>
					) : (
						// Says the name on the design is a stand-in, names it, and leads to where the real ones go.
						<button type="button" className="wf-stage-label wf-stage-link" onClick={() => setTab("names")}>
							<Icon name="people" size={16} />
							<span className="wf-truncate">{t.exampleOf(texts.find((x) => x.trim()) ?? EXAMPLE[lang].name)}</span>
							<span className="wf-stage-cta">{t.addYourNames}</span>
						</button>
					)}
				</div>
				<div className="wf-topbar-actions">
					<div className="wf-stage-tools">
						<IconButton icon="undo" label={t.undo} title={`${t.undo} (${MOD}Z)`} disabled={!canUndo} onClick={undo} />
						<IconButton icon="redo" label={t.redo} title={`${t.redo} (${MOD === "⌘" ? "⇧⌘Z" : "Ctrl+Y"})`} disabled={!canRedo} onClick={redo} />
						<span className="wf-sep" aria-hidden="true" />
						{/* One name, pressed or not: "Hide the box outlines, pressed" says they are hidden. */}
						<IconButton
							icon={showBoxes ? "eye" : "eyeOff"}
							label={t.hideBoxes}
							title={showBoxes ? t.hideBoxes : t.showBoxes}
							pressed={!showBoxes}
							onClick={() => setShowBoxes((s) => !s)}
						/>
					</div>
					<span className="wf-topbar-sep" aria-hidden="true" />
					{image && fields.length > 0 && (
						<Button variant="ghost" icon="share" onClick={() => setSharing(true)} title={t.shareLayout}>
							{t.share}
						</Button>
					)}
					<Menu
						label={t.more}
						items={[
							{ label: t.replaceDesign, icon: "image", onClick: replaceDesign },
							"separator",
							// Names the other language in its own words, so anyone can find their way back.
							{ label: t.langName[lang === "en" ? "vi" : "en"], icon: <Flag lang={lang === "en" ? "vi" : "en"} size={20} />, onClick: switchLang },
							{
								label: theme === "dark" ? t.lightTheme : t.darkTheme,
								icon: theme === "dark" ? "sun" : "moon",
								onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
							},
							"separator",
							{ label: t.feedback, icon: "mail", onClick: () => (window.location.href = feedbackHref(t.feedbackSubject, t.feedbackBody)) },
							{ label: t.github, icon: <GitHubMark />, onClick: () => window.open(GITHUB_URL, "_blank", "noopener") },
							"separator",
							{ label: t.startOver, icon: "refresh", onClick: startOver },
						]}
					/>
				</div>
			</header>

			<main className="wf-work">
				{/* On a phone the stage is only as tall as the design needs, so the controls stay in view. */}
				<div className="wf-stage" style={{ "--wf-aspect": image.height / image.width } as React.CSSProperties}>
					<Editor
						image={image}
						fields={fields}
						texts={texts}
						labels={labels}
						flagged={flagged}
						selectedId={selectedId}
						showGuides={showBoxes}
						onSelect={setSelectedId}
						onOpen={() => setTab("text")}
						onChangeBox={(id, box) =>
							changeFields((fs) => (fs.some((f) => f.id === id && !sameBox(f.box, box)) ? fs.map((f) => (f.id === id ? { ...f, box } : f)) : fs), `${id}:box`)
						}
						onCreate={(box) => {
							createField(box);
							setDrewBox(true);
						}}
						drawHint={drewBox ? null : t.dragToAdd}
					/>
					<p className="wf-stage-hint">{hint}</p>
				</div>

				<aside className="wf-panel">
					<Tabs
						label={t.panelTabs}
						idPrefix="wf-panel"
						value={tab}
						onChange={setTab}
						tabs={[
							{ value: "text", label: t.textTitle, count: fields.length > 1 ? fields.length : undefined },
							{ value: "names", label: t.namesTitle, count: rowCount || undefined, dot: rowCount ? undefined : t.namesMissing },
						]}
					/>
					<div className="wf-panel-body" role="tabpanel" id="wf-panel-panel" aria-labelledby={`wf-panel-tab-${tab}`}>
						{tab === "names" ? (
							<DataPanel
								source={source}
								table={table}
								previewRow={previewIndex}
								expectedColumns={expectedColumns}
								exampleKind={exampleKind}
								onSource={replaceSource}
								onEdit={editSource}
								onPreviewRow={setPreviewRow}
								onError={(m) => say(m, "error")}
								onBusy={setBusy}
							/>
						) : (
							<FieldPanel
								fields={fields}
								selected={selected}
								columns={columns}
								customFonts={customFonts}
								imageWidth={image.width}
								imageHeight={image.height}
								colorSuggestions={colorSuggestions}
								onSelect={setSelectedId}
								onChange={updateField}
								onAdd={addText}
								onDelete={deleteField}
								onUploadFont={uploadFont}
							/>
						)}
					</div>
					<div className="wf-panel-foot">
						{fitNotice}
						{primary}
						{!addNamesFirst && missing && (
							<p className="wf-hint" style={{ textAlign: "center" }}>
								{missing}
							</p>
						)}
						<MadeBy />
					</div>
					{/* On a phone the credit sits at the end of the page, not in the bar that stays on screen. */}
					<div className="wf-panel-credit">
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
						// The link says which pieces of a list the boxes use, so the next person knows what headings to bring.
						const uses = [...new Set(fields.flatMap((f) => placeholdersIn(f.text)).filter((p) => p !== ROW_NUMBER))];
						const url = await shareTemplate(image, fields, customFonts, uses.map((p) => matchColumn(p, columns) ?? p));
						history.replaceState(null, "", new URL(url).pathname);
						return url;
					}}
					onClose={() => setSharing(false)}
				/>
			)}
		</div>
	);
}

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const sameField = (a: Field, b: Field) =>
	(Object.keys(b) as (keyof Field)[]).every((k) =>
		k === "box" ? sameBox(a.box, b.box) : k === "font" ? JSON.stringify(a.font) === JSON.stringify(b.font) : a[k] === b[k],
	);

const MERGEABLE = new Set<keyof Field>(["text", "box", "color", "fontSize", "letterSpacing", "lineHeight"]);

/** One-property continuous edits (typing, colour drags, nudges) share a key so they undo as one step. */
function mergeKeyFor(prev: Field | undefined, next: Field): string | null {
	if (!prev) return null;
	const changed = (Object.keys(next) as (keyof Field)[]).filter((k) => prev[k] !== next[k]);
	return changed.length === 1 && MERGEABLE.has(changed[0]) ? `${next.id}:${changed[0]}` : null;
}

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
