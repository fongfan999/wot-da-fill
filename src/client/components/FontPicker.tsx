import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CURATED_FAMILIES, closestVariant, loadCatalog, previewFamily, type GoogleFont } from "../lib/fonts";
import { useT } from "../lib/i18n";
import type { CustomFont, FontRef } from "../types";
import { Button, Icon, pickFile } from "./ui";

/** How many search results are listed; past this, the hint says to type more. */
const MAX_MATCHES = 60;

interface Option {
	key: string;
	family: string;
	source: FontRef["source"];
	google?: GoogleFont;
}

/** Shows the chosen font in its own letters and opens a searchable list. */
export function FontPicker({
	value,
	customFonts,
	onChange,
	onUpload,
	labelId,
}: {
	value: FontRef;
	customFonts: CustomFont[];
	onChange(font: FontRef): void;
	onUpload(file: File): Promise<CustomFont | null>;
	labelId?: string;
}) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [catalog, setCatalog] = useState<GoogleFont[] | null>(null);
	const [active, setActive] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const popRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const valueId = useId();
	/** Closes the list and hands the keyboard back to the button, so it never falls to the page behind. */
	const close = () => {
		setOpen(false);
		buttonRef.current?.focus();
	};
	const [currentAlias, setCurrentAlias] = useState<string | null>(null);

	useEffect(() => {
		if (open && !catalog) loadCatalog().then(setCatalog);
	}, [open, catalog]);

	// The closed button shows the font in its own letters too.
	useEffect(() => {
		setCurrentAlias(value.source === "custom" ? value.family : previewFamily(value.family));
	}, [value.family, value.source]);

	// The list opens inside the panel, which scrolls: bring all of it into view, again once the fonts have loaded.
	useEffect(() => {
		if (open) popRef.current?.scrollIntoView({ block: "nearest" });
	}, [open, catalog]);

	useEffect(() => {
		if (!open) return;
		const close = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [open]);

	const options = useMemo<Option[]>(() => {
		const q = query.trim().toLowerCase();
		const custom: Option[] = customFonts
			.filter((f) => !q || f.family.toLowerCase().includes(q))
			.map((f) => ({ key: `c:${f.id}`, family: f.family, source: "custom" }));
		if (!catalog) return custom;
		const toOption = (f: GoogleFont): Option => ({ key: `g:${f.family}`, family: f.family, source: "google", google: f });
		if (!q) {
			const byName = new Map(catalog.map((f) => [f.family, f]));
			const curated = CURATED_FAMILIES.map((n) => byName.get(n)).filter((f): f is GoogleFont => !!f);
			return [...custom, ...curated.map(toOption)];
		}
		// Names that start with what was typed come first.
		const rank = (f: GoogleFont) => (f.family.toLowerCase().startsWith(q) ? 0 : 1);
		const matches = catalog
			.filter((f) => f.family.toLowerCase().includes(q))
			.sort((a, b) => rank(a) - rank(b))
			.slice(0, MAX_MATCHES);
		return [...custom, ...matches.map(toOption)];
	}, [catalog, customFonts, query]);

	const custom = options.filter((o) => o.source === "custom").length;
	useEffect(() => setActive(0), [query]);
	useEffect(() => {
		listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
	}, [active]);

	const choose = (o: Option) => {
		if (o.source === "custom") {
			onChange({ family: o.family, source: "custom", weight: 400, italic: false });
		} else {
			const v = o.google ? closestVariant(o.google, value.weight, value.italic) : { weight: 400, italic: false };
			onChange({ family: o.family, source: "google", ...v });
		}
		close();
		setQuery("");
	};

	const upload = async () => {
		const file = await pickFile(".ttf,.otf,.woff,.woff2,font/*");
		if (!file) return;
		const font = await onUpload(file);
		if (font) {
			onChange({ family: font.family, source: "custom", weight: 400, italic: false });
			close();
		}
	};

	return (
		<div
			className="wf-font"
			ref={rootRef}
			// Tabbing out of the list closes it, as clicking outside does.
			onBlur={(e) => open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
		>
			<button
				ref={buttonRef}
				type="button"
				className="wf-font-current"
				aria-haspopup="listbox"
				aria-expanded={open}
				// Read as "Font, Great Vibes": the label and then the font in use.
				aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
				onClick={() => setOpen((o) => !o)}
			>
				<span id={valueId} className="wf-font-name" title={value.family} style={currentAlias ? { fontFamily: `"${currentAlias}", var(--font-sans)` } : undefined}>
					{value.family}
				</span>
				<Icon name="chevronDown" size={16} />
			</button>
			{open && (
				<div className="wf-font-pop" ref={popRef}>
					<input
						autoFocus
						className="wf-input"
						type="search"
						placeholder={t.searchFontsPlaceholder}
						value={query}
						aria-label={t.searchFonts}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setActive((a) => Math.min(options.length - 1, a + 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setActive((a) => Math.max(0, a - 1));
							} else if (e.key === "Enter" && options[active]) {
								e.preventDefault();
								choose(options[active]);
							} else if (e.key === "Escape") {
								e.stopPropagation();
								close();
							}
						}}
					/>
					<p className="wf-hint">{query ? t.fontsFound(options.length, options.length - custom >= MAX_MATCHES) : t.curatedFonts}</p>
					{!catalog && (
						<p className="wf-font-empty" role="status">
							{t.loadingFonts}
						</p>
					)}
					{catalog && options.length === 0 && (
						<p className="wf-font-empty" role="status">
							{t.noFontCalled(query)}
						</p>
					)}
					<ul className="wf-font-list" role="listbox" ref={listRef} aria-label={t.fonts}>

						{options.map((o, i) => (
							<FontRow
								key={o.key}
								option={o}
								index={i}
								active={i === active}
								selected={o.family === value.family && o.source === value.source}
								onPick={() => choose(o)}
								onHover={() => setActive(i)}
							/>
						))}
					</ul>
					<Button variant="ghost" icon="upload" full onClick={upload}>
						{t.ownFont}
					</Button>
				</div>
			)}
		</div>
	);
}

function FontRow({
	option,
	index,
	active,
	selected,
	onPick,
	onHover,
}: {
	option: Option;
	index: number;
	active: boolean;
	selected: boolean;
	onPick(): void;
	onHover(): void;
}) {
	const t = useT();
	const ref = useRef<HTMLLIElement>(null);
	const [alias, setAlias] = useState<string | null>(option.source === "custom" ? option.family : null);

	// Only fetch a font's preview letters once its row scrolls into view.
	useEffect(() => {
		if (option.source !== "google" || !ref.current) return;
		const io = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				setAlias(previewFamily(option.family));
				io.disconnect();
			}
		});
		io.observe(ref.current);
		return () => io.disconnect();
	}, [option.family, option.source]);

	return (
		<li
			ref={ref}
			role="option"
			data-index={index}
			aria-selected={selected}
			className="wf-font-row"
			data-active={active || undefined}
			onClick={onPick}
			onPointerMove={onHover}
		>
			<span className="wf-font-name" style={alias ? { fontFamily: `"${alias}", var(--font-sans)` } : undefined}>
				{option.family}
			</span>
			<span className="wf-font-side">
				{option.source === "custom" && <span className="wf-meta">{t.yours}</span>}
				{selected && <Icon name="check" size={16} />}
			</span>
		</li>
	);
}
