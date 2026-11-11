import { useEffect, useId, useRef, useState } from "react";
import { closestVariant, loadCatalog, type GoogleFont } from "../lib/fonts";
import { EXAMPLE } from "../lib/example";
import { getLang, tr, useT } from "../lib/i18n";
import { placeholdersIn, ROW_NUMBER, unknownPlaceholders } from "../lib/text";
import type { CustomFont, Field, FontRef } from "../types";
import { FontPicker } from "./FontPicker";
import { Button, ColorField, Icon, NumberField, Section, Segmented, Select, Switch, useRemembered } from "./ui";


/** What a text box is called in tags and lists: its one piece from the list, or its words. */
export function fieldLabel(f: Field, i: number): string {
	const t = f.text.trim();
	const lone = /^\{([^{}]+)\}$/.exec(t);
	if (lone) return lone[1].trim() === ROW_NUMBER ? tr().cardNumber : lone[1].trim();
	if (!t) return `Text ${i + 1}`;
	return t.length > 22 ? `${t.slice(0, 22)}…` : t;
}

export function FieldPanel({
	fields,
	selected,
	columns,
	customFonts,
	imageWidth,
	onSelect,
	onChange,
	onAdd,
	onDuplicate,
	onDelete,
	onUploadFont,
}: {
	fields: Field[];
	selected: Field | null;
	columns: string[];
	customFonts: CustomFont[];
	imageWidth: number;
	onSelect(id: string): void;
	onChange(field: Field): void;
	onAdd(): void;
	onDuplicate(field: Field): void;
	onDelete(field: Field): void;
	onUploadFont(file: File): Promise<CustomFont | null>;
}) {
	const t = useT();
	return (
		<Section
			title={t.textTitle}
			aside={
				<Button size="sm" icon="plus" onClick={onAdd}>
					{t.addText}
				</Button>
			}
		>
			{fields.length > 1 && (
				<ul className="wf-boxlist" aria-label={t.textBoxes}>
					{fields.map((f, i) => (
						<li key={f.id}>
							<button type="button" aria-current={f.id === selected?.id} onClick={() => onSelect(f.id)}>
								<span className="wf-meta">{i + 1}</span>
								<span className="wf-truncate">{fieldLabel(f, i)}</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{!fields.length && <p className="wf-hint">{t.noBoxes}</p>}
			{fields.length > 0 && !selected && <p className="wf-hint">{t.pickBox}</p>}
			{selected && (
				<FieldEditor
					key={selected.id}
					field={selected}
					columns={columns}
					customFonts={customFonts}
					imageWidth={imageWidth}
					onChange={onChange}
					onDuplicate={() => onDuplicate(selected)}
					onDelete={() => onDelete(selected)}
					onUploadFont={onUploadFont}
				/>
			)}
		</Section>
	);
}

function FieldEditor({
	field,
	columns,
	customFonts,
	imageWidth,
	onChange,
	onDuplicate,
	onDelete,
	onUploadFont,
}: {
	field: Field;
	columns: string[];
	customFonts: CustomFont[];
	imageWidth: number;
	onChange(field: Field): void;
	onDuplicate(): void;
	onDelete(): void;
	onUploadFont(file: File): Promise<CustomFont | null>;
}) {
	const t = useT();
	const textRef = useRef<HTMLTextAreaElement>(null);
	const textId = useId();
	const fontLabelId = useId();
	const [googleFont, setGoogleFont] = useState<GoogleFont | null>(null);
	const [moreOpen, setMoreOpen] = useRemembered("wdf:more-options", false);

	useEffect(() => {
		if (field.font.source !== "google") return setGoogleFont(null);
		let alive = true;
		loadCatalog().then((c) => alive && setGoogleFont(c.find((f) => f.family === field.font.family) ?? null));
		return () => {
			alive = false;
		};
	}, [field.font.family, field.font.source]);

	const set = (patch: Partial<Field>) => onChange({ ...field, ...patch });
	const setFont = (patch: Partial<FontRef>) => set({ font: { ...field.font, ...patch } });
	const unknown = columns.length ? unknownPlaceholders(field.text, columns) : [];

	const insert = (name: string) => {
		const token = `{${name}}`;
		const el = textRef.current;
		const start = el?.selectionStart ?? field.text.length;
		const end = el?.selectionEnd ?? field.text.length;
		set({ text: field.text.slice(0, start) + token + field.text.slice(end) });
		requestAnimationFrame(() => {
			el?.focus();
			el?.setSelectionRange(start + token.length, start + token.length);
		});
	};

	// One button per piece of the list; before there is a list, the pieces this text already uses.
	const used = [...new Set(placeholdersIn(field.text).filter((p) => p !== ROW_NUMBER))];
	const pieces = columns.length ? columns : used.length ? used : [EXAMPLE[getLang()].columns[0]];
	const weights = googleFont
		? [...new Set(googleFont.variants.filter((v) => v.endsWith("i") === field.font.italic).map((v) => parseInt(v, 10)))]
		: [400];
	const hasItalic = !!googleFont?.variants.some((v) => v.endsWith("i"));
	const hasUpright = !googleFont || googleFont.variants.some((v) => !v.endsWith("i"));

	return (
		<>
			<div className={`wf-field${unknown.length ? " wf-field-error" : ""}`}>
				<label className="wf-label" htmlFor={textId}>
					{t.whatItSays}
				</label>
				<textarea
					id={textId}
					ref={textRef}
					className="wf-input"
					rows={field.wrap ? 3 : 1}
					value={field.text}
					spellCheck={false}
					aria-invalid={unknown.length > 0 || undefined}
					aria-describedby={unknown.length ? `${textId}-hint` : undefined}
					onChange={(e) => set({ text: e.target.value })}
				/>
				{unknown.length > 0 && (
					<p className="wf-hint" id={`${textId}-hint`} role="alert">
						{t.unknownColumns(unknown)}
					</p>
				)}
			</div>
			<div className="wf-fillins" role="group" aria-label={t.addFromList}>
				<span className="wf-fillins-label">{t.addFromList}</span>
				{pieces.map((c) => (
					<button key={c} type="button" className="wf-fillin" onClick={() => insert(c)}>
						<Icon name="plus" size={14} />
						{c}
					</button>
				))}
				<button type="button" className="wf-fillin" onClick={() => insert(ROW_NUMBER)}>
					<Icon name="plus" size={14} />
					{t.cardNumber}
				</button>
			</div>

			<div className="wf-field">
				<span className="wf-label" id={fontLabelId}>
					{t.font}
				</span>
				<FontPicker value={field.font} customFonts={customFonts} onChange={(font) => setFont(font)} onUpload={onUploadFont} labelId={fontLabelId} />
			</div>

			<div className="wf-row">
				<div style={{ width: 92, flex: "none" }}>
					<NumberField label={t.size} value={field.fontSize} min={1} max={2000} suffix="px" onChange={(v) => set({ fontSize: v })} />
				</div>
				<ColorField label={t.colour} value={field.color} onChange={(color) => set({ color })} />
				<div className="wf-field">
					<span className="wf-label">{t.lineUp}</span>
					<Segmented
						label={t.lineUp}
						value={field.align}
						options={[
							{ value: "left", icon: "alignLeft", title: t.alignLeft },
							{ value: "center", icon: "alignCenter", title: t.alignCentre },
							{ value: "right", icon: "alignRight", title: t.alignRight },
						]}
						onChange={(align) => set({ align })}
					/>
				</div>
			</div>

			<details className="wf-more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
				<summary>
					{t.moreOptions} <Icon name="chevronDown" size={16} />
				</summary>
				<div className="wf-more-body">
					{field.font.source === "google" && (
						<div className="wf-row">
							<div className="wf-grow">
								<Select
									label={t.thickness}
									value={String(field.font.weight)}
									options={weights.map((w) => ({ value: String(w), label: t.weights[w] ?? String(w) }))}
									onChange={(v) => setFont({ weight: Number(v) })}
								/>
							</div>
							{hasItalic && hasUpright && (
								<Segmented
									label={t.slant}
									value={field.font.italic ? "italic" : "normal"}
									options={[
										{ value: "normal", label: t.upright },
										{ value: "italic", label: <i>{t.italic}</i> },
									]}
									onChange={(v) => {
										const italic = v === "italic";
										setFont(googleFont ? closestVariant(googleFont, field.font.weight, italic) : { weight: 400, italic });
									}}
								/>
							)}
						</div>
					)}
					<div className="wf-field">
						<span className="wf-label">{t.capitals}</span>
						<Segmented
							label={t.capitals}
							value={field.textCase}
							options={[
								{ value: "none", label: t.asTyped },
								{ value: "title", label: t.eachWord },
								{ value: "upper", label: t.allCaps },
							]}
							onChange={(textCase) => set({ textCase })}
						/>
					</div>
					<div className="wf-grid-2">
						<NumberField label={t.letterSpacing} value={field.letterSpacing} min={-50} max={200} suffix="%" onChange={(v) => set({ letterSpacing: v })} />
						<NumberField label={t.lineHeight} value={field.lineHeight} min={0.5} max={4} step={0.05} onChange={(v) => set({ lineHeight: v })} />
					</div>
					<div className="wf-field">
						<span className="wf-label">{t.vertical}</span>
						<Segmented
							label={t.vertical}
							value={field.valign}
							options={[
								{ value: "top", icon: "vTop", title: t.top },
								{ value: "middle", icon: "vMiddle", title: t.middle },
								{ value: "bottom", icon: "vBottom", title: t.bottom },
							]}
							onChange={(valign) => set({ valign })}
						/>
					</div>
					<Switch
						checked={field.autoFit}
						onChange={(autoFit) => set({ autoFit })}
						label={t.shrink}
						hint={t.shrinkHint}
					/>
					<Switch checked={field.wrap} onChange={(wrap) => set({ wrap })} label={t.wrap} hint={t.wrapHint} />
					<div className="wf-field">
						<span className="wf-label">{t.position}</span>
						<div className="wf-grid-2">
							{(
								[
									["x", t.posLeft],
									["y", t.posTop],
									["w", t.posWidth],
									["h", t.posHeight],
								] as const
							).map(([k, label]) => (
								<NumberField
									key={k}
									label={label}
									value={field.box[k]}
									min={k === "w" || k === "h" ? 4 : 0}
									onChange={(v) => set({ box: { ...field.box, [k]: Math.round(v) } })}
								/>
							))}
						</div>
					</div>
					<Button
						variant="ghost"
						icon="centerH"
						style={{ alignSelf: "flex-start", marginLeft: -16 }}
						onClick={() => set({ box: { ...field.box, x: Math.round((imageWidth - field.box.w) / 2) } })}
					>
						{t.centreOnDesign}
					</Button>
				</div>
			</details>

			<div className="wf-actions">
				<Button variant="ghost" icon="copy" onClick={onDuplicate}>
					{t.duplicate}
				</Button>
				<Button variant="danger" icon="trash" onClick={onDelete}>
					{t.remove}
				</Button>
			</div>
		</>
	);
}
