import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EXAMPLE, EXAMPLE_KINDS, exampleExtra, type ExampleKind } from "../lib/example";
import { useLang, useT, type Lang } from "../lib/i18n";
import { getShowcase, type Showcase } from "../lib/showcase";
import { Button, FileDrop, Icon, GitHubLink, LangSwitch, MadeBy, ProductMark, Segmented, ThemeSwitch, type IconName } from "./ui";

const IMAGES = "image/jpeg,image/png,image/webp";
const FACT_ICONS: IconName[] = ["people", "ruler", "download"];
/** How long each name stays before the next one settles onto the card. */
const STEP_MS = 900;
/** How long one example takes to give way to the next. */
const SWAP_MS = 480;

/**
 * The home page (design system HomeScreen): what the product does, how little it takes, and the
 * way in, all in the first view. Anyone without a design sees it; a picture dropped anywhere on
 * the page, the drop zone, or one of the examples leaves it for the editor. The language switch
 * in its bar changes the whole site, the examples included.
 */
export function HomePage({ onFile, onExample }: { onFile(file: File): void; onExample(kind: ExampleKind): void }) {
	const t = useT();
	const h = t.home;
	const [lang] = useLang();
	const [over, setOver] = useState(false);
	// The example on show in the hero; "Try an example" in the bar opens this one.
	const [kind, setKind] = useState<ExampleKind>("invitation");
	const names = EXAMPLE[lang].names;

	return (
		<div
			className={`wf-home${over ? " wf-drop-over" : ""}`}
			onDragOver={(e) => {
				if (![...e.dataTransfer.types].includes("Files")) return;
				e.preventDefault();
				setOver(true);
			}}
			onDragLeave={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
			}}
			onDrop={(e) => {
				e.preventDefault();
				setOver(false);
				const file = e.dataTransfer.files[0];
				if (file) onFile(file);
			}}
		>
			<header className="wf-home-wrap wf-home-bar">
				<ProductMark />
				<div className="wf-home-bar-end">
					<LangSwitch />
					<ThemeSwitch />
					<GitHubLink />
					<Button variant="ghost" onClick={() => onExample(kind)}>
						{h.tryExample}
					</Button>
				</div>
			</header>
			<main>
				<section className="wf-home-wrap wf-home-hero">
					<div className="wf-home-copy">
						<h1 className="wf-home-title">
							{h.title((word) => (
								<span className="wf-serif">{word}</span>
							))}
						</h1>
						<p className="wf-home-lead">{h.lead}</p>
						<FileDrop accept={IMAGES} onFile={onFile} label={h.addDesign} className="wf-drop-home">
							<span className="wf-drop-icon">
								<Icon name="image" size={28} />
							</span>
							<span className="wf-drop-text">
								<span className="wf-drop-title">{h.dropTitle}</span>
								<span className="wf-drop-hint">{h.dropHint}</span>
							</span>
							<span className="wf-btn wf-btn-primary wf-btn-lg">
								<Icon name="upload" size={20} /> {h.choosePicture}
							</span>
						</FileDrop>
						<ul className="wf-home-ticks">
							{h.ticks.map((tick) => (
								<li key={tick}>
									<Icon name="check" size={16} />
									{tick}
								</li>
							))}
						</ul>
					</div>
					<ExampleDemo lang={lang} kind={kind} onKind={setKind} />
				</section>

				<section className="wf-home-wrap wf-home-section">
					<h2 className="wf-home-h2">{h.stepsTitle}</h2>
					<ol className="wf-home-steps">
						<Step
							n={1}
							title={h.step1}
							art={
								<ExamplePic lang={lang} kind="invitation" width="78%">
									<div className="wf-box" style={{ left: "14%", top: "38%", width: "72%", height: "15%", cursor: "default" }}>
										<span className="wf-box-tag">{h.nameGoesHere}</span>
									</div>
								</ExamplePic>
							}
						>
							{h.step1Text}
						</Step>
						<Step n={2} title={h.step2} art={<NameList names={names} lang={lang} />}>
							{h.step2Text}
						</Step>
						<Step
							n={3}
							title={h.step3}
							art={
								<div className="wf-stack">
									<ExamplePic lang={lang} kind="certificate" width="62%" row={1} />
									<ExamplePic lang={lang} kind="invitation" width="62%" row={0} />
									<ExamplePic lang={lang} kind="badge" width="29%" row={2} />
								</div>
							}
						>
							{h.step3Text}
						</Step>
					</ol>
				</section>

				<section className="wf-home-wrap wf-home-section">
					<h2 className="wf-home-h2">{h.trustTitle}</h2>
					<dl className="wf-home-facts">
						{h.facts.map(([title, text], k) => (
							<Fact key={k} icon={FACT_ICONS[k]} title={title}>
								{text}
							</Fact>
						))}
					</dl>
				</section>

				<section className="wf-home-wrap wf-home-section wf-home-end">
					<h2 className="wf-home-h2">{h.endTitle}</h2>
					<p>{h.endText}</p>
					<ul className="wf-home-picks">
						{EXAMPLE_KINDS.map((k, i) => (
							<li key={k}>
								<button type="button" className="wf-pick" onClick={() => onExample(k)}>
									<span className="wf-pick-art">
										<ExamplePic lang={lang} kind={k} width={k === "badge" ? "34%" : "72%"} row={i} />
									</span>
									<span className="wf-pick-label">
										{h.kinds[k]}
										<span>{h.tryIt}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			</main>
			<footer className="wf-home-foot">
				<MadeBy />
			</footer>
		</div>
	);
}

/** The pictures for one example in one language, drawn once and then shared by every picture of it. */
function useShowcase(lang: Lang, kind: ExampleKind): Showcase | null {
	const key = `${lang}:${kind}`;
	const [ready, setReady] = useState<{ key: string; show: Showcase } | null>(null);
	useEffect(() => {
		let alive = true;
		getShowcase(lang, kind)
			.then((show) => alive && setReady({ key, show }))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [key, lang, kind]);
	return ready?.key === key ? ready.show : null;
}

/**
 * One example design as the app draws it: the blank picture, with the name for `row` laid over it
 * (a transparent layer made by the same renderer as the download). `animate` lets a new name rise
 * into place; the design under it never moves.
 */
function ExamplePic({
	lang,
	kind,
	width,
	row,
	animate,
	children,
}: {
	lang: Lang;
	kind: ExampleKind;
	width: CSSProperties["width"];
	row?: number;
	animate?: boolean;
	children?: ReactNode;
}) {
	const show = useShowcase(lang, kind);
	return (
		<div className="wf-expic" data-kind={kind} style={{ width }}>
			{show && <img className="wf-expic-img" src={show.blank} alt="" draggable={false} />}
			{show && row !== undefined && (
				<img key={`${kind}${row}`} className={`wf-expic-img wf-expic-name${animate ? " wf-ex-in" : ""}`} src={show.names[row]} alt="" draggable={false} />
			)}
			{children}
		</div>
	);
}

/**
 * The hero picture (design system ExampleDemo): one example with the name on it changing as the
 * list is stepped through. Every 0.9 seconds the next name is highlighted and settles onto the
 * card; after the last name it moves on to the next example. Picking an example starts its
 * names from the first, and it moves on again after them. It pauses while the pointer is over it and while the tab is hidden, and for anyone
 * who asks for reduced motion it never runs: they see the first name, still.
 */
function ExampleDemo({ lang, kind, onKind }: { lang: Lang; kind: ExampleKind; onKind(kind: ExampleKind): void }) {
	const t = useT();
	const h = t.home;
	const names = EXAMPLE[lang].names;
	const extras = exampleExtra(lang, kind);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const indexRef = useRef(index);
	indexRef.current = index;

	useEffect(() => {
		if (paused) return;
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
		const timer = setInterval(() => {
			if (document.hidden) return;
			const next = indexRef.current + 1;
			if (next < names.length) return setIndex(next);
			setIndex(0);
			onKind(EXAMPLE_KINDS[(EXAMPLE_KINDS.indexOf(kind) + 1) % EXAMPLE_KINDS.length]);
		}, STEP_MS);
		return () => clearInterval(timer);
	}, [kind, lang, paused, names.length, onKind]);

	// Draw all three examples up front, so switching never waits on a blank card.
	useEffect(() => {
		EXAMPLE_KINDS.forEach((k) => getShowcase(lang, k).catch(() => {}));
	}, [lang]);

	// The example being left stays a moment, fading out under the one arriving.
	const [leaving, setLeaving] = useState<{ kind: ExampleKind; row: number } | null>(null);
	const shownKind = useRef(kind);
	const shownRow = useRef(0);
	useEffect(() => {
		if (shownKind.current === kind) return;
		setLeaving({ kind: shownKind.current, row: shownRow.current });
		shownKind.current = kind;
		const timer = setTimeout(() => setLeaving(null), SWAP_MS);
		return () => clearTimeout(timer);
	}, [kind, names.length]);

	const at = index % names.length;
	// Remember which name was on show, for the card that fades out when the example changes.
	useEffect(() => {
		shownRow.current = at;
	}, [at, kind]);
	return (
		<div className="wf-exdemo">
			<div className="wf-exdemo-stage" role="img" aria-label={h.pictureLabel} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
				{leaving && (
					<div key={`out-${leaving.kind}`} className="wf-exdemo-card wf-exdemo-out" data-kind={leaving.kind} aria-hidden="true">
						<ExamplePic lang={lang} kind={leaving.kind} width="100%" row={leaving.row} />
					</div>
				)}
				<div key={kind} className={`wf-exdemo-card${leaving ? " wf-exdemo-in" : ""}`} data-kind={kind}>
					<ExamplePic lang={lang} kind={kind} width="100%" row={at} animate={!leaving} />
				</div>
				<NameList names={names} lang={lang} current={at} extras={kind === "badge" ? extras : null} onPick={setIndex} />
			</div>
			<div className="wf-exdemo-bar">
				<Segmented<ExampleKind>
					label={h.chooseExample}
					value={kind}
					onChange={(k) => {
						onKind(k);
						setIndex(0);
					}}
					options={EXAMPLE_KINDS.map((k) => ({ value: k, label: h.kinds[k] }))}
				/>
			</div>
		</div>
	);
}

function NameList({
	names,
	lang,
	current,
	extras,
	onPick,
}: {
	names: readonly string[];
	lang: Lang;
	current?: number;
	extras?: readonly string[] | null;
	onPick?(i: number): void;
}) {
	return (
		<ol className="wf-namelist" lang={lang} aria-hidden={onPick ? true : undefined}>
			{names.map((n, i) => (
				<li key={n} aria-current={i === current ? "true" : undefined} onClick={onPick && (() => onPick(i))}>
					<span className="wf-meta">{i + 1}</span>
					<span className="wf-namelist-name">{n}</span>
					{extras && <span className="wf-namelist-extra">{extras[i]}</span>}
				</li>
			))}
		</ol>
	);
}

function Step({ n, title, art, children }: { n: number; title: string; art: ReactNode; children: ReactNode }) {
	return (
		<li className="wf-home-step">
			<div className="wf-home-art" aria-hidden="true">
				{art}
			</div>
			<h3>
				<span className="wf-step-dot">{n}</span>
				{title}
			</h3>
			<p>{children}</p>
		</li>
	);
}

function Fact({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
	return (
		<div>
			<dt>
				<Icon name={icon} size={20} />
				{title}
			</dt>
			<dd>{children}</dd>
		</div>
	);
}
