import { useEffect, useRef, useState } from "react";
import { generateAll, type GenerateResult, type Job, type Progress as ProgressInfo } from "../lib/generate";
import { useT, type Strings } from "../lib/i18n";
import { formatBytes, formatDuration } from "../lib/text";
import { Button, Dialog, Icon, Notice, Progress } from "./ui";

type Params = Omit<Job, "signal" | "onProgress">;

const PAGE = 60;

export function GenerateDialog({ params, onClose }: { params: Params; onClose(): void }) {
	const t = useT();
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
				setError(err instanceof Error ? err.message : t.wentWrong);
			});
		return () => ac.abort();
		// Runs once per dialog; params are fixed for its lifetime.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => () => void (zipUrl && URL.revokeObjectURL(zipUrl)), [zipUrl]);

	const running = !result && !error;
	const close = () => {
		if (running && !confirm(t.confirmStop)) return;
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
	const title = error ? t.cardsNotMade : result ? t.cardsReady(result.files.length) : t.makingCards;

	return (
		<Dialog title={title} onClose={close} closeLabel={running ? t.stop : t.close} width={result ? 760 : 520}>
			{running && <Running progress={progress} total={total} />}
			{error && (
				<>
					<Notice tone="warn">{error}</Notice>
					<div className="wf-actions">
						<Button onClick={close}>{t.backToEditing}</Button>
					</div>
				</>
			)}
			{result && zipUrl && <Done result={result} zipUrl={zipUrl} templateSize={params.template.size} onClose={close} />}
		</Dialog>
	);
}

function timeLeft(t: Strings, ms: number): string {
	const s = ms / 1000;
	if (s < 5) return t.almostDone;
	if (s < 60) return t.secondsLeft(Math.ceil(s / 5) * 5);
	const m = Math.round(s / 60);
	return m <= 1 ? t.minuteLeft : t.minutesLeft(m);
}

function Running({ progress, total }: { progress: ProgressInfo | null; total: number }) {
	const t = useT();
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
			? t.gettingFonts
			: phase === "render"
				? `${t.makingCards}${rate > 0 && done >= 3 ? `, ${timeLeft(t, ((total - done) / rate) * 1000)}` : ""}`
				: t.zipping;

	return (
		<>
			<Progress value={value} label={label} detail={t.nOfM(Math.min(done, total), total)} />
			<p className="wf-small wf-muted">{t.privacyRun}</p>
		</>
	);
}

function Done({ result, zipUrl, templateSize, onClose }: { result: GenerateResult; zipUrl: string; templateSize: number; onClose(): void }) {
	const t = useT();
	const [shown, setShown] = useState(PAGE);
	// Object URLs are created and revoked by the same effect so StrictMode's re-run can't leave dead links.
	const [thumbs, setThumbs] = useState<(GenerateResult["files"][number] & { url: string })[]>([]);
	useEffect(() => {
		const next = result.files.map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }));
		setThumbs(next);
		return () => next.forEach((x) => URL.revokeObjectURL(x.url));
	}, [result]);

	const avg = result.files.length ? result.totalBytes / result.files.length : 0;
	const saved = templateSize > 0 ? Math.round((1 - avg / templateSize) * 100) : 0;
	const failedRows = result.failed.map((f) => f.row + 1);

	return (
		<>
			<div className="wf-ready">
				<div>
					<b>{result.zipName}</b>
					<p className="wf-small wf-muted">{t.downloadStarted}</p>
				</div>
				<a className="wf-btn wf-btn-primary wf-btn-lg" href={zipUrl} download={result.zipName}>
					<Icon name="download" size={20} /> {t.downloadAgain}
				</a>
			</div>
			{failedRows.length > 0 && (
				<Notice tone="warn">
					{t.cardsFailed(failedRows.length, `${failedRows.slice(0, 8).join(", ")}${failedRows.length > 8 ? "…" : ""}`)}
				</Notice>
			)}
			<ul className="wf-thumbs">
				{thumbs.slice(0, shown).map((thumb) => (
					<li key={thumb.name}>
						<a className="wf-thumb" href={thumb.url} download={thumb.name} title={t.saveCard(thumb.name)}>
							<img className="wf-thumb-img" src={thumb.url} alt="" loading="lazy" decoding="async" />
							<span className="wf-thumb-name">{thumb.name}</span>
						</a>
					</li>
				))}
			</ul>
			{thumbs.length > shown && (
				<Button variant="ghost" style={{ alignSelf: "center" }} onClick={() => setShown((s) => s + PAGE)}>
					{t.showMore(thumbs.length - shown)}
				</Button>
			)}
			<div className="wf-dialog-actions">
				<details className="wf-details">
					<summary>
						{t.details} <Icon name="chevronDown" size={16} />
					</summary>
					<dl className="wf-stats">
						<div>
							<dt>{t.statCards}</dt>
							<dd>
								{t.num(result.files.length)} · {result.width} × {result.height}px
							</dd>
						</div>
						<div>
							<dt>{t.statZip}</dt>
							<dd>{formatBytes(result.zip.size)}</dd>
						</div>
						<div>
							<dt>{t.statEach}</dt>
							<dd>{t.eachCard(formatBytes(avg), saved)}</dd>
						</div>
						<div>
							<dt>{t.statTook}</dt>
							<dd>{formatDuration(result.elapsedMs)}</dd>
						</div>
					</dl>
					<p className="wf-small wf-muted" style={{ marginTop: 12 }}>
						{t.manifestNote}
					</p>
				</details>
				<Button onClick={onClose}>{t.backToEditing}</Button>
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
