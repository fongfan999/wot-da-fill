import { useEffect, useRef, useState } from "react";
import { generateAll, type GenerateResult, type Job, type Progress } from "../lib/generate";
import { formatBytes, formatDuration } from "../lib/text";
import { Icon } from "./ui";

type Params = Omit<Job, "signal" | "onProgress">;

const PAGE = 60;

export function GenerateDialog({ params, onClose }: { params: Params; onClose(): void }) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [progress, setProgress] = useState<Progress | null>(null);
	const [result, setResult] = useState<GenerateResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [shown, setShown] = useState(PAGE);
	const [zipUrl, setZipUrl] = useState<string | null>(null);
	const controller = useRef<AbortController | null>(null);

	useEffect(() => {
		dialogRef.current?.showModal();
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
		if (running && !confirm("Stop generating? Cards made so far will be discarded.")) return;
		controller.current?.abort();
		dialogRef.current?.close();
		onClose();
	};

	// Keep the page from being closed by accident mid-run.
	useEffect(() => {
		if (!running) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [running]);

	return (
		<dialog
			ref={dialogRef}
			className="dialog generate"
			onCancel={(e) => {
				e.preventDefault();
				close();
			}}
			aria-labelledby="gen-title"
		>
			<header className="dialog-head">
				<h2 id="gen-title">{error ? "Generation stopped" : result ? "Your cards are ready" : "Making your cards"}</h2>
				<button type="button" className="icon-btn" aria-label={running ? "Cancel" : "Close"} onClick={close}>
					<Icon name="x" />
				</button>
			</header>

			{running && <Running progress={progress} templateSize={params.template.size} />}
			{error && (
				<div className="dialog-body">
					<p className="warn">{error}</p>
					<button type="button" className="btn" onClick={close}>
						Back to editing
					</button>
				</div>
			)}
			{result && zipUrl && (
				<Done result={result} zipUrl={zipUrl} templateSize={params.template.size} shown={shown} onMore={() => setShown((s) => s + PAGE)} />
			)}
		</dialog>
	);
}

function Running({ progress, templateSize }: { progress: Progress | null; templateSize: number }) {
	const [now, setNow] = useState(() => performance.now());
	useEffect(() => {
		const t = setInterval(() => setNow(performance.now()), 500);
		return () => clearInterval(t);
	}, []);

	if (!progress) return <div className="dialog-body"><p className="muted">Starting...</p></div>;
	const { phase, done, total, bytes, startedAt } = progress;
	const elapsed = now - startedAt;
	const zipPct = progress.zipTotal ? (progress.zipWritten ?? 0) / progress.zipTotal : 0;
	// Cards are ~97% of the work; zipping is a fast copy.
	const pct = phase === "fonts" ? 0 : phase === "render" ? (done / total) * 0.97 : 0.97 + zipPct * 0.03;
	const rate = done > 0 ? done / (elapsed / 1000) : 0;
	const eta = rate > 0 ? ((total - done) / rate) * 1000 : null;
	const avg = done ? bytes / done : 0;

	const label =
		phase === "fonts" ? "Loading fonts" : phase === "render" ? `Rendering and optimizing card ${Math.min(done + 1, total)} of ${total}` : "Packing the zip";

	return (
		<div className="dialog-body">
			<div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={label}>
				<div className="progress-fill" style={{ transform: `scaleX(${pct})` }} />
			</div>
			<div className="progress-meta">
				<span>{label}</span>
				<b>{Math.floor(pct * 100)}%</b>
			</div>
			<dl className="stats">
				<div>
					<dt>Done</dt>
					<dd>
						{done.toLocaleString("en-US")} / {total.toLocaleString("en-US")}
					</dd>
				</div>
				<div>
					<dt>Speed</dt>
					<dd>{rate ? `${rate.toFixed(rate < 10 ? 1 : 0)} cards/s` : "..."}</dd>
				</div>
				<div>
					<dt>Time left</dt>
					<dd>{phase === "render" && eta != null ? formatDuration(eta) : "..."}</dd>
				</div>
				<div>
					<dt>Avg card</dt>
					<dd>
						{avg ? formatBytes(avg) : "..."}
						{avg > 0 && <Savings before={templateSize} after={avg} />}
					</dd>
				</div>
			</dl>
			<p className="muted small">Everything runs in this browser tab. Your list never leaves your device.</p>
		</div>
	);
}

function Savings({ before, after }: { before: number; after: number }) {
	const delta = (after - before) / before;
	if (!Number.isFinite(delta)) return null;
	return (
		<span className={`savings ${delta <= 0 ? "good" : ""}`} title="Compared with your design file">
			{delta <= 0 ? "-" : "+"}
			{Math.abs(Math.round(delta * 100))}%
		</span>
	);
}

function Done({
	result,
	zipUrl,
	templateSize,
	shown,
	onMore,
}: {
	result: GenerateResult;
	zipUrl: string;
	templateSize: number;
	shown: number;
	onMore(): void;
}) {
	const avg = result.files.length ? result.totalBytes / result.files.length : 0;
	// Object URLs are created and revoked by the same effect so StrictMode's re-run can't leave dead links.
	const [thumbs, setThumbs] = useState<(GenerateResult["files"][number] & { url: string })[]>([]);
	useEffect(() => {
		const next = result.files.map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }));
		setThumbs(next);
		return () => next.forEach((t) => URL.revokeObjectURL(t.url));
	}, [result]);

	return (
		<div className="dialog-body">
			<div className="done-summary">
				<div>
					<p className="big">
						{result.files.length.toLocaleString("en-US")} cards · {formatBytes(result.zip.size)}
					</p>
					<p className="muted small">
						{result.width} × {result.height}px · avg {formatBytes(avg)} per card
						<Savings before={templateSize} after={avg} /> vs. your {formatBytes(templateSize)} design · {formatDuration(result.elapsedMs)}
					</p>
				</div>
				<a className="btn primary" href={zipUrl} download={result.zipName}>
					<Icon name="download" /> Download zip
				</a>
			</div>
			{result.failed.length > 0 && (
				<p className="warn small">
					{result.failed.length} {result.failed.length === 1 ? "row" : "rows"} failed (rows {result.failed.slice(0, 8).map((f) => f.row + 1).join(", ")}
					{result.failed.length > 8 ? "..." : ""}). The zip has everything else.
				</p>
			)}
			<p className="muted small">The download should start by itself. The zip also has _manifest.csv mapping each file to its row.</p>
			<ul className="thumbs">
				{thumbs.slice(0, shown).map((t) => (
					<li key={t.name}>
						<a href={t.url} download={t.name} title={`Download ${t.name}`}>
							<img src={t.url} alt="" loading="lazy" decoding="async" />
							<span className="thumb-name">{t.name}</span>
							<span className="thumb-size">{formatBytes(t.blob.size)}</span>
						</a>
					</li>
				))}
			</ul>
			{thumbs.length > shown && (
				<button type="button" className="btn ghost" onClick={onMore}>
					Show more ({(thumbs.length - shown).toLocaleString("en-US")} left)
				</button>
			)}
		</div>
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
