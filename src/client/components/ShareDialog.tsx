import { useState } from "react";
import { messageOf } from "../lib/errors";
import { useT } from "../lib/i18n";
import { Button, Dialog } from "./ui";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; url: string; copied: boolean } | { kind: "error"; message: string };

export function ShareDialog({ onShare, onClose }: { onShare(): Promise<string>; onClose(): void }) {
	const t = useT();
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
			setState({ kind: "error", message: messageOf(err, t.shareFailed) });
		}
	};

	return (
		<Dialog title={t.shareLayout} onClose={onClose}>
			<p>{t.shareBody}</p>
			<p className="wf-small wf-muted">{t.shareNote}</p>
			{state.kind === "done" && (
				<div className="wf-share-link">
					<input className="wf-input" readOnly value={state.url} onFocus={(e) => e.target.select()} aria-label={t.shareLinkLabel} />
				</div>
			)}
			{state.kind === "error" && (
				<p className="wf-small" style={{ color: "var(--error)" }} role="alert">
					{state.message}
				</p>
			)}
			{/* Said aloud too: the button's own label changing is easy to miss without sight. */}
			<span className="wf-sr" role="status">
				{state.kind === "done" && state.copied ? t.linkCopied : ""}
			</span>
			<div className="wf-actions">
				<Button variant="primary" icon={state.kind === "done" && state.copied ? "check" : "copy"} onClick={share} disabled={state.kind === "busy"}>
					{state.kind === "busy" ? t.makingLink : state.kind === "done" && state.copied ? t.linkCopied : t.copyLink}
				</Button>
			</div>
		</Dialog>
	);
}
