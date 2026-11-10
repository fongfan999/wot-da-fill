import { useState } from "react";
import { Button, Dialog } from "./ui";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; url: string; copied: boolean } | { kind: "error"; message: string };

export function ShareDialog({ onShare, onClose }: { onShare(): Promise<string>; onClose(): void }) {
	const [state, setState] = useState<State>({ kind: "idle" });

	const copy = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			setState({ kind: "done", url, copied: true });
		} catch {
			// Some browsers only allow copying straight after a click; the link is shown to copy by hand.
			setState({ kind: "done", url, copied: false });
		}
	};

	const share = async () => {
		if (state.kind === "done") return copy(state.url);
		setState({ kind: "busy" });
		try {
			await copy(await onShare());
		} catch (err) {
			setState({ kind: "error", message: err instanceof Error ? err.message : "Sharing didn't work. Try again in a moment." });
		}
	};

	return (
		<Dialog title="Share this layout" onClose={onClose}>
			<p>Anyone with the link gets your design, where the text goes and any fonts you added, then adds their own names.</p>
			<p className="wf-small wf-muted">Your list of names is never shared. It stays on this device.</p>
			{state.kind === "done" && (
				<div className="wf-share-link">
					<input className="wf-input" readOnly value={state.url} onFocus={(e) => e.target.select()} aria-label="Link to this layout" />
				</div>
			)}
			{state.kind === "error" && <p className="wf-small" style={{ color: "var(--error)" }} role="alert">{state.message}</p>}
			<div className="wf-actions">
				<Button variant="primary" icon={state.kind === "done" && state.copied ? "check" : "copy"} onClick={share} disabled={state.kind === "busy"}>
					{state.kind === "busy" ? "Making the link…" : state.kind === "done" && state.copied ? "Link copied" : "Copy link"}
				</Button>
			</div>
		</Dialog>
	);
}
