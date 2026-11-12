#!/usr/bin/env node
// Runs after `vite build`. Turns the built index.html into the site's pages (src/client/lib/pages.ts):
//   index.html, vi/index.html          the home page in each language, drawn in full
//   invitation-names.html, vi/…html    each problem page in each language, drawn in full
//   app.html                           the empty app, for share links (/t/<id>, served by the Worker); not indexed
//   404.html                           the empty app for any other address, served with a 404; not indexed
//   sitemap.xml                        every page, with its other language
// Each page gets its own title, description, canonical address, language links, social card and
// structured data (with its questions as FAQPage). Pages are drawn by the app's own code
// (src/client/prerender.tsx), so they are what search engines and AI crawlers read.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const ORIGIN = "https://fill.wotda.app";
const out = new URL("../dist/client/", import.meta.url);
const LANGS = ["en", "vi"];
const LOCALE = { en: "en_US", vi: "vi_VN" };

const template = await readFile(new URL("index.html", out), "utf8");
if (!template.includes("<!--seo-->") || !template.includes("<!--app-->")) {
	throw new Error("dist/client/index.html has no <!--seo--> or <!--app--> mark. Was it built from index.html?");
}

// The app's own modules, loaded through Vite so TypeScript, JSX and JSON imports work as in the app.
const vite = await createServer({
	configFile: false,
	plugins: [react()],
	logLevel: "error",
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
});
let render;
try {
	render = await vite.ssrLoadModule("/src/client/prerender.tsx");
} finally {
	await vite.close();
}
const { renderPage, STRINGS, PAGE_IDS, PAGE_PATH, USE_COPY } = render;

/** A page's words: the home page's from the strings, a problem page's from its copy. */
const copy = (id, lang) =>
	id === "home"
		? { title: STRINGS[lang].docTitle, description: STRINGS[lang].docDescription, faq: STRINGS[lang].home.faq }
		: USE_COPY[id][lang];

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** The head tags for a page: everything between <!--seo--> and <!--/seo-->. */
function seo(id, lang, { indexable }) {
	const t = STRINGS[lang];
	const { title, description } = copy(id, lang);
	const url = ORIGIN + PAGE_PATH[id][lang];
	const tags = [`<title>${esc(title)}</title>`, `<meta name="description" content="${esc(description)}" />`];
	if (indexable) {
		tags.push(
			`<link rel="canonical" href="${url}" />`,
			...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN + PAGE_PATH[id][l]}" />`),
			`<link rel="alternate" hreflang="x-default" href="${ORIGIN + PAGE_PATH[id].en}" />`,
		);
	} else {
		tags.push(`<meta name="robots" content="noindex" />`);
	}
	// What a shared link shows in chats and on social sites.
	tags.push(
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="Wot Da Fill" />`,
		`<meta property="og:locale" content="${LOCALE[lang]}" />`,
		...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}" />`),
		...(indexable ? [`<meta property="og:url" content="${url}" />`] : []),
		`<meta property="og:title" content="${esc(title)}" />`,
		`<meta property="og:description" content="${esc(description)}" />`,
		`<meta property="og:image" content="${ORIGIN}/og.png" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="${esc(t.home.pictureLabel)}" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
	);
	if (indexable) tags.push(`<script type="application/ld+json">${structuredData(id, lang)}</script>`);
	return tags.map((tag) => `\t\t${tag}`).join("\n");
}

/**
 * What the page is, for search engines and AI answers: the page with its questions and answers,
 * the free web app it is about, and who makes it.
 */
function structuredData(id, lang) {
	const t = STRINGS[lang];
	const url = ORIGIN + PAGE_PATH[id][lang];
	const { title, description, faq } = copy(id, lang);
	const data = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": ["WebPage", "FAQPage"],
				"@id": `${url}#page`,
				url,
				name: title,
				description,
				inLanguage: lang,
				about: { "@id": `${ORIGIN}/#app` },
				mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
			},
			{
				"@type": "WebApplication",
				"@id": `${ORIGIN}/#app`,
				name: "Wot Da Fill",
				url: ORIGIN + PAGE_PATH.home[lang],
				description: t.docDescription,
				inLanguage: lang,
				availableLanguage: LANGS,
				applicationCategory: "DesignApplication",
				operatingSystem: "Any (runs in a web browser)",
				browserRequirements: "Requires JavaScript",
				isAccessibleForFree: true,
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				featureList: [t.home.step1, t.home.step2, t.home.step3, ...t.home.facts.map(([title]) => title)],
				image: `${ORIGIN}/og.png`,
				creator: { "@id": "https://wotdafong.dev/#org" },
			},
			{ "@type": "Organization", "@id": "https://wotdafong.dev/#org", name: "Wot Da Fong", url: "https://wotdafong.dev" },
		],
	};
	// Keep "</script>" from ever closing the tag early.
	return JSON.stringify(data).replaceAll("<", "\\u003c");
}

