import { renderToString } from "react-dom/server";
import { HomePage } from "./components/HomePage";
import { setLang, type Lang } from "./lib/i18n";
import type { PageId } from "./lib/pages";

/**
 * A page as HTML, for scripts/prerender.mjs: what search engines and AI crawlers read, and what a
 * visitor sees before the app has loaded. The app then takes it over (main.tsx).
 */
export function renderPage(id: PageId, lang: Lang): string {
	setLang(lang);
	return renderToString(<HomePage page={id} onFile={() => {}} onExample={() => {}} />);
}

export { STRINGS } from "./lib/i18n";
export { PAGE_IDS, PAGE_PATH, USE_COPY } from "./lib/pages";
