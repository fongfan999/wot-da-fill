import { useRef, useState, type DragEvent } from "react";
import { guessHasHeader, readSpreadsheet, sampleSource } from "../lib/data";
import { messageOf, UserError } from "../lib/errors";
import { useT } from "../lib/i18n";
import type { ExampleKind } from "../lib/example";
import type { DataSource, Table } from "../types";
import { NamesGrid } from "./NamesGrid";
import { Button, Notice, pickFile, Section, Select, Switch } from "./ui";

const filled = (row: string[]) => row.some((v) => v.trim() !== "");
const SPREADSHEETS = ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv";


export function DataPanel({
	source,
	table,
	previewRow,
	expectedColumns,
	exampleKind,
	onSource,
	onEdit,
	onPreviewRow,
	onError,
	onBusy,
}: {
	source: DataSource | null;
	table: Table | null;
	previewRow: number;
	expectedColumns: string[];
	/** Which example the design is, if it still is one: "try example names" brings that example's list. */
	exampleKind: ExampleKind | null;
	/** A new list altogether: a file, the sample, or none. */
	onSource(next: DataSource | null): void;
	/** The same list, edited in the grid. */
	onEdit(next: DataSource | null): void;
	onPreviewRow(i: number): void;
	onError(message: string): void;
	onBusy(message: string | null): void;
}) {
	const t = useT();
	const [over, setOver] = useState(false);
	// dragenter/dragleave fire for every child crossed; count them so the highlight doesn't flicker.
	const depth = useRef(0);
	const hasFile = (e: DragEvent) => e.dataTransfer.types.includes("Files");

	// The grid shows headings apart from the rows. A row emptied while editing stays put until it's
	// removed with Backspace, so typing a new value into it doesn't jump to the next row.
	const grid = source?.grid ?? [];
	const header = source?.hasHeader ? (grid[0] ?? []) : [];
	const body = source?.hasHeader ? grid.slice(1) : grid;

	const edit = (h: string[], rows: string[][]) => {
		const hasHeader = h.some((v) => v.trim() !== "");
		const next = hasHeader ? [h, ...rows] : rows;
		if (!next.some((r) => r.some((v) => v.trim() !== ""))) return onEdit(null);
		// A file stays the file it came from; the sample, once changed, is a list of one's own.
		onEdit(source?.kind === "file" ? { ...source, grid: next, hasHeader } : { kind: "paste", name: "pasted", grid: next, hasHeader });
	};

	const openFile = async (file: File) => {
		onBusy(t.readingList);
		try {
			const wb = await readSpreadsheet(file);
			const sheets = wb.sheets.filter((s) => wb.read(s).length);
			const sheet = sheets[0] ?? wb.sheets[0];
			// Blank rows in a file are left out, so its first row with something in it can be the headings.
			const grid = wb.read(sheet).filter(filled);
			if (!grid.length) throw new UserError(t.fileNoNames);
			onSource({ kind: "file", name: file.name, grid, hasHeader: guessHasHeader(grid, "file"), sheets, sheet, readSheet: wb.read });
		} catch (err) {
			onError(messageOf(err, t.couldntReadFile));
		} finally {
			onBusy(null);
		}
	};

	const chooseFile = async () => {
		const file = await pickFile(SPREADSHEETS);
		if (file) openFile(file);
	};

	const switchSheet = (sheet: string) => {
		if (!source?.readSheet) return;
		const grid = source.readSheet(sheet).filter(filled);
		onSource({ ...source, sheet, grid, hasHeader: guessHasHeader(grid, "file") });
	};

	const clear = () => onSource(null);

	const rows = table?.rows.length ?? 0;
	// Only a file's first row can be mistaken for data or for headings; in the grid, the heading row is plain to see.
	// A wrong guess either way (a name taken for a heading, or a heading for a name) has to be correctable.
	const showHeadings = source?.kind === "file" && source.grid.length > 1;

	return (
		// The whole tab takes a dropped spreadsheet, not just the grid.
		<div
			className={`wf-dropzone${over ? " wf-dropzone-over" : ""}`}
			onDragEnter={(e) => {
				if (!hasFile(e)) return;
				depth.current++;
				setOver(true);
			}}
			onDragOver={(e) => {
				if (!hasFile(e)) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "copy";
			}}
			onDragLeave={(e) => {
				if (!hasFile(e)) return;
				depth.current = Math.max(0, depth.current - 1);
				if (!depth.current) setOver(false);
			}}
			onDrop={(e) => {
				depth.current = 0;
				setOver(false);
				const file = e.dataTransfer.files[0];
				if (!file) return;
				e.preventDefault();
				openFile(file);
			}}
		>
			<Section>
				{!source && expectedColumns.length > 0 && (
					<Notice>
						{t.layoutUses(expectedColumns)}
					</Notice>
				)}

				{/* How many names and where they came from, with the way to clear them on the same line. */}
				{source && table && (
					<div className="wf-list-head">
						<p className="wf-truncate" title={source.kind === "file" ? source.name : undefined}>
							<b>{t.nameCount(rows)}</b>
							<span className="wf-muted">
								{" "}
								{t.from} {source.kind === "paste" ? t.pastedList : source.kind === "sample" ? t.sampleList : source.name}
							</span>
							{source.sheets && source.sheets.length > 1 && <span className="wf-muted"> · {source.sheet}</span>}
						</p>
						<Button size="sm" variant="ghost" onClick={clear}>
							{t.clearList}
						</Button>
					</div>
				)}

				<div className="wf-paste">
					{!source && <span className="wf-label">{t.pasteLabel}</span>}
					<NamesGrid header={header} rows={body} previewRow={previewRow} onChange={edit} onPreviewRow={onPreviewRow} />
					{!source && <p className="wf-hint">{t.pasteHint}</p>}
				</div>

				{!source && (
					<p className="wf-or">
						{t.or}{" "}
						<Button variant="link" onClick={chooseFile}>
							{t.chooseSpreadsheet}
						</Button>
						{!expectedColumns.length && (
							<>
								{" "}
								{t.orElse}{" "}
								<Button variant="link" onClick={() => onSource(sampleSource(undefined, exampleKind ?? "invitation"))}>
									{t.trySampleNames}
								</Button>
							</>
						)}
					</p>
				)}

				{source && rows === 0 && <p className="wf-hint">{t.noNamesYet}</p>}
				{showHeadings && source && (
					<Switch checked={source.hasHeader} onChange={(hasHeader) => onSource({ ...source, hasHeader })} label={t.headings} />
				)}
				{source?.sheets && source.sheets.length > 1 && (
					<Select
						label={t.sheet}
						value={source.sheet ?? ""}
						options={source.sheets.map((s) => ({ value: s, label: s }))}
						onChange={switchSheet}
					/>
				)}
			</Section>
			{over && (
				<div className="wf-drop-overlay" aria-hidden="true">
					{t.dropSpreadsheet}
				</div>
			)}
		</div>
	);
}
