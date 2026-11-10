import { useId, useRef, useState, type ReactNode } from "react";

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
	sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
	eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	eyeOff: "M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2",
	text: "M5 6V4h14v2M12 4v16M9 20h6",
	ruler: "M4 17 17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2",
	link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
	refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
	table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
	image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 1 0 0-.01",
	font: "M4 20 10 4h1l6 16M6.5 14h8M17 20h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
	return (
		<svg
			className="icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={PATHS[name]} />
		</svg>
	);
}

export function Section({
	step,
	title,
	done,
	aside,
	children,
}: {
	step: number;
	title: string;
	done?: boolean;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="section">
			<header className="section-head">
				<span className={`step${done ? " done" : ""}`}>{done ? <Icon name="check" size={13} /> : step}</span>
				<h2>{title}</h2>
				{aside && <div className="section-aside">{aside}</div>}
			</header>
			<div className="section-body">{children}</div>
		</section>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: { value: NoInfer<T>; label: ReactNode; title?: string }[];
	onChange(v: NoInfer<T>): void;
	label: string;
}) {
	return (
		<div className="segmented" role="radiogroup" aria-label={label}>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={o.value === value}
					title={o.title}
					className={o.value === value ? "on" : ""}
					onClick={() => onChange(o.value)}
				>
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
		<label className="switch" htmlFor={id}>
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			<span className="switch-track" aria-hidden="true" />
			<span className="switch-label">
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
		if (raw.trim() !== "" && Number.isFinite(v)) {
			onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
		}
	};
	return (
		<label className="num" htmlFor={id}>
			<span>{label}</span>
			<span className="num-input">
				<input
					id={id}
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
				{suffix && <em>{suffix}</em>}
			</span>
		</label>
	);
}

export function FileDrop({
	accept,
	onFile,
	children,
	className = "",
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
			className={`drop ${over ? "over" : ""} ${className}`}
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

export interface ToastMessage {
	id: number;
	kind: "info" | "error" | "success";
	text: string;
}

export function Toasts({ items, onDismiss }: { items: ToastMessage[]; onDismiss(id: number): void }) {
	return (
		<div className="toasts" role="status" aria-live="polite">
			{items.map((t) => (
				<div key={t.id} className={`toast ${t.kind}`}>
					<span>{t.text}</span>
					<button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
						<Icon name="x" size={14} />
					</button>
				</div>
			))}
		</div>
	);
}
