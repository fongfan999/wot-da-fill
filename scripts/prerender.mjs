#!/usr/bin/env node
// Runs after `vite build`. Turns the built index.html into the site's pages:
//   index.html     the English home page, drawn in full (what search engines and AI crawlers read)
//   vi/index.html  the Vietnamese home page, drawn in full
//   app.html       the empty app, for share links (/t/<id>, served by the Worker); not indexed
//   404.html       the empty app for any other address, served with a 404; not indexed
//   sitemap.xml    the home pages, with each one's other language
// Each page gets its own title, description, canonical address, language links, social card and
// structured data. The home page is drawn by the app's own code (src/client/prerender.tsx).
import { readFile, mkdir, writeFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const ORIGIN = "https://fill.wotda.app";
const out = new URL("../dist/client/", import.meta.url);
const LANGS = ["en", "vi"];
const PATH = { en: "/", vi: "/vi/" };
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
const { renderHome, STRINGS } = render;

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** The head tags for a page: everything between <!--seo--> and <!--/seo-->. */
function seo(lang, { indexable }) {
	const t = STRINGS[lang];
	const url = ORIGIN + PATH[lang];
	const tags = [
		`<title>${esc(t.docTitle)}</title>`,
		`<meta name="description" content="${esc(t.docDescription)}" />`,
	];
	if (indexable) {
		tags.push(
			`<link rel="canonical" href="${url}" />`,
			...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN + PATH[l]}" />`),
			`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`,
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
		`<meta property="og:title" content="${esc(t.docTitle)}" />`,
		`<meta property="og:description" content="${esc(t.docDescription)}" />`,
		`<meta property="og:image" content="${ORIGIN}/og.png" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="${esc(t.home.pictureLabel)}" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
	);
	if (indexable) tags.push(`<script type="application/ld+json">${structuredData(lang)}</script>`);
	return tags.map((tag) => `\t\t${tag}`).join("\n");
}

/** What the page is, for search engines and AI answers: a free web app, and who makes it. */
function structuredData(lang) {
	const t = STRINGS[lang];
	const data = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebApplication",
				"@id": `${ORIGIN}/#app`,
				name: "Wot Da Fill",
				url: ORIGIN + PATH[lang],
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

function page(lang, { indexable, body = "" }) {
	// React puts the hero picture's preloads ahead of the page; they belong in the head, where the
	// browser finds them first and where they don't sit in the way of the app taking the page over.
	const preloads = [];
	body = body.replace(/^(?:<link [^>]*\/>)+/, (links) => {
		preloads.push(...links.match(/<link [^>]*\/>/g));
		return "";
	});
	const tags = seo(lang, { indexable }) + preloads.map((l) => `\n\t\t${l}`).join("");
	const head = template.replace(/[ \t]*<!--seo-->[\s\S]*?<!--\/seo-->/, `\t\t<!--seo-->\n${tags}\n\t\t<!--/seo-->`);
	return head.replace('<html lang="en">', `<html lang="${lang}">`).replace("<!--app-->", body);
}

for (const lang of LANGS) {
	const html = renderHome(lang);
	const dir = new URL(PATH[lang].slice(1), out);
	await mkdir(dir, { recursive: true });
	await writeFile(new URL("index.html", dir), page(lang, { indexable: true, body: html }));
	console.log(`prerendered ${PATH[lang]} (${(html.length / 1024).toFixed(1)} KB of HTML)`);
}
// The empty app: the language is picked in the browser, so it starts with the English head.
await writeFile(new URL("app.html", out), page("en", { indexable: false }));
await writeFile(new URL("404.html", out), page("en", { indexable: false }));

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(
	(lang) => `\t<url>
\t\t<loc>${ORIGIN + PATH[lang]}</loc>
\t\t<lastmod>${today}</lastmod>
${LANGS.map((l) => `\t\t<xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN + PATH[l]}" />`).join("\n")}
\t\t<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />
\t</url>`,
).join("\n")}
</urlset>
`;
await writeFile(new URL("sitemap.xml", out), sitemap);
console.log("wrote app.html, 404.html and sitemap.xml");