function page(id, lang, { indexable, body = "" }) {
	// React puts the hero picture's preloads ahead of the page; they belong in the head, where the
	// browser finds them first and where they don't sit in the way of the app taking the page over.
	const preloads = [];
	body = body.replace(/^(?:<link [^>]*\/>)+/, (links) => {
		preloads.push(...links.match(/<link [^>]*\/>/g));
		return "";
	});
	const tags = seo(id, lang, { indexable }) + preloads.map((l) => `\n\t\t${l}`).join("");
	const head = template.replace(/[ \t]*<!--seo-->[\s\S]*?<!--\/seo-->/, `\t\t<!--seo-->\n${tags}\n\t\t<!--/seo-->`);
	return head.replace('<html lang="en">', `<html lang="${lang}">`).replace("<!--app-->", body);
}

/** Where a page's file goes: /vi/ → vi/index.html, /vi/the-ten-tu-excel → vi/the-ten-tu-excel.html. */
const fileFor = (path) => (path.endsWith("/") ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`);

for (const id of PAGE_IDS) {
	for (const lang of LANGS) {
		const html = renderPage(id, lang);
		const file = new URL(fileFor(PAGE_PATH[id][lang]), out);
		await mkdir(new URL(".", file), { recursive: true });
		await writeFile(file, page(id, lang, { indexable: true, body: html }));
		console.log(`prerendered ${PAGE_PATH[id][lang]} (${(html.length / 1024).toFixed(1)} KB of HTML)`);
	}
}
// The empty app: the language is picked in the browser, so it starts with the English head.
await writeFile(new URL("app.html", out), page("home", "en", { indexable: false }));
await writeFile(new URL("404.html", out), page("home", "en", { indexable: false }));

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGE_IDS.flatMap((id) =>
	LANGS.map(
		(lang) => `\t<url>
\t\t<loc>${ORIGIN + PAGE_PATH[id][lang]}</loc>
\t\t<lastmod>${today}</lastmod>
${LANGS.map((l) => `\t\t<xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN + PAGE_PATH[id][l]}" />`).join("\n")}
\t\t<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN + PAGE_PATH[id].en}" />
\t</url>`,
	),
).join("\n")}
</urlset>
`;
await writeFile(new URL("sitemap.xml", out), sitemap);

// llms.txt (llmstxt.org): the site in plain words for AI assistants, with every page in both
// languages and the home page's questions answered.
const md = (s) => s.replaceAll("“", '"').replaceAll("”", '"').replaceAll("’", "'");
const pageLines = (lang) =>
	PAGE_IDS.map((id) => {
		const name = id === "home" ? (lang === "en" ? "Home" : "Trang chủ") : USE_COPY[id][lang].nav;
		return `- [${md(name)}](${ORIGIN + PAGE_PATH[id][lang]}): ${md(copy(id, lang).description)}`;
	}).join("\n");
const llms = `# Wot Da Fill

> ${md(STRINGS.en.docDescription)}

${md(STRINGS.en.home.faq[0][1])} Made by Wot Da Fong (https://wotdafong.dev). Source code: https://github.com/fongfan999/wot-da-fill.

## Pages

${pageLines("en")}

## Tiếng Việt

${pageLines("vi")}

## Questions

${STRINGS.en.home.faq.map(([q, a]) => `### ${md(q)}\n\n${md(a)}`).join("\n\n")}
`;
await writeFile(new URL("llms.txt", out), llms);
console.log("wrote app.html, 404.html, sitemap.xml and llms.txt");
