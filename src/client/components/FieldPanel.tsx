import { useEffect, useRef, useState, type RefObject } from "react";
import { closestVariant, loadCatalog, type GoogleFont } from "../lib/fonts";
import { ROW_NUMBER, unknownPlaceholders } from "../lib/text";
import type { CustomFont, Field, FontRef } from "../types";
import { FontPicker } from "./FontPicker";
import { Icon, NumberField, Segmented, Switch } from "./ui";

const WEIGHT_NAMES: Record<number, string> = {
	100: "Thin",
	200: "Extra light",
	300: "Light",
	400: "Regular",
	500: "Medium",
	600: "Semibold",
	700: "Bold",
	800: "Extra bold",
	900: "Black",
	1000: "Extra black",
};

export function FieldPanel({
	fields,
	selected,
	columns,
	customFonts,
	imageWidth,
	previewText,
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
	previewText: string;
	onSelect(id: string): void;
	onChange(field: Field): void;
	onAdd(): void;
	onDuplicate(field: Field): void;
	onDelete(field: Field): void;
	onUploadFont(file: File): Promise<CustomFont | null>;
}) {
	const textRef = useRef<HTMLTextAreaElement>(null);
	const [googleFont, setGoogleFont] = useState<GoogleFont | null>(null);

	useEffect(() => {
		if (!selected || selected.font.source !== "google") return setGoogleFont(null);
		let alive = true;
		loadCatalog().then((c) => alive && setGoogleFont(c.find((f) => f.family === selected.font.family) ?? null));
		return () => {
			alive = false;
		};
	}, [selected?.font.family, selected?.font.source]);

	return (
		<div className="fields">
			<div className="field-tabs" role="tablist" aria-label="Text boxes">
				{fields.map((f, i) => (
					<button
						key={f.id}
						type="button"
						role="tab"
						aria-selected={f.id === selected?.id}
						className={`chip${f.id === selected?.id ? " on" : ""}`}
						onClick={() => onSelect(f.id)}
						title={f.text}
					>
						<b>{i + 1}</b> {f.text.length > 18 ? `${f.text.slice(0, 18)}...` : f.text || "Empty"}
					</button>
				))}
				<button type="button" className="chip add" onClick={onAdd}>
					<Icon name="plus" size={14} /> Add text
				</button>
			</div>

			{!selected ? (
				<p className="muted small">
					{fields.length ? "Pick a text box above, or click one on the design." : "Drag on the design to mark where the name goes."}
				</p>
			) : (
				<FieldEditor
					key={selected.id}
					field={selected}
					columns={columns}
					customFonts={customFonts}
					googleFont={googleFont}
					imageWidth={imageWidth}
					previewText={previewText}
					textRef={textRef}
					onChange={onChange}
					onDuplicate={() => onDuplicate(selected)}
					onDelete={() => onDelete(selected)}
					onUploadFont={onUploadFont}
				/>
			)}
		</div>
	);
}

