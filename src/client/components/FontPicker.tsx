import { useEffect, useMemo, useRef, useState } from "react";
import { CURATED_FAMILIES, closestVariant, loadCatalog, previewFamily, type GoogleFont } from "../lib/fonts";
import type { CustomFont, FontRef } from "../types";
import { Icon, pickFile } from "./ui";

const CATEGORY_LABEL: Record<GoogleFont["category"], string> = {
	serif: "Serif",
	sans: "Sans",
	display: "Display",
	script: "Script",
	mono: "Mono",
};

interface Option {
	key: string;
	family: string;
	source: FontRef["source"];
	meta: string;
	google?: GoogleFont;
	noVietnamese?: boolean;
}

export function FontPicker({
	value,
	customFonts,
	onChange,
	onUpload,
}: {
	value: FontRef;
	customFonts: CustomFont[];
	onChange(font: FontRef): void;
	onUpload(file: File): Promise<CustomFont | null>;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [viOnly, setViOnly] = useState(true);
	const [catalog, setCatalog] = useState<GoogleFont[] | null>(null);
	const [active, setActive] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		if (open && !catalog) loadCatalog().then(setCatalog);
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
			.map((f) => ({ key: `c:${f.id}`, family: f.family, source: "custom", meta: "Uploaded" }));
		if (!catalog) return custom;
		const byName = new Map(catalog.map((f) => [f.family, f]));
		const toOption = (f: GoogleFont): Option => ({
			key: `g:${f.family}`,
			family: f.family,
			source: "google",
			meta: CATEGORY_LABEL[f.category],
			google: f,
			noVietnamese: !f.vietnamese,
		});
		if (!q) {
			const curated = CURATED_FAMILIES.map((n) => byName.get(n)).filter((f): f is GoogleFont => !!f);
			return [...custom, ...curated.map(toOption)];
		}
		const matches = catalog
			.filter((f) => (!viOnly || f.vietnamese) && f.family.toLowerCase().includes(q))
			.sort((a, b) => Number(!a.family.toLowerCase().startsWith(q)) - Number(!b.family.toLowerCase().startsWith(q)))
			.slice(0, 60);
		return [...custom, ...matches.map(toOption)];
	}, [catalog, customFonts, query, viOnly]);

	useEffect(() => setActive(0), [query, viOnly]);
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
		setOpen(false);
		setQuery("");
	};

	const upload = async () => {
		const file = await pickFile(".ttf,.otf,.woff,.woff2,font/*");
		if (!file) return;
		const font = await onUpload(file);
		if (font) {
			onChange({ family: font.family, source: "custom", weight: 400, italic: false });
			setOpen(false);
		}
	};

	return (
		<div className="font-picker" ref={rootRef}>
			<button
				type="button"
				className="font-current"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
			>
				<span style={{ fontFamily: `"${value.family}", var(--sans)` }}>{value.family}</span>
				<em>{value.source === "custom" ? "Uploaded" : "Google Fonts"}</em>
			</button>
			{open && (
				<div className="font-pop">
					<div className="font-search">
						<input
							autoFocus
							type="search"
							placeholder="Search 1,700+ Google Fonts"
							value={query}
							aria-label="Search fonts"
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
									setOpen(false);
								}
							}}
						/>
						<label className="mini-check">
							<input type="checkbox" checked={viOnly} onChange={(e) => setViOnly(e.target.checked)} />
							Vietnamese only
						</label>
					</div>
					<p className="font-hint">{query ? `${options.length} matches` : "Picked for invitations, all with Vietnamese accents"}</p>
					<ul className="font-list" role="listbox" ref={listRef} aria-label="Fonts">
						{!catalog && <li className="font-empty">Loading fonts...</li>}
						{catalog && options.length === 0 && <li className="font-empty">No fonts match "{query}".</li>}
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
					<button type="button" className="btn ghost full" onClick={upload}>
						<Icon name="upload" /> Upload a font (TTF, OTF, WOFF)
					</button>
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
	const ref = useRef<HTMLLIElement>(null);
	const [alias, setAlias] = useState<string | null>(option.source === "custom" ? option.family : null);

	// Only fetch a font's preview subset once its row scrolls into view.
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
			className={`font-row${active ? " active" : ""}`}
			onClick={onPick}
			onPointerMove={onHover}
		>
			<span className="font-name" style={alias ? { fontFamily: `"${alias}", var(--sans)` } : undefined}>
				{option.family}
			</span>
			<span className="font-meta">
				{option.noVietnamese && <b title="No Vietnamese accents in this font">No VI</b>}
				{option.meta}
			</span>
		</li>
	);
}
