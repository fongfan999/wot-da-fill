import { useEffect, useRef, useState } from "react";
import { generateAll, type GenerateResult, type Job, type Progress as ProgressInfo } from "../lib/generate";
import { formatBytes, formatDuration } from "../lib/text";
import { Button, Dialog, Icon, Notice, Progress } from "./ui";

type Params = Omit<Job, "signal" | "onProgress">;

const PAGE = 60;
const count = (n: number) => n.toLocaleString("en-US");

export function GenerateDialog({ params, onClose }: { params: Params; onClose(): void }) {
	const [progress, setProgress] = useState<ProgressInfo | null>(null);
	const [result, setResult] = useState<GenerateResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [zipUrl, setZipUrl] = useState<string | null>(null);
	const controller = useRef<AbortController | null>(null);

	useEffect(() => {
		const ac = new AbortController();
		controller.current = ac;
		generateAll({ ...params, signal: ac.signal, onProgress: setProgress })
			.then((r) => {
				setResult(r);
				const url = URL.createObjectURL(r.zip);
				setZipUrl(url);
				download(url, r.zipName);
			})
			.catch((err: unknown) => {
				if (ac.signal.aborted) return;
				console.error(err);
				setError(err instanceof Error ? err.message : "Something went wrong.");
			});
		return () => ac.abort();
		// Runs once per dialog; params are fixed for its lifetime.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => () => void (zipUrl && URL.revokeObjectURL(zipUrl)), [zipUrl]);

	const running = !result && !error;
	const close = () => {
		if (running && !confirm("Stop making the cards? The ones made so far will be thrown away.")) return;
		controller.current?.abort();
		onClose();
	};

	// Keep the page from being closed by accident mid-run.
	useEffect(() => {
		if (!running) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [running]);

	const total = params.table.rows.length;
	const title = error ? "The cards weren't made" : result ? `Your ${count(result.files.length)} ${result.files.length === 1 ? "card is" : "cards are"} ready` : "Making your cards";

	return (
		<Dialog title={title} onClose={close} closeLabel={running ? "Stop" : "Close"} width={result ? 760 : 520}>
			{running && <Running progress={progress} total={total} />}
			{error && (
				<>
					<Notice tone="warn">{error}</Notice>
					<div className="wf-actions">
						<Button onClick={close}>Back to editing</Button>
					</div>
				</>
			)}
			{result && zipUrl && <Done result={result} zipUrl={zipUrl} templateSize={params.template.size} onClose={close} />}
		</Dialog>
	);
}

function timeLeft(ms: number): string {
	const s = ms / 1000;
	if (s < 5) return "almost done";
	if (s < 60) return `about ${Math.ceil(s / 5) * 5} seconds left`;
	const m = Math.round(s / 60);
	return m <= 1 ? "about a minute left" : `about ${m} minutes left`;
}

function Running({ progress, total }: { progress: ProgressInfo | null; total: number }) {
	const [now, setNow] = useState(() => performance.now());
	useEffect(() => {
		const t = setInterval(() => setNow(performance.now()), 500);
		return () => clearInterval(t);
	}, []);

	const phase = progress?.phase ?? "fonts";
	const done = progress?.done ?? 0;
	const elapsed = progress ? now - progress.startedAt : 0;
	const zipPct = progress?.zipTotal ? (progress.zipWritten ?? 0) / progress.zipTotal : 0;
	// Cards are nearly all the work; zipping is a fast copy.
	const value = phase === "fonts" ? 0 : phase === "render" ? (done / total) * 0.97 : 0.97 + zipPct * 0.03;
	const rate = done > 0 ? done / (elapsed / 1000) : 0;
	const label =
		phase === "fonts"
			? "Getting the fonts ready"
			: phase === "render"
				? `Making your cards${rate > 0 && done >= 3 ? `, ${timeLeft(((total - done) / rate) * 1000)}` : ""}`
				: "Putting them in one zip";

	return (
		<>
			<Progress value={value} label={label} detail={`${count(Math.min(done, total))} of ${count(total)}`} />
			<p className="wf-small wf-muted">Everything happens in this browser tab. Your list never leaves this device.</p>
		</>
	);
}

function Done({ result, zipUrl, templateSize, onClose }: { result: GenerateResult; zipUrl: string; templateSize: number; onClose(): void }) {
	const [shown, setShown] = useState(PAGE);
	// Object URLs are created and revoked by the same effect so StrictMode's re-run can't leave dead links.
	const [thumbs, setThumbs] = useState<(GenerateResult["files"][number] & { url: string })[]>([]);
	useEffect(() => {
		const next = result.files.map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }));
		setThumbs(next);
		return () => next.forEach((t) => URL.revokeObjectURL(t.url));
	}, [result]);

	const avg = result.files.length ? result.totalBytes / result.files.length : 0;
	const saved = templateSize > 0 ? Math.round((1 - avg / templateSize) * 100) : 0;
	const failedRows = result.failed.map((f) => f.row + 1);

	return (
		<>
			<div className="wf-ready">
				<div>
					<b>{result.zipName}</b>
					<p className="wf-small wf-muted">The download started by itself. Look in your Downloads folder.</p>
				</div>
				<a className="wf-btn wf-btn-primary wf-btn-lg" href={zipUrl} download={result.zipName}>
					<Icon name="download" size={20} /> Download again
				</a>
			</div>
			{failedRows.length > 0 && (
				<Notice tone="warn">
					<b>
						{failedRows.length} {failedRows.length === 1 ? "card" : "cards"} couldn't be made
					</b>{" "}
					(number {failedRows.slice(0, 8).join(", ")}
					{failedRows.length > 8 ? "…" : ""}). The zip has all the others.
				</Notice>
			)}
			<ul className="wf-thumbs">
				{thumbs.slice(0, shown).map((t) => (
					<li key={t.name}>
						<a className="wf-thumb" href={t.url} download={t.name} title={`Save ${t.name}`}>
							<img className="wf-thumb-img" src={t.url} alt="" loading="lazy" decoding="async" />
							<span className="wf-thumb-name">{t.name}</span>
						</a>
					</li>
				))}
			</ul>
			{thumbs.length > shown && (
				<Button variant="ghost" style={{ alignSelf: "center" }} onClick={() => setShown((s) => s + PAGE)}>
					Show more ({count(thumbs.length - shown)} left)
				</Button>
			)}
			<div className="wf-dialog-actions">
				<details className="wf-details">
					<summary>
						Details <Icon name="chevronDown" size={16} />
					</summary>
					<dl className="wf-stats">
						<div>
							<dt>Cards</dt>
							<dd>
								{count(result.files.length)} · {result.width} × {result.height}px
							</dd>
						</div>
						<div>
							<dt>Zip</dt>
							<dd>{formatBytes(result.zip.size)}</dd>
						</div>
						<div>
							<dt>Each card</dt>
							<dd>
								about {formatBytes(avg)}
								{saved > 0 ? `, ${saved}% smaller than your design` : ""}
							</dd>
						</div>
						<div>
							<dt>Took</dt>
							<dd>{formatDuration(result.elapsedMs)}</dd>
						</div>
					</dl>
					<p className="wf-small wf-muted" style={{ marginTop: 12 }}>
						The zip also has _manifest.csv, which says which file belongs to which name.
					</p>
				</details>
				<Button onClick={onClose}>Back to editing</Button>
			</div>
		</>
	);
}

function download(url: string, name: string) {
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
}
