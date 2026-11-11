import { getLang, type Lang } from "./i18n";

/** The examples follow the site's language. */
export type ExampleLang = Lang;
export const getExampleLang = getLang;

/** The three examples people can start from (design system ExampleCard). */
export type ExampleKind = "invitation" | "certificate" | "badge";
export const EXAMPLE_KINDS: ExampleKind[] = ["invitation", "certificate", "badge"];

/** Each example's size in pixels, as drawn and as downloaded. */
export const EXAMPLE_SIZE: Record<ExampleKind, { w: number; h: number }> = {
	invitation: { w: 2000, h: 1400 },
	certificate: { w: 2000, h: 1400 },
	badge: { w: 1200, h: 1600 },
};

/** Everything that differs between the English and Vietnamese examples. */
export const EXAMPLE = {
	en: {
		/** Shown in a placed box before any list is added. */
		name: "Emma Thompson",
		nameColumn: "Name",
		tableColumn: "Table",
		companyColumn: "Company",
		tableText: "Table {Table}",
		names: ["Emma Thompson", "James Carter", "Sophia Nguyen", "Benjamin Okafor"],
		tables: ["1", "1", "2", "2"],
		companies: ["Northwind", "Lumen Labs", "Kite & Co", "Fieldnote"],
		file: { invitation: "example-invitation.png", certificate: "example-certificate.png", badge: "example-name-badge.png" },
		invitation: {
			kicker: "TOGETHER WITH THEIR FAMILIES",
			couple: ["Olivia", "Daniel"],
			invite: "warmly invite",
			occasion: "to celebrate their wedding",
			day: "SATURDAY",
			date: "20.12.2026",
			time: "6:00 PM",
			venue: "RIVERSIDE HALL · HO CHI MINH CITY",
		},
		certificate: {
			org: "NORTH STUDIO ACADEMY",
			title: "Certificate of Completion",
			lead: "This certifies that",
			after: "has completed the course",
			course: "Foundations of Product Design",
			meta: "12 hours · Autumn 2026",
			sign: "COURSE DIRECTOR",
			dateLabel: "DATE",
			date: "20 Dec 2026",
		},
		badge: { event: ["PRODUCT", "NIGHT"], sub: "HO CHI MINH CITY · 2026", band: "ATTENDEE" },
	},
	vi: {
		name: "Nguyễn Văn An",
		nameColumn: "Họ tên",
		tableColumn: "Bàn",
		companyColumn: "Công ty",
		tableText: "Bàn {Bàn}",
		names: ["Nguyễn Văn An", "Trần Thị Bích Ngọc", "Lê Hoàng Minh Châu", "Phạm Quốc Bảo"],
		tables: ["1", "1", "2", "2"],
		companies: ["Sao Mai", "Lumen Labs", "Xưởng Gỗ Nhỏ", "Fieldnote"],
		file: { invitation: "thiep-moi-mau.png", certificate: "chung-nhan-mau.png", badge: "the-ten-mau.png" },
		invitation: {
			kicker: "CÙNG GIA ĐÌNH HAI BÊN",
			couple: ["Minh Quân", "Thảo Vy"],
			invite: "trân trọng kính mời",
			occasion: "đến dự lễ thành hôn",
			day: "THỨ BẢY",
			date: "20.12.2026",
			time: "18:00",
			venue: "TRUNG TÂM HỘI NGHỊ RIVERSIDE",
		},
		certificate: {
			org: "HỌC VIỆN NORTH STUDIO",
			title: "Chứng nhận hoàn thành",
			lead: "Chứng nhận",
			after: "đã hoàn thành khoá học",
			course: "Nền tảng Thiết kế Sản phẩm",
			meta: "12 giờ · Mùa thu 2026",
			sign: "GIÁM ĐỐC KHOÁ HỌC",
			dateLabel: "NGÀY",
			date: "20.12.2026",
		},
		badge: { event: ["PRODUCT", "NIGHT"], sub: "TP. HỒ CHÍ MINH · 2026", band: "KHÁCH MỜI" },
	},
} as const;

/** The second piece of text each example carries beside the name (none on the certificate). */
export function exampleExtra(lang: ExampleLang, kind: ExampleKind): readonly string[] | null {
	const ex = EXAMPLE[lang];
	return kind === "invitation" ? ex.tables : kind === "badge" ? ex.companies : null;
}

/** The sample list that comes with an example: its headings, then one row per name. */
export function exampleGrid(lang: ExampleLang, kind: ExampleKind): string[][] {
	const ex = EXAMPLE[lang];
	const extra = exampleExtra(lang, kind);
	const head = kind === "invitation" ? [ex.nameColumn, ex.tableColumn] : kind === "badge" ? [ex.nameColumn, ex.companyColumn] : [ex.nameColumn];
	return [head, ...ex.names.map((n, i) => (extra ? [n, extra[i]] : [n]))];
}
