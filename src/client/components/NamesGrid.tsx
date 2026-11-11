import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { columnLetter, guessHasHeader, parseDelimited } from "../lib/data";
import { useT } from "../lib/i18n";
import { Button } from "./ui";

/** Rows shown for editing. Longer lists are best handled as a file; the rest are kept, just not shown. */
const SHOWN_ROWS = 200;

const NO_WIDTH = 40;
const MIN_COLUMN = 120;

const filled = (row: string[]) => row.some((v) => v.trim() !== "");

/** A copy of `row` at least `n` cells long. */
const pad = (row: string[], n: number) => (row.length >= n ? row.slice() : [...row, ...Array<string>(n - row.length).fill("")]);

/** Empty rows at the end are dropped; the always-empty row below the list takes their place. */
function trimEnd(rows: string[][]) {
	let end = rows.length;
	while (end > 0 && !filled(rows[end - 1])) end--;
	return rows.slice(0, end);
}

/**
 * A small spreadsheet for the list: a row of headings, then one row per card.
 * Tab and Shift+Tab move across, Enter and the arrow keys move down and up, and cells pasted
 * from Excel, Google Sheets or Numbers fill the grid from where they're pasted.
 * There is always one empty row at the bottom to type the next entry into.
 */
export function NamesGrid({
	header,
	rows,
	previewRow,
	onChange,
	onPreviewRow,
}: {
	/** Headings as typed; an empty one is called "Column A", "Column B"… */
	header: string[];
	rows: string[][];
	/** The row on show on the design, counted among rows that have something in them. */
	previewRow: number;
	onChange(header: string[], rows: string[][]): void;
	onPreviewRow(i: number): void;
}) {
	const t = useT();
	const root = useRef<HTMLDivElement>(null);
	// Columns added with the button stay even while they're still empty.
	const [minWidth, setMinWidth] = useState(1);
	const [focusAt, setFocusAt] = useState<{ r: number; c: number } | null>(null);

	// How many rows are shown for editing: it grows as someone types past it, so a row never vanishes under the cursor.
	const [limit, setLimit] = useState(SHOWN_ROWS);

	const width = rows.reduce((w, r) => Math.max(w, r.length), Math.max(minWidth, header.length, 1));
	const cols = Array.from({ length: width }, (_, c) => c);
	const visible = rows.slice(0, limit);
	const hidden = rows.length - visible.length;
	// The empty row to type into, unless the list runs past what's shown.
	const shownRows = hidden ? visible : [...visible, []];
	const lastRow = shownRows.length - 1;

	// Grid rows that hold something, in order: the n-th is the n-th card.
	const cardRows = rows.flatMap((r, i) => (filled(r) ? [i] : []));
	const previewGridRow = cardRows[previewRow] ?? -1;

	useEffect(() => {
		if (!focusAt) return;
		const el = root.current?.querySelector<HTMLInputElement>(`input[data-r="${focusAt.r}"][data-c="${focusAt.c}"]`);
		if (el) {
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		}
		setFocusAt(null);
	}, [focusAt]);

	const emit = (h: string[], next: string[][]) => onChange(h, trimEnd(next));

	const setCell = (r: number, c: number, value: string) => {
		if (r < 0) {
			const h = pad(header, Math.max(width, c + 1));
			h[c] = value;
			return emit(h, rows);
		}
		const next = rows.map((x) => x.slice());
		while (next.length <= r) next.push([]);
		next[r] = pad(next[r], c + 1);
		next[r][c] = value;
		if (r >= limit) setLimit(r + 1);
		emit(header, next);
	};

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
		// Vietnamese typing (Telex, VNI) composes letters; its keys must reach the input untouched.
		if (e.nativeEvent.isComposing || e.keyCode === 229) return;
		const el = e.currentTarget;
		const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
		const caretAtEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
		let to: { r: number; c: number } | null = null;
		if (e.key === "Enter" || e.key === "ArrowDown") {
			if (e.key === "Enter") e.preventDefault();
			if (r < lastRow) to = { r: r + 1, c };
		} else if (e.key === "ArrowUp") {
			if (r > -1) to = { r: r - 1, c };
		} else if (e.key === "ArrowLeft" && caretAtStart && c > 0) {
			to = { r, c: c - 1 };
		} else if (e.key === "ArrowRight" && caretAtEnd && c < width - 1) {
			to = { r, c: c + 1 };
		} else if (e.key === "Backspace" && r >= 0 && r < rows.length && caretAtStart && !filled(rows[r])) {
			// Backspace in an empty row removes the row.
			e.preventDefault();
			emit(header, rows.filter((_, i) => i !== r));
			to = { r: r - 1, c };
		}
		if (to) {
			e.preventDefault();
			setFocusAt(to);
		}
	};

	const onPaste = (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
		const text = e.clipboardData.getData("text/plain");
		// One value: the browser pastes it as usual.
		if (!/[\t\n]/.test(text.replace(/\r?\n$/, ""))) return;
		e.preventDefault();
		const block = parseDelimited(text, text.includes("\t") ? "tab" : "line").filter(filled);
		if (!block.length) return;

		let h = header.slice();
		let start = r;
		let body = block;
		const empty = !filled(header) && !rows.some(filled);
		// Pasted onto a heading, or as the whole list into an empty grid with headings on top: the first line is headings.
		if (r < 0 || (empty && r === 0 && c === 0 && guessHasHeader(block, "paste"))) {
			h = pad(h, c + block[0].length);
			block[0].forEach((v, j) => (h[c + j] = v));
			body = block.slice(1);
			start = 0;
		}
		const next = rows.map((x) => x.slice());
		body.forEach((line, i) => {
			const ri = start + i;
			while (next.length <= ri) next.push([]);
			next[ri] = pad(next[ri], c + line.length);
			line.forEach((v, j) => (next[ri][c + j] = v));
		});
		emit(h, next);
		setFocusAt({ r: Math.min(start + Math.max(body.length - 1, 0), SHOWN_ROWS), c });
	};

	const onFocus = (r: number) => {
		const card = cardRows.indexOf(r);
		if (card >= 0) onPreviewRow(card);
	};

	const addColumn = () => {
		setMinWidth(width + 1);
		setFocusAt({ r: -1, c: width });
	};

	const cell = (r: number, c: number, value: string) => (
		<input
			data-r={r}
			data-c={c}
			className="wf-grid-cell"
			value={value}
			spellCheck={false}
			autoComplete="off"
			placeholder={r < 0 ? t.columnName(columnLetter(c)) : r === 0 && c === 0 && !rows.length ? t.typeOrPaste : undefined}
			aria-label={r < 0 ? t.headingOf(columnLetter(c)) : t.cellOf(r + 1, columnLetter(c))}
			onChange={(e) => setCell(r, c, e.target.value)}
			onKeyDown={(e) => onKeyDown(e, r, c)}
			onPaste={(e) => onPaste(e, r, c)}
			onFocus={() => r >= 0 && onFocus(r)}
		/>
	);

	return (
		<div className="wf-grid-wrap">
			<div className="wf-grid" ref={root}>
				{/* Columns share the width evenly, and scroll sideways once there are too many to fit. */}
				<table style={{ minWidth: NO_WIDTH + width * MIN_COLUMN }} aria-label={t.namesTitle}>
					<colgroup>
						<col style={{ width: NO_WIDTH }} />
						{cols.map((c) => (
							<col key={c} />
						))}
					</colgroup>
					<thead>
						<tr>
							<th className="wf-grid-no" aria-label={t.rowNo} />
							{cols.map((c) => (
								<th key={c} scope="col">
									{cell(-1, c, header[c] ?? "")}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{shownRows.map((row, r) => (
							<tr key={r} aria-current={r === previewGridRow || undefined}>
								<td className="wf-grid-no">{r < rows.length ? r + 1 : ""}</td>
								{cols.map((c) => (
									<td key={c}>{cell(r, c, row[c] ?? "")}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="wf-grid-foot">
				<Button size="sm" variant="ghost" icon="plus" onClick={addColumn}>
					{t.addColumn}
				</Button>
				{hidden > 0 && <span className="wf-hint">{t.andMore(hidden)}</span>}
			</div>
		</div>
	);
}
