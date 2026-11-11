import { useEffect, useId, useRef, useState } from "react";
import { generateAll, type GenerateResult, type Job, type Progress as ProgressInfo } from "../lib/generate";
import { messageOf } from "../lib/errors";
import { useT, type Strings } from "../lib/i18n";
import { formatBytes, formatDuration } from "../lib/text";
import { Button, Dialog, Icon, IconButton, Notice, Progress } from "./ui";

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
				// Nothing downloads by itself: the cards are shown first, and saving is the person's choice.
				setZipUrl(URL.createObjectURL(r.zip));
			})
			.catch((err: unknown) => {
				if (ac.signal.aborted) return;
				console.error(err);
				setError(messageOf(err, t.wentWrong));
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
	const [viewing, setViewing] = useState<number | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const detailsId = useId();
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
					<b title={result.zipName}>{result.zipName}</b>
					<p className="wf-small wf-muted">{t.zipNote(formatBytes(result.zip.size))}</p>
				</div>
				<a className="wf-btn wf-btn-primary wf-btn-lg" href={zipUrl} download={result.zipName}>
					<Icon name="download" size={20} /> {t.downloadAll}
				</a>
			</div>
			{failedRows.length > 0 && (
				<Notice tone="warn">
					{t.cardsFailed(failedRows.length, `${failedRows.slice(0, 8).join(", ")}${failedRows.length > 8 ? "…" : ""}`)}
				</Notice>
			)}
			<ul className="wf-thumbs">
				{thumbs.slice(0, shown).map((thumb, i) => (
					<li key={thumb.name}>
						{/* The card opens large; the corner icon saves just this one. */}
						<button type="button" className="wf-thumb" onClick={() => setViewing(i)} title={t.viewCard(thumb.name)}>
							<img className="wf-thumb-img" src={thumb.url} alt="" loading="lazy" decoding="async" />
							<span className="wf-thumb-name">{thumb.name}</span>
						</button>
						<a className="wf-thumb-save" href={thumb.url} download={thumb.name} title={t.saveCard(thumb.name)} aria-label={t.saveCard(thumb.name)}>
							<Icon name="download" size={16} />
						</a>
					</li>
				))}
			</ul>
			{thumbs.length > shown && (
				<Button variant="ghost" style={{ alignSelf: "center" }} onClick={() => setShown((s) => s + PAGE)}>
					{t.showMore(thumbs.length - shown)}
				</Button>
			)}
			{viewing !== null && thumbs[viewing] && (
				<Viewer cards={thumbs} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
			)}
			{/* Details and the way back share a row; opened, the details run the full width under it. */}
			<div className="wf-dialog-actions">
				<Button
					variant="ghost"
					className="wf-details-toggle"
					iconRight="chevronDown"
					aria-expanded={detailsOpen}
					aria-controls={detailsId}
					onClick={() => setDetailsOpen((o) => !o)}
				>
					{t.details}
				</Button>
				<Button onClick={onClose}>{t.backToEditing}</Button>
			</div>
			{detailsOpen && (
				<div className="wf-details" id={detailsId}>
					<dl className="wf-stats">
						<dt>{t.statSize}</dt>
						<dd>
							{result.width} × {result.height} px
						</dd>
						<dt>{t.statZip}</dt>
						<dd>{formatBytes(result.zip.size)}</dd>
						<dt>{t.statEach}</dt>
						<dd>{t.eachCard(formatBytes(avg), saved)}</dd>
						<dt>{t.statTook}</dt>
						<dd>{formatDuration(result.elapsedMs)}</dd>
					</dl>
					<p className="wf-small wf-muted">{t.manifestNote}</p>
				</div>
			)}
		</>
	);
}

/** One card at full size, over everything. Arrow keys step through the cards; Escape goes back to all of them. */
function Viewer({
	cards,
	index,
	onIndex,
	onClose,
}: {
	cards: { name: string; url: string }[];
	index: number;
	onIndex(i: number): void;
	onClose(): void;
}) {
	const t = useT();
	const ref = useRef<HTMLDialogElement>(null);
	const card = cards[index];
	const prev = index > 0 ? () => onIndex(index - 1) : undefined;
	const next = index < cards.length - 1 ? () => onIndex(index + 1) : undefined;

	// Its own modal, so it sits above the cards dialog and takes the keyboard while open.
	useEffect(() => {
		const d = ref.current;
		if (d && !d.open) d.showModal();
		return () => d?.close();
	}, []);

	// At the first or last card an arrow button disappears from under the keyboard; the viewer takes it back.
	useEffect(() => {
		if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
	}, [index]);

	return (
		<dialog
			ref={ref}
			className="wf-viewer"
			tabIndex={-1}
			aria-label={card.name}
			onCancel={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") prev?.();
				else if (e.key === "ArrowRight") next?.();
			}}
			// A click on the dark space around the card closes it, like most photo viewers.
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<header className="wf-viewer-head">
				<span className="wf-viewer-name">
					<b>{card.name}</b>
					<span className="wf-meta">{t.nOfM(index + 1, cards.length)}</span>
				</span>
				<a className="wf-btn wf-btn-primary" href={card.url} download={card.name}>
					<Icon name="download" size={18} /> {t.downloadCard}
				</a>
				<IconButton icon="x" label={t.close} onClick={onClose} />
			</header>
			<div className="wf-viewer-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
				<img src={card.url} alt={card.name} />
				{prev && <IconButton className="wf-viewer-nav wf-viewer-prev" icon="left" label={t.prevCard} onClick={prev} />}
				{next && <IconButton className="wf-viewer-nav wf-viewer-next" icon="right" label={t.nextCard} onClick={next} />}
			</div>
		</dialog>
	);
}
