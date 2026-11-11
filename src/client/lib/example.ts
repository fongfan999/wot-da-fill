import { useEffect, useState } from "react";

/**
 * Which language the example is in. English by default; Vietnamese one click away on the home
 * page. It changes only the example (the sample invitation, its names and the example name in a
 * placed box), never the interface, and is remembered on this device.
 */
export type ExampleLang = "en" | "vi";

const KEY = "wdf:example-lang";
const listeners = new Set<(lang: ExampleLang) => void>();

let current: ExampleLang = (() => {
	try {
		return localStorage.getItem(KEY) === "vi" ? "vi" : "en";
	} catch {
		return "en";
	}
})();

export function getExampleLang(): ExampleLang {
	return current;
}

export function setExampleLang(lang: ExampleLang) {
	current = lang;
	try {
		localStorage.setItem(KEY, lang);
	} catch {
		// Storage can be blocked; the choice just lasts for this visit.
	}
	listeners.forEach((l) => l(lang));
}

export function useExampleLang(): [ExampleLang, (lang: ExampleLang) => void] {
	const [lang, setLang] = useState(current);
	useEffect(() => {
		listeners.add(setLang);
		return () => void listeners.delete(setLang);
	}, []);
	return [lang, setExampleLang];
}

/** Everything that differs between the two examples. */
export const EXAMPLE = {
	en: {
		/** Shown in a placed box before any list is added. */
		name: "Emma Thompson",
		columns: ["Name", "Table"],
		nameText: "{Name}",
		tableText: "Table {Table}",
		guests: [
			"Emma Thompson",
			"James Carter",
			"Sophia Nguyen",
			"Benjamin Okafor",
			"Alexandra Montgomery-Whitfield",
			"Oliver Bennett",
			"Charlotte Davies",
			"Noah Patel",
			"Grace Kim",
			"Henry Walsh",
			"Ava Rodriguez",
			"Liam O'Brien",
		],
		/** The home page's list and cards, in the design system's order. */
		showcase: ["Emma Thompson", "James Carter", "Sophia Nguyen", "Benjamin Okafor"],
		card: {
			kicker: "INVITATION",
			invite: "We warmly invite",
			occasion: "to celebrate our wedding",
			couple: "Olivia & Daniel",
			when: "6 PM · SATURDAY · 20 DECEMBER 2026 · RIVERSIDE CONVENTION CENTRE",
		},
		listName: "the sample list",
	},
	vi: {
		name: "Nguyễn Văn An",
		columns: ["Họ tên", "Bàn"],
		nameText: "{Họ tên}",
		tableText: "Bàn số {Bàn}",
		guests: [
			"Nguyễn Văn An",
			"Trần Thị Bích Ngọc",
			"Lê Hoàng Phúc",
			"Phạm Minh Châu",
			"Tôn Nữ Hoàng Thị Phương Uyên",
			"Võ Đức Thắng",
			"Đặng Khánh Linh",
			"Bùi Quốc Huy",
			"Huỳnh Ngọc Ánh",
			"Đỗ Thanh Tùng",
			"Ngô Gia Hân",
			"Dương Trọng Nghĩa",
		],
		showcase: ["Nguyễn Văn An", "Trần Thị Bích Ngọc", "Lê Hoàng Minh Châu", "Phạm Quốc Bảo"],
		card: {
			kicker: "THIỆP MỜI",
			invite: "Trân trọng kính mời",
			occasion: "đến dự tiệc mừng lễ thành hôn của chúng tôi",
			couple: "Minh Quân & Thảo Vy",
			when: "VÀO LÚC 18:00 · THỨ BẢY 20.12.2026 · TRUNG TÂM HỘI NGHỊ RIVERSIDE",
		},
		listName: "the sample list",
	},
} as const;
