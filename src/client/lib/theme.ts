import { useSyncExternalStore } from "react";

/**
 * Light or dark. Until someone presses the theme button the site follows their system (and keeps
 * following it if it changes); once they choose, the choice is remembered on this device. The
 * resolved theme is always written to <html data-theme>, which is what the stylesheet reads.
 */
export type Theme = "light" | "dark";

const KEY = "wdf:theme";
const browser = typeof window !== "undefined";
// Pre-rendering has no window: the page is drawn light, and index.html sets the real theme before it shows.
const system = browser ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const listeners = new Set<() => void>();

let chosen: Theme | null = (() => {
	if (!browser) return null;
	try {
		const saved = localStorage.getItem(KEY);
		return saved === "light" || saved === "dark" ? saved : null;
	} catch {
		return null;
	}
})();

export function getTheme(): Theme {
	return chosen ?? (system?.matches ? "dark" : "light");
}

function apply() {
	const theme = getTheme();
	document.documentElement.dataset.theme = theme;
	document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", theme === "dark" ? "#151713" : "#f7f5ee");
	listeners.forEach((l) => l());
}

export function setTheme(theme: Theme) {
	chosen = theme;
	try {
		localStorage.setItem(KEY, theme);
	} catch {
		// Storage can be blocked; the choice just lasts for this visit.
	}
	apply();
}

if (system) {
	system.addEventListener("change", () => {
		if (!chosen) apply();
	});
	apply();
}

const subscribe = (l: () => void) => {
	listeners.add(l);
	return () => void listeners.delete(l);
};
/** What the pre-rendered page was drawn with; a page in dark redraws straight after it loads. */
const serverTheme = (): Theme => "light";

export function useTheme(): [Theme, (theme: Theme) => void] {
	return [useSyncExternalStore(subscribe, getTheme, serverTheme), setTheme];
}
