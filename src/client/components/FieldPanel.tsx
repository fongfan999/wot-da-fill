import { useEffect, useId, useRef, useState } from "react";
import { closestVariant, loadCatalog, type GoogleFont } from "../lib/fonts";
import { EXAMPLE } from "../lib/example";
import { clampBox } from "../lib/fields";
import { getLang, tr, useT } from "../lib/i18n";
import { placeholdersIn, ROW_NUMBER, unknownPlaceholders } from "../lib/text";
import type { CustomFont, Field, FontRef } from "../types";
import { FontPicker } from "./FontPicker";
import { Button, ColorField, Icon, IconButton, NumberField, Section, Segmented, Select, Switch, useRemembered } from "./ui";


/** What a text box is called in tags, the list and its heading: exactly what it says, so the three match the text field. */
export function fieldLabel(f: Field): string {
	const t = f.text.replace(/\s+/g, " ").trim();
	if (!t) return `(${tr().empty})`;
	return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

export function FieldPanel({
	fields,
	selected,
	columns,
	customFonts,
	imageWidth,
	imageHeight,
	colorSuggestions,
	onSelect,
	onChange,
	onAdd,
	onDelete,
	onUploadFont,
}: {
	fields: Field[];
	selected: Field | null;
	columns: string[];
	customFonts: CustomFont[];
	imageWidth: number;
	imageHeight: number;
	/** Text colours taken from the design that read well behind the selected box, best first. */
	colorSuggestions: string[];
	onSelect(id: string): void;
	onChange(field: Field): void;
	onAdd(): void;
	onDelete(field: Field): void;
	onUploadFont(file: File): Promise<CustomFont | null>;
}) {
	const t = useT();
	return (
		<Section>
			{/* Every box, numbered like its tag on the design. The selected one carries its remove button. */}
			{fields.length > 0 && (
				<ul className="wf-boxlist" aria-label={t.textBoxes}>
					{fields.map((f, i) => (
						<li key={f.id} aria-current={f.id === selected?.id}>
							<button type="button" className="wf-boxlist-pick" aria-current={f.id === selected?.id} onClick={() => onSelect(f.id)}>
								<span className="wf-meta">{i + 1}.</span>
								<span className="wf-truncate">{fieldLabel(f)}</span>
							</button>
							{f.id === selected?.id && (
								<IconButton icon="trash" label={t.remove} className="wf-iconbtn-danger" onClick={() => onDelete(f)} />
							)}
						</li>
					))}
				</ul>
			)}
			{/* Boxes are added by dragging on the design; the button is the way without a mouse. */}
			{!fields.length && (
				<>
					<p className="wf-hint">{t.hintNoBox}</p>
					<Button size="sm" icon="plus" onClick={onAdd}>
						{t.addInMiddle}
					</Button>
				</>
			)}
			{fields.length > 0 && !selected && <p className="wf-hint">{t.pickBox}</p>}
			{selected && (
				<FieldEditor
					key={selected.id}
					field={selected}
					columns={columns}
					customFonts={customFonts}
					imageWidth={imageWidth}
					imageHeight={imageHeight}
					colorSuggestions={colorSuggestions}
					onChange={onChange}
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
	imageHeight,
	colorSuggestions,
	onChange,
	onUploadFont,
}: {
	field: Field;
	columns: string[];
	customFonts: CustomFont[];
	imageWidth: number;
	imageHeight: number;
	colorSuggestions: string[];
	onChange(field: Field): void;
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

	// A text field that was never clicked reports its cursor at the start; pieces added from the list belong at the end.
	useEffect(() => {
		const el = textRef.current;
		el?.setSelectionRange(el.value.length, el.value.length);
	}, []);

	const set = (patch: Partial<Field>) => onChange({ ...field, ...patch });
	const setBox = (box: Field["box"]) => set({ box: clampBox(box, imageWidth, imageHeight) });
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
	const pieces = columns.length ? columns : used.length ? used : [EXAMPLE[getLang()].nameColumn];
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
					placeholder={t.textPlaceholder}
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
					<button key={c} type="button" className="wf-fillin" title={c} onClick={() => insert(c)}>
						<Icon name="plus" size={14} />
						<span className="wf-truncate">{c}</span>
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

			{/* Size and both alignments in one row. */}
			<div className="wf-row wf-row-wrap">
				<div style={{ width: 92, flex: "none" }}>
					<NumberField
						// With shrinking on, long names come out smaller: this is only the largest they get.
						label={field.autoFit ? t.maxSize : t.size}
						value={field.fontSize}
						min={1}
						max={2000}
						suffix="px"
						onChange={(v) => set({ fontSize: v })}
					/>
				</div>
				<div className="wf-field">
					<span className="wf-label">{t.lineUp}</span>
					<div className="wf-row">
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
				</div>
			</div>

			<ColorField
				label={t.colour}
				value={field.color}
				onChange={(color) => set({ color })}
				swatches={colorSuggestions}
				swatchesLabel={t.fromDesign}
			/>

			<details className="wf-more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
				<summary>
					{t.moreOptions} <Icon name="chevronDown" size={16} />
				</summary>
				<div className="wf-more-body">
					{field.font.source === "google" && (weights.length > 1 || (hasItalic && hasUpright)) && (
						<div className="wf-row">
							{weights.length > 1 && (
								<div className="wf-grow">
									<Select
										label={t.thickness}
										value={String(field.font.weight)}
										options={weights.map((w) => ({ value: String(w), label: t.weights[w] ?? String(w) }))}
										onChange={(v) => setFont({ weight: Number(v) })}
									/>
								</div>
							)}
							{/* Labelled like Thickness beside it, so the two controls share a top and a bottom. */}
							{hasItalic && hasUpright && (
								<div className="wf-field">
									<span className="wf-label">{t.slant}</span>
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
								</div>
							)}
						</div>
					)}
					<div className="wf-field">
						<span className="wf-label">{t.capitals}</span>
						<Segmented
							label={t.capitals}
							full
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
					<Switch checked={field.autoFit} onChange={(autoFit) => set({ autoFit })} label={t.shrink} hint={t.shrinkHint} />
					<Switch checked={field.wrap} onChange={(wrap) => set({ wrap })} label={t.wrap} hint={t.wrapHint} />
					<div className="wf-field">
						<div className="wf-field-head">
							<span className="wf-label">{t.position}</span>
							<Button
								variant="ghost"
								size="sm"
								icon="centerH"
								onClick={() => setBox({ ...field.box, x: Math.round((imageWidth - field.box.w) / 2) })}
							>
								{t.centreOnDesign}
							</Button>
						</div>
						<div className="wf-grid-4">
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
									onChange={(v) => setBox({ ...field.box, [k]: Math.round(v) })}
								/>
							))}
						</div>
					</div>
				</div>
			</details>
		</>
	);
}
