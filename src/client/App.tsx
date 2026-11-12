import { lazy, Suspense, useEffect, useState } from "react";
import { HomePage } from "./components/HomePage";
import type { Start } from "./Workspace";

const loadWorkspace = () => import("./Workspace");
const Workspace = lazy(() => loadWorkspace().then((m) => ({ default: m.Workspace })));

const SHARE_PATH = /^\/t\/[A-Za-z0-9]{16}\/?$/;

/**
 * The home page on its own, so a first visit downloads only what it shows. The editor (Workspace)
 * comes in a second download: straight away for a shared link, otherwise fetched quietly once the
 * page has loaded, and opened by the first picture or example.
 */
export function App() {
	const [start, setStart] = useState<Start | null>(null);
	const shared = SHARE_PATH.test(location.pathname);

	useEffect(() => {
		const prefetch = () => setTimeout(() => void loadWorkspace().catch(() => {}), 1500);
		if (document.readyState === "complete") return void prefetch();
		window.addEventListener("load", prefetch, { once: true });
		return () => window.removeEventListener("load", prefetch);
	}, []);

	const home = <HomePage onFile={(file) => setStart({ file })} onExample={(example) => setStart({ example })} />;
	if (!start && !shared) return home;
	// While the editor downloads, the home page stays as it was; a shared link shows nothing yet.
	return (
		<Suspense fallback={shared ? null : home}>
			<Workspace start={start ?? undefined} />
		</Suspense>
	);
}
