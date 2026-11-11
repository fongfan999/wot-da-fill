import { useEffect, useState, type ReactNode } from "react";
import { EXAMPLE } from "../lib/example";
import { useLang, useT, type Lang } from "../lib/i18n";
import { getShowcase, type Showcase } from "../lib/showcase";
import { Button, FileDrop, Icon, LangSwitch, MadeBy, ProductMark, type IconName } from "./ui";

const IMAGES = "image/jpeg,image/png,image/webp";
const FACT_ICONS: IconName[] = ["people", "ruler", "font", "download"];

/**
 * The home page (design system HomeScreen): what the product does, how little it takes, and the
 * way in, all in the first view. Anyone without a design sees it; a picture dropped anywhere on
 * the page, the drop zone, or "Try an example" leaves it for the editor. The language switch in its
 * bar changes the whole site, the example invitation included.
 */
export function HomePage({ onFile, onExample }: { onFile(file: File): void; onExample(): void }) {
	const t = useT();
	const h = t.home;
	const [lang] = useLang();
	const [pics, setPics] = useState<{ lang: Lang; pics: Showcase } | null>(null);
	const [over, setOver] = useState(false);

	useEffect(() => {
		let alive = true;
		// Drawn after the page is up, so the first view never waits on fonts.
		getShowcase(lang)
			.then((s) => alive && setPics({ lang, pics: s }))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [lang]);

	// Keep the last language's cards up while the new ones draw, so the picture never goes blank.
	const shown = pics?.pics;
	const names = EXAMPLE[lang].showcase;
	const card = (i: number) => (shown ? <img className="wf-card-pic" src={shown.cards[i]} alt="" /> : <span className="wf-card-pic" />);
	const fan = (withList: boolean, style?: React.CSSProperties) => (
		<div className="wf-fan" aria-hidden="true" style={style}>
			{card(2)}
			{card(1)}
			{card(0)}
			{withList && <NameList names={names} lang={lang} />}
		</div>
	);

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
					<Button variant="ghost" onClick={onExample}>
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
					{fan(true)}
				</section>

				<section className="wf-home-wrap wf-home-section">
					<h2 className="wf-home-h2">{h.stepsTitle}</h2>
					<ol className="wf-home-steps">
						<Step
							n={1}
							title={h.step1}
							art={
								<div className="wf-pic-box">
									{shown ? <img className="wf-card-pic" src={shown.blank} alt="" /> : <span className="wf-card-pic" />}
									<div className="wf-box" style={{ left: "22%", top: "38%", width: "56%", height: "15%", cursor: "default" }}>
										<span className="wf-box-tag">{h.nameGoesHere}</span>
									</div>
								</div>
							}
						>
							{h.step1Text}
						</Step>
						<Step n={2} title={h.step2} art={<NameList names={names} lang={lang} />}>
							{h.step2Text}
						</Step>
						<Step n={3} title={h.step3} art={fan(false)}>
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
					<Button size="lg" onClick={onExample}>
						{h.tryExample}
					</Button>
				</section>
			</main>
			<footer className="wf-home-foot">
				<MadeBy />
			</footer>
		</div>
	);
}

function NameList({ names, lang }: { names: readonly string[]; lang: Lang }) {
	return (
		<ol className="wf-namelist" lang={lang}>
			{names.map((n, i) => (
				<li key={n}>
					<span className="wf-meta">{i + 1}</span>
					{n}
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
