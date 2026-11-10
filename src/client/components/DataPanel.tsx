import { useEffect, useRef, useState } from "react";
import { guessHasHeader, parseDelimited, readSpreadsheet, resolvePasteDelimiter, sampleSource, type Delimiter, type Workbook } from "../lib/data";
import type { DataSource, Table } from "../types";
import { FileDrop, Icon, Segmented, Switch } from "./ui";

const PREVIEW_ROWS = 200;

export function DataPanel({
	source,
	table,
	previewRow,
	expectedColumns,
	onSource,
	onPreviewRow,
	onError,
}: {
	source: DataSource | null;
	table: Table | null;
	previewRow: number;
	expectedColumns: string[];
	onSource(next: DataSource | null): void;
	onPreviewRow(i: number): void;
	onError(message: string): void;
}) {
	const [tab, setTab] = useState<"file" | "paste">(source?.kind === "file" ? "file" : "paste");
	const [paste, setPaste] = useState("");
	const [delimiter, setDelimiter] = useState<Delimiter>("auto");
	const [loading, setLoading] = useState(false);
	const workbook = useRef<Workbook | null>(null);

	// Re-parse pasted text as it changes.
	useEffect(() => {
		if (tab !== "paste") return;
		const t = setTimeout(() => {
			if (!paste.trim()) {
				if (source?.kind === "paste") onSource(null);
				return;
			}
			const grid = parseDelimited(paste, delimiter);
			const hasHeader = source?.kind === "paste" ? source.hasHeader : guessHasHeader(grid, "paste");
			onSource({ kind: "paste", name: "Pasted list", grid, hasHeader });
		}, 200);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paste, delimiter, tab]);

	const openFile = async (file: File) => {
		setLoading(true);
		try {
			const wb = await readSpreadsheet(file);
			workbook.current = wb;
			const sheet = wb.sheets.find((s) => wb.read(s).length) ?? wb.sheets[0];
			const grid = wb.read(sheet);
			if (!grid.length) throw new Error("That file has no rows.");
			onSource({
				kind: "file",
				name: file.name,
				grid,
				hasHeader: guessHasHeader(grid, "file"),
				sheets: wb.sheets,
				sheet,
			});
		} catch (err) {
			onError(err instanceof Error ? err.message : "Couldn't read that file.");
		} finally {
			setLoading(false);
		}
	};

	const switchSheet = (sheet: string) => {
		if (!source || !workbook.current) return;
		const grid = workbook.current.read(sheet);
		onSource({ ...source, sheet, grid, hasHeader: guessHasHeader(grid, "file") });
	};

	const resolved = resolvePasteDelimiter(paste, delimiter);

	return (
		<div className="data">
			<Segmented
				label="List source"
				value={tab}
				options={[
					{ value: "paste", label: "Paste names" },
					{ value: "file", label: "Upload file" },
				]}
				onChange={setTab}
			/>

			{tab === "file" ? (
				<FileDrop
					accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv"
					onFile={openFile}
					label="Upload a spreadsheet"
					className="drop-compact"
				>
					<Icon name="table" size={20} />
					<span>
						<b>{loading ? "Reading..." : source?.kind === "file" ? `Replace ${source.name}` : "Drop a spreadsheet"}</b>
						<small>Excel, Google Sheets or Numbers file. One row per person.</small>
					</span>
				</FileDrop>
			) : (
				<div className="paste">
					<textarea
						rows={6}
						placeholder={"One name per line, or paste cells from Excel / Google Sheets\n\nNguyễn Văn An\nTrần Thị Bích Ngọc"}
						value={paste}
						onChange={(e) => setPaste(e.target.value)}
						aria-label="Paste your list"
					/>
					<div className="row">
						<label className="inline-select">
							<span className="muted small">Columns split by</span>
							<select value={delimiter} onChange={(e) => setDelimiter(e.target.value as Delimiter)}>
								<option value="auto">Auto ({resolved === "tab" ? "tabs" : "one per line"})</option>
								<option value="tab">Tabs (from a spreadsheet)</option>
								<option value="comma">Commas</option>
								<option value="semicolon">Semicolons</option>
								<option value="line">Nothing, one value per line</option>
							</select>
						</label>
					</div>
				</div>
			)}

			{!source && (
				<p className="muted small">
					{expectedColumns.length ? (
						<>
							This template expects columns <b>{expectedColumns.map((c) => `{${c}}`).join(", ")}</b>.{" "}
						</>
					) : null}
					No list yet?{" "}
					<button type="button" className="link" onClick={() => onSource(sampleSource())}>
						Try sample names
					</button>
				</p>
			)}

			{source && table && (
				<>
					<div className="data-summary">
						<span>
							<b>{table.rows.length.toLocaleString("en-US")}</b> {table.rows.length === 1 ? "row" : "rows"} ·{" "}
							{table.columns.length} {table.columns.length === 1 ? "column" : "columns"}
							<span className="muted"> · {source.name}</span>
						</span>
						<button type="button" className="icon-btn" aria-label="Clear list" title="Clear list" onClick={() => onSource(null)}>
							<Icon name="x" size={14} />
						</button>
					</div>
					<div className="row wrap">
						<Switch
							checked={source.hasHeader}
							onChange={(hasHeader) => onSource({ ...source, hasHeader })}
							label="First row is column names"
						/>
						{source.sheets && source.sheets.length > 1 && (
							<select aria-label="Sheet" value={source.sheet} onChange={(e) => switchSheet(e.target.value)}>
								{source.sheets.map((s) => (
									<option key={s}>{s}</option>
								))}
							</select>
						)}
					</div>
					<div className="table-wrap">
						<table>
							<thead>
								<tr>
									<th>#</th>
									{table.columns.map((c) => (
										<th key={c}>{c}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
									<tr
										key={i}
										className={i === previewRow ? "current" : ""}
										onClick={() => onPreviewRow(i)}
										title="Preview this row"
									>
										<td>{i + 1}</td>
										{table.columns.map((c) => (
											<td key={c}>{r[c]}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
						{table.rows.length > PREVIEW_ROWS && (
							<p className="muted small table-more">
								+ {(table.rows.length - PREVIEW_ROWS).toLocaleString("en-US")} more rows (all will be generated)
							</p>
						)}
					</div>
				</>
			)}
		</div>
	);
}
