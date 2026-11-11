import { useEffect, useState, type ReactNode } from "react";
import { EXAMPLE, type ExampleLang } from "../lib/example";
import { getShowcase, type Showcase } from "../lib/showcase";
import { Button, FileDrop, Icon, MadeBy, ProductMark, Segmented, type IconName } from "./ui";

const IMAGES = "image/jpeg,image/png,image/webp";

/**
 * The home page (design system HomeScreen): what the product does, how little it takes, and the
 * way in, all in the first view. Anyone without a design sees it; a picture dropped anywhere on
 * the page, the drop zone, or "Try an example" leaves it for the editor.
 */
export function HomePage({
	lang,
	onLang,
	onFile,
	onExample,
}: {
	lang: ExampleLang;
	onLang(lang: ExampleLang): void;
	onFile(file: File): void;
	onExample(): void;
}) {
	const [pics, setPics] = useState<{ lang: ExampleLang; pics: Showcase } | null>(null);
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
	const langToggle = (
		<div className="wf-home-lang">
			<span>Example in</span>
			<Segmented
				label="Example language"
				value={lang}
				onChange={onLang}
				options={[
					{ value: "en", label: "English" },
					{ value: "vi", label: <span lang="vi">Tiếng Việt</span> },
				]}
			/>
		</div>
	);
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
				<Button variant="ghost" onClick={onExample}>
					Try an example
				</Button>
			</header>
			<main>
				<section className="wf-home-wrap wf-home-hero">
					<div className="wf-home-copy">
						<h1 className="wf-home-title">
							One design. A card for <span className="wf-serif">every</span> name.
						</h1>
						<p className="wf-home-lead">
							Add your invitation, certificate or name badge, paste your list, and download a finished card for each person. No typing
							names in one by one.
						</p>
						<FileDrop accept={IMAGES} onFile={onFile} label="Add your design" className="wf-drop-home">
							<span className="wf-drop-icon">
								<Icon name="image" size={28} />
							</span>
							<span className="wf-drop-text">
								<span className="wf-drop-title">Drop your design here</span>
								<span className="wf-drop-hint">JPG, PNG or WebP, with the name left blank.</span>
							</span>
							<span className="wf-btn wf-btn-primary wf-btn-lg">
								<Icon name="upload" size={20} /> Choose a picture
							</span>
						</FileDrop>
						<ul className="wf-home-ticks">
							{["Free", "No sign-up", "Your list never leaves this device"].map((t) => (
								<li key={t}>
									<Icon name="check" size={16} />
									{t}
								</li>
							))}
						</ul>
					</div>
					<div className="wf-home-show">
						{fan(true)}
						{langToggle}
					</div>
				</section>

				<section className="wf-home-wrap wf-home-section">
					<h2 className="wf-home-h2">Three steps, about a minute</h2>
					<ol className="wf-home-steps">
						<Step
							n={1}
							title="Add your design"
							art={
								<div className="wf-pic-box">
									{shown ? <img className="wf-card-pic" src={shown.blank} alt="" /> : <span className="wf-card-pic" />}
									<div className="wf-box" style={{ left: "22%", top: "38%", width: "56%", height: "15%", cursor: "default" }}>
										<span className="wf-box-tag">Name goes here</span>
									</div>
								</div>
							}
						>
							Any picture of your card with the name left blank. We put a name on it straight away so you can drag it into place.
						</Step>
						<Step n={2} title="Add your names" art={<NameList names={names} lang={lang} />}>
							Paste them, or drop an Excel or CSV file. One person per line; extra columns like table numbers work too.
						</Step>
						<Step n={3} title="Download every card" art={fan(false)}>
							Pick a font and colour, then get one picture per person in a single zip, each file named after its guest.
						</Step>
					</ol>
				</section>

				<section className="wf-home-wrap wf-home-section">
					<h2 className="wf-home-h2">Made to be trusted with a guest list</h2>
					<dl className="wf-home-facts">
						<Fact icon="people" title="Your list stays with you">
							The cards are made in your browser. Names are never uploaded anywhere.
						</Fact>
						<Fact icon="ruler" title="Long names fit">
							Long names shrink to fit, and you are told which ones need a look before you download.
						</Fact>
						<Fact icon="font" title="Vietnamese looks right">
							Accents are drawn properly, and fonts that cannot draw them are marked.
						</Fact>
						<Fact icon="download" title="Ready to send">
							Cards are kept small without losing quality, so they are quick to share.
						</Fact>
					</dl>
				</section>

				<section className="wf-home-wrap wf-home-section wf-home-end">
					<h2 className="wf-home-h2">No design to hand?</h2>
					<p>
						Try it with our sample wedding invitation and a few names. Good for invitations, certificates, name badges, table cards and
						thank-you notes.
					</p>
					{langToggle}
					<Button size="lg" onClick={onExample}>
						Try an example
					</Button>
				</section>
			</main>
			<footer className="wf-home-foot">
				<MadeBy />
			</footer>
		</div>
	);
}

function NameList({ names, lang }: { names: readonly string[]; lang: ExampleLang }) {
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
