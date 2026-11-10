import { useEffect, useMemo, useRef, useState } from "react";
import { codecFor, describeCodec, EXTENSION } from "../lib/codec";
import { outputSize } from "../lib/render";
import { buildFilenames, formatBytes, ROW_NUMBER } from "../lib/text";
import type { Compression, OutputFormat, OutputSettings, Table, TemplateImage } from "../types";
import { Icon, Segmented, Switch } from "./ui";

const EDGES = [3000, 2400, 2048, 1600, 1280, 1080];

export function OutputPanel({
	output,
	image,
	table,
	onChange,
	onTest,
}: {
	output: OutputSettings;
	image: TemplateImage | null;
	table: Table | null;
	onChange(next: OutputSettings): void;
	onTest(): Promise<Blob>;
}) {
	const set = (patch: Partial<OutputSettings>) => onChange({ ...output, ...patch });
	const [test, setTest] = useState<{ blob: Blob; url: string } | { error: string } | "running" | null>(null);
	const patternRef = useRef<HTMLInputElement>(null);

	const longest = image ? Math.max(image.width, image.height) : 0;
	const size = image ? outputSize(image.width, image.height, output.maxEdge) : null;
	const codec = codecFor(output.format, output.compression);

	const example = useMemo(() => {
		if (!table?.rows.length) return null;
		return buildFilenames(output.filenamePattern, table.rows, table.columns, EXTENSION[output.format], output.asciiFilenames)[0];
	}, [output, table]);

	// A test result is stale as soon as any setting changes.
	useEffect(() => {
		setTest((t) => {
			if (t && typeof t === "object" && "url" in t) URL.revokeObjectURL(t.url);
			return null;
		});
	}, [output.format, output.compression, output.maxEdge, output.background, image]);

	const runTest = async () => {
		setTest("running");
		try {
			const blob = await onTest();
			setTest({ blob, url: URL.createObjectURL(blob) });
		} catch (err) {
			setTest({ error: err instanceof Error ? err.message : "Test failed" });
		}
	};

	const insert = (token: string) => {
		const el = patternRef.current;
		const start = el?.selectionStart ?? output.filenamePattern.length;
		const end = el?.selectionEnd ?? output.filenamePattern.length;
		set({ filenamePattern: output.filenamePattern.slice(0, start) + token + output.filenamePattern.slice(end) });
	};

	return (
		<div className="output">
			<div className="group">
				<span className="label">Format</span>
				<Segmented<OutputFormat>
					label="Format"
					value={output.format}
					options={[
						{ value: "jpeg", label: "JPEG", title: "Best for photos and sharing on Zalo, Messenger, email" },
						{ value: "png", label: "PNG", title: "Flat graphics, transparency" },
						{ value: "webp", label: "WebP", title: "Smallest files, modern apps and the web" },
					]}
					onChange={(format) => set({ format })}
				/>
			</div>
			<div className="group">
				<span className="label">Compression</span>
				<Segmented<Compression>
					label="Compression"
					value={output.compression}
					options={[
						{ value: "small", label: "Smaller" },
						{ value: "balanced", label: "Balanced" },
						{ value: "high", label: "Best quality" },
					]}
					onChange={(compression) => set({ compression })}
				/>
				<p className="muted small">{describeCodec(codec)}. Metadata is stripped.</p>
			</div>

			<label className="stack">
				<span className="label">Size</span>
				<select
					value={output.maxEdge ?? ""}
					onChange={(e) => set({ maxEdge: e.target.value ? Number(e.target.value) : null })}
					disabled={!image}
				>
					<option value="">Original{image ? ` (${image.width} × ${image.height})` : ""}</option>
					{EDGES.filter((e) => e < longest).map((e) => {
						const s = image ? outputSize(image.width, image.height, e) : null;
						return (
							<option key={e} value={e}>
								{e}px longest side{s ? ` (${s.width} × ${s.height})` : ""}
							</option>
						);
					})}
				</select>
				{size && output.maxEdge && <span className="muted small">Downscaling is the biggest saving for chat apps.</span>}
			</label>

			{output.format === "jpeg" && image?.hasAlpha && (
				<label className="row">
					<span className="muted small">JPEG has no transparency. Fill with</span>
					<input type="color" value={output.background} onChange={(e) => set({ background: e.target.value })} aria-label="Background color" />
				</label>
			)}

			<label className="stack">
				<span className="label">File names</span>
				<input
					ref={patternRef}
					value={output.filenamePattern}
					onChange={(e) => set({ filenamePattern: e.target.value })}
					spellCheck={false}
				/>
			</label>
			<div className="tokens">
				<button type="button" className="token" onClick={() => insert(`{${ROW_NUMBER}}`)}>
					{"{#}"}
				</button>
				{(table?.columns ?? []).map((c) => (
					<button key={c} type="button" className="token" onClick={() => insert(`{${c}}`)}>
						{`{${c}}`}
					</button>
				))}
			</div>
			{example && (
				<p className="small">
					<span className="muted">Example:</span> <code>{example}</code>
				</p>
			)}
			<Switch
				checked={output.asciiFilenames}
				onChange={(asciiFilenames) => set({ asciiFilenames })}
				label="Remove accents from file names"
				hint="Nguyễn → Nguyen. Safer for old Windows tools and some servers."
			/>

			<div className="test">
				<button type="button" className="btn ghost" onClick={runTest} disabled={!image || test === "running"}>
					<Icon name="sparkle" /> {test === "running" ? "Encoding one card..." : "Test one card"}
				</button>
				{test && typeof test === "object" && "url" in test && (
					<span className="small">
						<b>{formatBytes(test.blob.size)}</b> per card
						{table && table.rows.length > 1 && <span className="muted"> · about {formatBytes(test.blob.size * table.rows.length)} total</span>} ·{" "}
						<a href={test.url} target="_blank" rel="noreferrer">
							Open
						</a>
					</span>
				)}
				{test && typeof test === "object" && "error" in test && <span className="warn small">{test.error}</span>}
			</div>
		</div>
	);
}