function FieldEditor({
	field,
	columns,
	customFonts,
	googleFont,
	imageWidth,
	previewText,
	textRef,
	onChange,
	onDuplicate,
	onDelete,
	onUploadFont,
}: {
	field: Field;
	columns: string[];
	customFonts: CustomFont[];
	googleFont: GoogleFont | null;
	imageWidth: number;
	previewText: string;
	textRef: RefObject<HTMLTextAreaElement | null>;
	onChange(field: Field): void;
	onDuplicate(): void;
	onDelete(): void;
	onUploadFont(file: File): Promise<CustomFont | null>;
}) {
	const set = (patch: Partial<Field>) => onChange({ ...field, ...patch });
	const setFont = (patch: Partial<FontRef>) => set({ font: { ...field.font, ...patch } });
	const unknown = columns.length ? unknownPlaceholders(field.text, columns) : [];

	const insert = (token: string) => {
		const el = textRef.current;
		const start = el?.selectionStart ?? field.text.length;
		const end = el?.selectionEnd ?? field.text.length;
		const text = field.text.slice(0, start) + token + field.text.slice(end);
		set({ text });
		requestAnimationFrame(() => {
			el?.focus();
			el?.setSelectionRange(start + token.length, start + token.length);
		});
	};

	const weights = googleFont
		? [...new Set(googleFont.variants.filter((v) => v.endsWith("i") === field.font.italic).map((v) => parseInt(v, 10)))]
		: [400];
	const hasItalic = !!googleFont?.variants.some((v) => v.endsWith("i"));
	const hasUpright = !googleFont || googleFont.variants.some((v) => !v.endsWith("i"));

	return (
		<div className="field-editor">
			<label className="stack">
				<span className="label">Text</span>
				<textarea
					ref={textRef}
					rows={field.wrap ? 3 : 1}
					value={field.text}
					spellCheck={false}
					onChange={(e) => set({ text: e.target.value })}
				/>
			</label>
			<div className="tokens" aria-label="Insert a column">
				{columns.map((c) => (
					<button key={c} type="button" className="token" onClick={() => insert(`{${c}}`)}>
						{`{${c}}`}
					</button>
				))}
				<button type="button" className="token" title="Row number" onClick={() => insert(`{${ROW_NUMBER}}`)}>
					{"{#}"}
				</button>
			</div>
			{unknown.length > 0 && (
				<p className="warn small">
					No column named {unknown.map((u) => `{${u}}`).join(", ")} in your list. Those parts will be blank.
				</p>
			)}
			<p className="preview-line small">
				<span className="muted">Preview:</span> {previewText || <i className="muted">empty</i>}
			</p>

			<div className="group">
				<span className="label">Font</span>
				<FontPicker
					value={field.font}
					customFonts={customFonts}
					onChange={(font) => setFont(font)}
					onUpload={onUploadFont}
				/>
				{field.font.source === "google" && (
					<div className="row">
						<select
							aria-label="Font weight"
							value={field.font.weight}
							onChange={(e) => setFont({ weight: Number(e.target.value) })}
						>
							{weights.map((w) => (
								<option key={w} value={w}>
									{WEIGHT_NAMES[w] ?? w}
								</option>
							))}
						</select>
						{hasItalic && hasUpright && (
							<Segmented
								label="Style"
								value={field.font.italic ? "italic" : "normal"}
								options={[
									{ value: "normal", label: "Upright" },
									{ value: "italic", label: <i>Italic</i> },
								]}
								onChange={(v) => {
									const italic = v === "italic";
									const next = googleFont ? closestVariant(googleFont, field.font.weight, italic) : { weight: 400, italic };
									setFont(next);
								}}
							/>
						)}
					</div>
				)}
			</div>

			<div className="grid-2">
				<NumberField label="Size" value={field.fontSize} min={1} max={2000} suffix="px" onChange={(v) => set({ fontSize: v })} />
			</div>
			<Switch
				checked={field.autoFit}
				onChange={(autoFit) => set({ autoFit })}
				label="Shrink long text to fit"
				hint="Long names get smaller instead of spilling out of the box."
			/>
			<Switch
				checked={field.wrap}
				onChange={(wrap) => set({ wrap })}
				label="Wrap onto several lines"
				hint="For addresses or long titles."
			/>

			<div className="group">
				<span className="label">Color and alignment</span>
				<div className="row">
					<label className="color">
						<input type="color" value={field.color} onChange={(e) => set({ color: e.target.value })} aria-label="Text color" />
						<input
							className="hex"
							value={field.color}
							aria-label="Hex color"
							maxLength={7}
							onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && set({ color: e.target.value })}
						/>
					</label>
					<Segmented
						label="Horizontal alignment"
						value={field.align}
						options={[
							{ value: "left", label: <Icon name="alignLeft" />, title: "Align left" },
							{ value: "center", label: <Icon name="alignCenter" />, title: "Align center" },
							{ value: "right", label: <Icon name="alignRight" />, title: "Align right" },
						]}
						onChange={(align) => set({ align })}
					/>
					<Segmented
						label="Vertical alignment"
						value={field.valign}
						options={[
							{ value: "top", label: <Icon name="vTop" />, title: "Top" },
							{ value: "middle", label: <Icon name="vMiddle" />, title: "Middle" },
							{ value: "bottom", label: <Icon name="vBottom" />, title: "Bottom (baseline)" },
						]}
						onChange={(valign) => set({ valign })}
					/>
				</div>
			</div>

			<details className="more">
				<summary>Letter case, spacing and position</summary>
				<div className="group">
					<span className="label">Letter case</span>
					<Segmented
						label="Letter case"
						value={field.textCase}
						options={[
							{ value: "none", label: "As typed" },
							{ value: "title", label: "Title Case" },
							{ value: "upper", label: "UPPER" },
						]}
						onChange={(textCase) => set({ textCase })}
					/>
				</div>
				<div className="grid-2">
					<NumberField
						label="Letter spacing"
						value={field.letterSpacing}
						min={-50}
						max={200}
						suffix="%"
						onChange={(v) => set({ letterSpacing: v })}
					/>
					<NumberField
						label="Line height"
						value={field.lineHeight}
						min={0.5}
						max={4}
						step={0.05}
						onChange={(v) => set({ lineHeight: v })}
					/>
				</div>
				<div className="grid-4">
					{(["x", "y", "w", "h"] as const).map((k) => (
						<NumberField
							key={k}
							label={k.toUpperCase()}
							value={field.box[k]}
							min={k === "w" || k === "h" ? 4 : 0}
							onChange={(v) => set({ box: { ...field.box, [k]: Math.round(v) } })}
						/>
					))}
				</div>
				<button
					type="button"
					className="btn ghost"
					onClick={() => set({ box: { ...field.box, x: Math.round((imageWidth - field.box.w) / 2) } })}
				>
					<Icon name="centerH" /> Center on the design
				</button>
			</details>

			<div className="row end">
				<button type="button" className="btn ghost" onClick={onDuplicate}>
					<Icon name="copy" /> Duplicate
				</button>
				<button type="button" className="btn ghost danger" onClick={onDelete}>
					<Icon name="trash" /> Remove
				</button>
			</div>
		</div>
	);
}
