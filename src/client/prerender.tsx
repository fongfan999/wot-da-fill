import { renderToString } from "react-dom/server";
import { HomePage } from "./components/HomePage";
import { setLang, type Lang } from "./lib/i18n";

/**
 * The home page as HTML, for scripts/prerender.mjs: what search engines and AI crawlers read, and
 * what a visitor sees before the app has loaded. The app then takes it over (main.tsx).
 */
export function renderHome(lang: Lang): string {
	setLang(lang);
	return renderToString(<HomePage onFile={() => {}} onExample={() => {}} />);
}

export { STRINGS } from "./lib/i18n";
