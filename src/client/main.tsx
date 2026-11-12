import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root")!;
const app = (
	<StrictMode>
		<App />
	</StrictMode>
);
// The home pages arrive already drawn (scripts/prerender.mjs), so the app takes over what is there;
// every other page (share links, the 404 page, the dev server) starts empty.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
