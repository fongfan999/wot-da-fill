import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LOGO } from "../lib/logo";

/** One icon set: 24px grid, 1.8 stroke, round caps and joins, drawn in the text colour. */
const PATHS = {
	upload: "M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
	download: "M12 4v12m0 0-5-5m5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
	plus: "M12 5v14M5 12h14",
	trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
	copy: "M9 9h10v10H9zM5 15V5h10",
	left: "M15 18l-6-6 6-6",
	right: "M9 18l6-6-6-6",
	x: "M6 6l12 12M18 6 6 18",
	check: "M5 12.5 10 17 19 7",
	share: "M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	alignLeft: "M4 6h16M4 10h10M4 14h16M4 18h10",
	alignCenter: "M4 6h16M7 10h10M4 14h16M7 18h10",
	alignRight: "M4 6h16M10 10h10M4 14h16M10 18h10",
	vTop: "M4 4h16M12 20V8m0 0-4 4m4-4 4 4",
	vMiddle: "M4 12h16M12 3v5m0 0-3-3m3 3 3-3M12 21v-5m0 0-3 3m3-3 3 3",
	vBottom: "M4 20h16M12 4v12m0 0-4-4m4 4 4-4",
	centerH: "M12 3v18M7 8h10v8H7z",
	eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	eyeOff: "M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2",
	text: "M5 6V4h14v2M12 4v16M9 20h6",
	link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
	refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
	table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
	image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 1 0 0-.01",
	undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
	redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
	chevronDown: "M6 9l6 6 6-6",
	more: "M5 12h.01M12 12h.01M19 12h.01",
	alert: "M12 9v4M12 17h.01M10.3 4.3 2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z",
	info: "M12 11v6M12 7.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
	return (
		<svg
			className="wf-icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={name === "more" ? 2.6 : 1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<path d={PATHS[name]} />
		</svg>
	);
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/**
 * The Wot Da Fill logo: the two-card mark, then "Wot Da" in the Wot Da Fong brush lettering and
 * "Fill" in cobalt. `size` is the lettering height; the lettering hides itself on narrow screens.
 */
export function ProductMark({ size = 26 }: { size?: number }) {
	// Below 40px the strokes are drawn heavier so the cards stay crisp.
	const small = size < 40;
	return (
		<span className="wf-product" role="img" aria-label="Wot Da Fill" style={{ gap: size * 0.23 }}>
			<svg
				className="wf-product-mark"
				viewBox="4 11.5 56.5 45"
				height={size * 0.88}
				fill="none"
				strokeWidth={small ? 4.6 : 3.6}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path stroke="var(--ink)" d={LOGO.back} />
				<path stroke="var(--ink)" d={LOGO.front} />
				<path stroke="var(--accent)" strokeWidth={small ? 4.2 : 3.2} d={LOGO.sign} />
				<path stroke="var(--ink)" strokeWidth={small ? 2.2 : 1.5} d={LOGO.rule} />
				<circle fill="var(--warm)" stroke="none" cx={43.2} cy={29.6} r={2.3} />
			</svg>
			<svg className="wf-product-name" viewBox={LOGO.viewBox} height={size} aria-hidden="true">
				<path fill="var(--ink)" d={LOGO.wot} />
				<path fill="var(--accent)" d={LOGO.fill} />
				<ellipse fill="var(--accent)" cx={LOGO.dot[0]} cy={LOGO.dot[1]} rx={5.6} ry={5.2} />
			</svg>
		</span>
	);
}

/** The maker credit, the only place the Wot Da Fong mark appears. */
export function MadeBy() {
	return (
		<a className="wf-madeby" href="https://wotdafong.dev" target="_blank" rel="noreferrer" aria-label="Made by Wot Da Fong">
			<picture>
				<source srcSet="/wotdafong-paper.svg" media="(prefers-color-scheme: dark)" />
				<img src="/wotdafong-ink.svg" alt="" width="16" height="16" />
			</picture>
			Wot Da Fong <span aria-hidden="true">↗</span>
		</a>
	);
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

export function Button({
	variant = "secondary",
	size = "md",
	icon,
	iconRight,
	full,
	className,
	children,
	type = "button",
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: "sm" | "md" | "lg";
	icon?: IconName;
	iconRight?: IconName;
	full?: boolean;
}) {
	const iconSize = size === "lg" ? 20 : size === "sm" ? 16 : 18;
	return (
		<button
			type={type}
			className={cx("wf-btn", `wf-btn-${variant}`, size !== "md" && `wf-btn-${size}`, full && "wf-btn-full", className)}
			{...rest}
		>
			{icon && <Icon name={icon} size={iconSize} />}
			{children}
			{iconRight && <Icon name={iconRight} size={iconSize} />}
		</button>
	);
}

export function IconButton({
	icon,
	label,
	size = "md",
	pressed,
	title,
	className,
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: "sm" | "md"; pressed?: boolean }) {
	return (
		<button
			type="button"
			className={cx("wf-iconbtn", size === "sm" && "wf-iconbtn-sm", className)}
			aria-label={label}
			title={title ?? label}
			aria-pressed={pressed}
			{...rest}
		>
			<Icon name={icon} size={size === "sm" ? 16 : 18} />
		</button>
	);
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
	return (
		<section className="wf-section">
			<header className="wf-section-head">
				<h2 className="wf-section-title">{title}</h2>
				{aside}
			</header>
			{children}
		</section>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
	full,
}: {
	value: T;
	options: { value: NoInfer<T>; label?: ReactNode; icon?: IconName; title?: string }[];
	onChange(v: NoInfer<T>): void;
	label: string;
	full?: boolean;
}) {
	return (
		<div className={cx("wf-seg", full && "wf-seg-full")} role="radiogroup" aria-label={label}>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={o.value === value}
					aria-label={o.title}
					title={o.title}
					onClick={() => onChange(o.value)}
				>
					{o.icon && <Icon name={o.icon} />}
					{o.label}
				</button>
			))}
		</div>
	);
}

