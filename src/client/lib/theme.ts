import { useEffect, useState } from "react";

/**
 * Light or dark. Until someone presses the theme button the site follows their system (and keeps
 * following it if it changes); once they choose, the choice is remembered on this device. The
 * resolved theme is always written to <html data-theme>, which is what the stylesheet reads.
 */
export type Theme = "light" | "dark";

const KEY = "wdf:theme";
const system = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<(theme: Theme) => void>();

let chosen: Theme | null = (() => {
	try {
		const saved = localStorage.getItem(KEY);
		return saved === "light" || saved === "dark" ? saved : null;
	} catch {
		return null;
	}
})();

export function getTheme(): Theme {
	return chosen ?? (system.matches ? "dark" : "light");
}

function apply() {
	const theme = getTheme();
	document.documentElement.dataset.theme = theme;
	document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", theme === "dark" ? "#151713" : "#f7f5ee");
	listeners.forEach((l) => l(theme));
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

system.addEventListener("change", () => {
	if (!chosen) apply();
});
apply();

export function useTheme(): [Theme, (theme: Theme) => void] {
	const [theme, set] = useState(getTheme);
	useEffect(() => {
		listeners.add(set);
		return () => void listeners.delete(set);
	}, []);
	return [theme, setTheme];
}
