import { useId, useState } from "react";
import { guessHasHeader, readSpreadsheet, resolvePasteDelimiter, sampleSource, type Delimiter } from "../lib/data";
import { EXAMPLE } from "../lib/example";
import { useLang, useT } from "../lib/i18n";
import type { DataSource, Table } from "../types";
import { Button, Notice, pickFile, Section, Select, Switch } from "./ui";

const PREVIEW_ROWS = 200;
const SPREADSHEETS = ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv";


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
	const t = useT();
	const [lang] = useLang();
	const pasteId = useId();
	const [over, setOver] = useState(false);
	const [tweaking, setTweaking] = useState(false);
	const typing = !source || source.kind === "paste";

	const openFile = async (file: File) => {
		onBusy(t.readingList);
		try {
			const wb = await readSpreadsheet(file);
			const sheets = wb.sheets.filter((s) => wb.read(s).length);
			const sheet = sheets[0] ?? wb.sheets[0];
			const grid = wb.read(sheet);
			if (!grid.length) throw new Error(t.fileNoNames);
			onPaste("");
			onSource({ kind: "file", name: file.name, grid, hasHeader: guessHasHeader(grid, "file"), sheets, sheet, readSheet: wb.read });
		} catch (err) {
			onError(err instanceof Error ? err.message : t.couldntReadFile);
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
		<Switch checked={source.hasHeader} onChange={(hasHeader) => onSource({ ...source, hasHeader })} label={t.headings} />
	);
	const showHeadings = !!source && ((table?.columns.length ?? 0) > 1 || source.hasHeader);

	return (
		<Section
			title={t.namesTitle}
			aside={
				source && source.kind !== "paste" ? (
					<Button size="sm" onClick={clear}>
						{t.replaceList}
					</Button>
				) : source ? (
					<Button size="sm" variant="ghost" onClick={clear}>
						{t.clear}
					</Button>
				) : null
			}
		>
			{!source && expectedColumns.length > 0 && (
				<Notice>
					{t.layoutUses(expectedColumns)}
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
						{t.pasteLabel}
					</label>
					<textarea
						id={pasteId}
						className="wf-input"
						rows={source ? 4 : 7}
						placeholder={EXAMPLE[lang].showcase.slice(0, 3).join("\n")}
						value={paste}
						onChange={(e) => onPaste(e.target.value)}
					/>
					<p className="wf-hint">{t.pasteHint}</p>
				</div>
			)}

			{!source && (
				<p className="wf-or">
					{t.or}{" "}
					<Button variant="link" onClick={chooseFile}>
						{t.chooseSpreadsheet}
					</Button>
					{!expectedColumns.length && (
						<>
							{" "}
							·{" "}
							<Button variant="link" onClick={() => onSource(sampleSource())}>
								{t.trySampleNames}
							</Button>
						</>
					)}
				</p>
			)}

			{source && table && (
				<>
					<p>
						<b>{t.nameCount(rows)}</b>
						<span className="wf-muted">
							{" "}
							{t.from} {source.kind === "paste" ? t.pastedList : source.kind === "sample" ? t.sampleList : source.name}
						</span>
						{source.sheets && source.sheets.length > 1 && <span className="wf-muted"> · {source.sheet}</span>}
					</p>
					{rows > 0 && (
						<div className="wf-table">
							<table>
								<thead>
									<tr>
										<th scope="col">{t.rowNo}</th>
										{table.columns.map((c) => (
											<th key={c} scope="col">
												{c}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
										<tr key={i} aria-selected={i === previewRow} onClick={() => onPreviewRow(i)} title={t.showThisName}>
											<td>{i + 1}</td>
											{table.columns.map((c) => (
												<td key={c}>{r[c]}</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
							{rows > PREVIEW_ROWS && (
								<p className="wf-table-more">{t.andMore(rows - PREVIEW_ROWS)}</p>
							)}
						</div>
					)}
					{rows === 0 && <p className="wf-hint">{t.noNamesYet}</p>}
					{showHeadings && headingsSwitch}
					{source.sheets && source.sheets.length > 1 && (
						<Select
							label={t.sheet}
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
										label={t.howSplit}
										value={delimiter}
										onChange={(v) => onDelimiter(v as Delimiter)}
										options={[
											{ value: "auto", label: t.workItOut(resolvePasteDelimiter(paste, "auto") === "tab") },
											{ value: "line", label: t.splitLine },
											{ value: "tab", label: t.splitTab },
											{ value: "comma", label: t.splitComma },
											{ value: "semicolon", label: t.splitSemicolon },
										]}
									/>
								)}
								{!showHeadings && headingsSwitch}
							</div>
						) : (
							<p className="wf-or">
								<Button variant="link" onClick={() => setTweaking(true)}>
									{t.looksWrong}
								</Button>
							</p>
						))}
				</>
			)}
		</Section>
	);
}