export function Switch({
	checked,
	onChange,
	label,
	hint,
}: {
	checked: boolean;
	onChange(v: boolean): void;
	label: ReactNode;
	hint?: ReactNode;
}) {
	const id = useId();
	return (
		<label className="wf-switch" htmlFor={id}>
			<input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			<span className="wf-switch-track" aria-hidden="true" />
			<span className="wf-switch-text">
				{label}
				{hint && <small>{hint}</small>}
			</span>
		</label>
	);
}

export function NumberField({
	label,
	value,
	onChange,
	min,
	max,
	step = 1,
	suffix,
}: {
	label: string;
	value: number;
	onChange(v: number): void;
	min?: number;
	max?: number;
	step?: number;
	suffix?: string;
}) {
	const id = useId();
	const [draft, setDraft] = useState<string | null>(null);
	const commit = (raw: string) => {
		const v = Number(raw);
		if (raw.trim() !== "" && Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
	};
	return (
		<div className="wf-field">
			<label className="wf-label" htmlFor={id}>
				{label}
			</label>
			<span className="wf-num">
				<input
					id={id}
					className="wf-input"
					type="number"
					inputMode="decimal"
					value={draft ?? String(Math.round(value * 100) / 100)}
					min={min}
					max={max}
					step={step}
					onChange={(e) => {
						setDraft(e.target.value);
						commit(e.target.value);
					}}
					onBlur={() => setDraft(null)}
				/>
				{suffix && <span className="wf-num-suffix">{suffix}</span>}
			</span>
		</div>
	);
}

export function Select({
	label,
	value,
	onChange,
	options,
	hideLabel,
}: {
	label: string;
	value: string;
	onChange(v: string): void;
	options: { value: string; label: string }[];
	hideLabel?: boolean;
}) {
	const id = useId();
	return (
		<div className="wf-field">
			{!hideLabel && (
				<label className="wf-label" htmlFor={id}>
					{label}
				</label>
			)}
			<span className="wf-select">
				<select id={id} className="wf-input" value={value} aria-label={hideLabel ? label : undefined} onChange={(e) => onChange(e.target.value)}>
					{options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				<Icon name="chevronDown" size={16} />
			</span>
		</div>
	);
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
	const id = useId();
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<div className="wf-field">
			<label className="wf-label" htmlFor={id}>
				{label}
			</label>
			<span className="wf-color">
				<input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
				<input
					className="wf-color-hex"
					value={draft ?? value}
					maxLength={7}
					spellCheck={false}
					aria-label="Colour code"
					onChange={(e) => {
						setDraft(e.target.value);
						if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
					}}
					onBlur={() => setDraft(null)}
				/>
			</span>
		</div>
	);
}

/** Click it or drop a file on it. Pass the inner content as children. */
export function FileDrop({
	accept,
	onFile,
	children,
	className,
	label,
}: {
	accept: string;
	onFile(file: File): void;
	children: ReactNode;
	className?: string;
	label: string;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [over, setOver] = useState(false);
	return (
		<div
			className={cx("wf-drop", over && "wf-drop-over", className)}
			role="button"
			tabIndex={0}
			aria-label={label}
			onClick={() => input.current?.click()}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					input.current?.click();
				}
			}}
			onDragOver={(e) => {
				e.preventDefault();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setOver(false);
				const file = e.dataTransfer.files[0];
				if (file) onFile(file);
			}}
		>
			<input
				ref={input}
				type="file"
				accept={accept}
				hidden
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) onFile(file);
				}}
			/>
			{children}
		</div>
	);
}

export function pickFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}

export type StepState = "done" | "current" | "todo";

