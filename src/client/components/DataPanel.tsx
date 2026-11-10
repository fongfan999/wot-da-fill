import { useEffect, useId, useState } from "react";
import { guessHasHeader, parseDelimited, readSpreadsheet, resolvePasteDelimiter, sampleSource, type Delimiter } from "../lib/data";
import type { DataSource, Table } from "../types";
import { Button, Notice, pickFile, Section, Select, Switch } from "./ui";

const PREVIEW_ROWS = 200;
const SPREADSHEETS = ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv";

const names = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "name" : "names"}`;

export function DataPanel({
	source,
	table,
	previewRow,
	expectedColumns,
	paste,
	delimiter,
	onPaste,
	onDelimiter,
	onSource,
	onPreviewRow,
	onError,
	onBusy,
}: {
	source: DataSource | null;
	table: Table | null;
	previewRow: number;
	expectedColumns: string[];
	paste: string;
	delimiter: Delimiter;
	onPaste(text: string): void;
	onDelimiter(d: Delimiter): void;
	onSource(next: DataSource | null): void;
	onPreviewRow(i: number): void;
	onError(message: string): void;
	onBusy(message: string | null): void;
}) {
	const pasteId = useId();
	const [over, setOver] = useState(false);
	const [tweaking, setTweaking] = useState(false);
	const typing = !source || source.kind === "paste";

	// Re-read pasted text as it changes.
	useEffect(() => {
		if (source && source.kind !== "paste") return;
		const t = setTimeout(() => {
			if (!paste.trim()) {
				if (source?.kind === "paste") onSource(null);
				return;
			}
			const grid = parseDelimited(paste, delimiter);
			const hasHeader = source?.kind === "paste" ? source.hasHeader : guessHasHeader(grid, "paste");
			onSource({ kind: "paste", name: "what you pasted", grid, hasHeader });
		}, 200);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paste, delimiter]);

	const openFile = async (file: File) => {
		onBusy("Reading your list…");
		try {
			const wb = await readSpreadsheet(file);
			const sheets = wb.sheets.filter((s) => wb.read(s).length);
			const sheet = sheets[0] ?? wb.sheets[0];
			const grid = wb.read(sheet);
			if (!grid.length) throw new Error("That file has no names in it.");
			onPaste("");
			onSource({ kind: "file", name: file.name, grid, hasHeader: guessHasHeader(grid, "file"), sheets, sheet, readSheet: wb.read });
		} catch (err) {
			onError(err instanceof Error ? err.message : "Couldn't read that file. Try saving it as Excel or CSV.");
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
		const grid = source.readSheet(sheet);
		onSource({ ...source, sheet, grid, hasHeader: guessHasHeader(grid, "file") });
	};

	const clear = () => {
		onPaste("");
		onSource(null);
		setTweaking(false);
	};

	const rows = table?.rows.length ?? 0;
	const headingsSwitch = source && (
		<Switch checked={source.hasHeader} onChange={(hasHeader) => onSource({ ...source, hasHeader })} label="The first row is headings" />
	);
	const showHeadings = !!source && ((table?.columns.length ?? 0) > 1 || source.hasHeader);

	return (
		<Section
			title="Names"
			aside={
				source && source.kind !== "paste" ? (
					<Button size="sm" onClick={clear}>
						Replace list
					</Button>
				) : source ? (
					<Button size="sm" variant="ghost" onClick={clear}>
						Clear
					</Button>
				) : null
			}
		>
			{!source && expectedColumns.length > 0 && (
				<Notice>
					This layout uses <b>{expectedColumns.join(" and ")}</b>. Add a list with those headings.
				</Notice>
			)}

			{typing && (
				<div
					className={`wf-paste${over ? " wf-drop-over" : ""}`}
					onDragOver={(e) => {
						e.preventDefault();
						setOver(true);
					}}
					onDragLeave={() => setOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						setOver(false);
						const file = e.dataTransfer.files[0];
						if (file) openFile(file);
					}}
				>
					<label className="wf-label" htmlFor={pasteId}>
						Paste your names, or drop a spreadsheet here
					</label>
					<textarea
						id={pasteId}
						className="wf-input"
						rows={source ? 4 : 7}
						placeholder={"Nguyễn Văn An\nTrần Thị Bích Ngọc\nLê Hoàng Minh Châu"}
						value={paste}
						onChange={(e) => onPaste(e.target.value)}
					/>
					<p className="wf-hint">One name per line, or copy cells from Excel or Google Sheets. Excel, CSV and Numbers files work too.</p>
				</div>
			)}

			{!source && (
				<p className="wf-or">
					Or <Button variant="link" onClick={chooseFile}>choose a spreadsheet file</Button>
					{!expectedColumns.length && (
						<>
							{" "}
							· <Button variant="link" onClick={() => onSource(sampleSource())}>try sample names</Button>
						</>
					)}
				</p>
			)}

			{source && table && (
				<>
					<p>
						<b>{names(rows)}</b>
						<span className="wf-muted"> from {source.name}</span>
						{source.sheets && source.sheets.length > 1 && <span className="wf-muted"> · {source.sheet}</span>}
					</p>
					{rows > 0 && (
						<div className="wf-table">
							<table>
								<thead>
									<tr>
										<th scope="col">No.</th>
										{table.columns.map((c) => (
											<th key={c} scope="col">
												{c}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
										<tr key={i} aria-selected={i === previewRow} onClick={() => onPreviewRow(i)} title="Show this name on the design">
											<td>{i + 1}</td>
											{table.columns.map((c) => (
												<td key={c}>{r[c]}</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
							{rows > PREVIEW_ROWS && (
								<p className="wf-table-more">and {(rows - PREVIEW_ROWS).toLocaleString("en-US")} more. Every one gets a card.</p>
							)}
						</div>
					)}
					{rows === 0 && <p className="wf-hint">There are no names under the headings yet.</p>}
					{showHeadings && headingsSwitch}
					{source.sheets && source.sheets.length > 1 && (
						<Select
							label="Sheet"
							value={source.sheet ?? ""}
							options={source.sheets.map((s) => ({ value: s, label: s }))}
							onChange={switchSheet}
						/>
					)}
					{(source.kind === "paste" || !showHeadings) &&
						(tweaking ? (
							<div className="wf-tweaks">
								{source.kind === "paste" && (
									<Select
										label="How the names are split"
										value={delimiter}
										onChange={(v) => onDelimiter(v as Delimiter)}
										options={[
											{ value: "auto", label: `Work it out (${resolvePasteDelimiter(paste, "auto") === "tab" ? "spreadsheet cells" : "one per line"})` },
											{ value: "line", label: "One name per line" },
											{ value: "tab", label: "Cells copied from a spreadsheet" },
											{ value: "comma", label: "Commas" },
											{ value: "semicolon", label: "Semicolons" },
										]}
									/>
								)}
								{!showHeadings && headingsSwitch}
							</div>
						) : (
							<p className="wf-or">
								<Button variant="link" onClick={() => setTweaking(true)}>
									Looks wrong?
								</Button>
							</p>
						))}
				</>
			)}
		</Section>
	);
}
