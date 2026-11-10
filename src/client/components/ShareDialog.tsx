import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

export function ShareDialog({ onShare, onClose }: { onShare(): Promise<string>; onClose(): void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done"; url: string } | { kind: "error"; message: string }>({
		kind: "idle",
	});
	const [copied, setCopied] = useState(false);

	useEffect(() => ref.current?.showModal(), []);

	const close = () => {
		ref.current?.close();
		onClose();
	};

	const share = async () => {
		setState({ kind: "busy" });
		try {
			setState({ kind: "done", url: await onShare() });
		} catch (err) {
			setState({ kind: "error", message: err instanceof Error ? err.message : "Sharing failed." });
		}
	};

	const copy = async (url: string) => {
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	};

	return (
		<dialog ref={ref} className="dialog share" onCancel={close} aria-labelledby="share-title">
			<header className="dialog-head">
				<h2 id="share-title">Share this template</h2>
				<button type="button" className="icon-btn" aria-label="Close" onClick={close}>
					<Icon name="x" />
				</button>
			</header>
			<div className="dialog-body">
				{state.kind === "done" ? (
					<>
						<p>Anyone with this link can open the design and its text layout, then add their own list.</p>
						<div className="share-link">
							<input readOnly value={state.url} onFocus={(e) => e.target.select()} aria-label="Share link" />
							<button type="button" className="btn primary" onClick={() => copy(state.url)}>
								<Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy"}
							</button>
						</div>
					</>
				) : (
					<>
						<p>Creates a link to this design, its text boxes, fonts and export settings, so someone else can generate cards with their own list.</p>
						<ul className="checklist small">
							<li>
								<Icon name="check" size={14} /> Uploaded: the design image, layout and any fonts you uploaded
							</li>
							<li>
								<Icon name="check" size={14} /> Never uploaded: your guest list. It stays in this browser.
							</li>
						</ul>
						{state.kind === "error" && <p className="warn small">{state.message}</p>}
						<div className="row end">
							<button type="button" className="btn ghost" onClick={close}>
								Cancel
							</button>
							<button type="button" className="btn primary" onClick={share} disabled={state.kind === "busy"}>
								<Icon name="link" /> {state.kind === "busy" ? "Uploading..." : "Create link"}
							</button>
						</div>
					</>
				)}
			</div>
		</dialog>
	);
}