export function Steps({
	steps,
	onSelect,
}: {
	steps: { label: string; state: StepState; disabled?: boolean }[];
	onSelect(index: number): void;
}) {
	return (
		<ol className="wf-steps" aria-label="Steps">
			{steps.map((s, i) => (
				<li key={s.label}>
					{i > 0 && <span className="wf-step-sep" aria-hidden="true" />}
					<button
						type="button"
						className={`wf-step wf-step-${s.state}`}
						aria-current={s.state === "current" ? "step" : undefined}
						disabled={s.disabled}
						onClick={() => onSelect(i)}
					>
						<span className="wf-step-dot">{s.state === "done" ? <Icon name="check" size={14} label="Done" /> : i + 1}</span>
						<span className="wf-step-label">{s.label}</span>
					</button>
				</li>
			))}
		</ol>
	);
}

export function Notice({
	tone = "info",
	icon,
	action,
	children,
}: {
	tone?: "info" | "warn";
	icon?: IconName;
	action?: { label: string; onClick(): void };
	children: ReactNode;
}) {
	const warn = tone === "warn";
	return (
		<div className={cx("wf-notice", warn && "wf-notice-warn")} role={warn ? "alert" : "status"}>
			<Icon name={icon ?? (warn ? "alert" : "info")} size={20} />
			<div className="wf-notice-body">{children}</div>
			{action && (
				<Button variant="link" onClick={action.onClick}>
					{action.label}
				</Button>
			)}
		</div>
	);
}

export interface ToastMessage {
	id: number;
	kind: "info" | "error" | "busy";
	text: string;
	action?: { label: string; onClick(): void };
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss?(): void }) {
	return (
		<div className={cx("wf-toast", toast.kind !== "info" && `wf-toast-${toast.kind}`)} role={toast.kind === "error" ? "alert" : "status"}>
			{toast.kind === "busy" && <span className="wf-spinner" aria-hidden="true" />}
			{toast.kind === "error" && <Icon name="alert" />}
			<span className="wf-toast-text">{toast.text}</span>
			{toast.action && (
				<button type="button" className="wf-toast-action" onClick={toast.action.onClick}>
					{toast.action.label}
				</button>
			)}
			{onDismiss && <IconButton icon="x" label="Dismiss" onClick={onDismiss} />}
		</div>
	);
}

export function Progress({ value, label, detail }: { value: number; label: string; detail: string }) {
	const v = Math.max(0, Math.min(1, value));
	return (
		<div className="wf-progress">
			<div className="wf-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
				<div className="wf-progress-fill" style={{ transform: `scaleX(${v})` }} />
			</div>
			<div className="wf-progress-row">
				<span>{label}</span>
				<b>{detail}</b>
			</div>
		</div>
	);
}

/** A native modal dialog: focus is trapped and Escape goes through onClose. */
export function Dialog({
	title,
	onClose,
	closeLabel = "Close",
	width,
	children,
}: {
	title: string;
	onClose(): void;
	closeLabel?: string;
	width?: number;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();
	useEffect(() => {
		const d = ref.current;
		if (d && !d.open) d.showModal();
		return () => d?.close();
	}, []);
	return (
		<dialog
			ref={ref}
			className="wf-dialog"
			style={width ? ({ "--wf-dialog-width": `${width}px` } as React.CSSProperties) : undefined}
			aria-labelledby={id}
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
		>
			<header className="wf-dialog-head">
				<h2 className="wf-dialog-title" id={id}>
					{title}
				</h2>
				<IconButton icon="x" label={closeLabel} onClick={onClose} />
			</header>
			<div className="wf-dialog-body">{children}</div>
		</dialog>
	);
}

/** A small popover menu behind an icon button. */
export function Menu({ label, items }: { label: string; items: { label: string; icon: IconName; onClick(): void }[] }) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("pointerdown", close);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("pointerdown", close);
			document.removeEventListener("keydown", esc);
		};
	}, [open]);
	return (
		<div className="wf-menu" ref={root}>
			<IconButton icon="more" label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
			{open && (
				<div className="wf-menu-pop" role="menu">
					{items.map((item) => (
						<button
							key={item.label}
							type="button"
							role="menuitem"
							className="wf-menu-item"
							onClick={() => {
								setOpen(false);
								item.onClick();
							}}
						>
							<Icon name={item.icon} />
							{item.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/** Opens once someone opens it, then stays open on later visits. */
export function useRemembered(key: string, initial: boolean): [boolean, (v: boolean) => void] {
	const [value, setValue] = useState(() => {
		try {
			const v = localStorage.getItem(key);
			return v === null ? initial : v === "1";
		} catch {
			return initial;
		}
	});
	const set = (v: boolean) => {
		setValue(v);
		try {
			localStorage.setItem(key, v ? "1" : "0");
		} catch {
			// Storage can be blocked; the choice just won't be remembered.
		}
	};
	return [value, set];
}
