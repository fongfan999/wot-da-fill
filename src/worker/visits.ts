/**
 * One row in Workers Analytics Engine for each page someone (or something) opens, so we can see
 * whether people arrive from AI assistants and search, and whether AI crawlers read the site.
 * The dataset is wot_da_fill_visits (wrangler.jsonc); read it with `pnpm traffic` (scripts/traffic.mjs).
 *
 * What is kept: the page, what kind of request it was, where it came from (a channel such as "ai"
 * or "search", a name such as "chatgpt", and the referring site's host), which crawler it was if
 * it was one, the country, and the status. Nothing else: no IP address, no full user agent, no
 * cookies, no query string, and never anything from a list of names (that never leaves the browser).
 *
 * Columns, in order (the report script relies on them):
 *   blob1 path · blob2 kind · blob3 channel · blob4 source · blob5 referrer host · blob6 bot type ·
 *   blob7 bot name · blob8 country · double1 status · index1 path
 */

const SITE_HOST = "fill.wotda.app";

/** The files besides pages worth knowing about: who reads them says who is crawling. */
const FILES = new Set(["/robots.txt", "/llms.txt", "/sitemap.xml"]);

type Kind = "page" | "share" | "file" | "notfound";

export function logVisit(dataset: AnalyticsEngineDataset | undefined, request: Request, url: URL, response: Response) {
	if (!dataset || request.method !== "GET") return;
	const html = response.headers.get("content-type")?.startsWith("text/html") ?? false;
	let kind: Kind;
	if (url.pathname.startsWith("/t/")) kind = "share";
	else if (FILES.has(url.pathname)) kind = "file";
	else if (!html) return;
	else kind = response.status === 404 ? "notfound" : "page";

	// A share link's id is private: only that one was opened.
	const path = kind === "share" ? "/t" : url.pathname.slice(0, 200);
	const bot = botOf(request.headers.get("user-agent") ?? "");
	const from = sourceOf(url, request.headers.get("referer"));
	const country = (request.cf?.country as string | undefined) ?? "";
	try {
		dataset.writeDataPoint({
			blobs: [path, kind, from.channel, from.source, from.host, bot.type, bot.name, country],
			doubles: [response.status],
			indexes: [path.slice(0, 96)],
		});
	} catch (err) {
		// Counting visits must never break a page.
		console.error("logVisit", err);
	}
}

/** Crawlers by the name in their user agent: [substring, name, type]. Checked in order. */
const BOTS: [string, string, "ai" | "search" | "preview"][] = [
	["OAI-SearchBot", "OAI-SearchBot", "ai"],
	["ChatGPT-User", "ChatGPT-User", "ai"],
	["GPTBot", "GPTBot", "ai"],
	["Claude-SearchBot", "Claude-SearchBot", "ai"],
	["Claude-User", "Claude-User", "ai"],
	["ClaudeBot", "ClaudeBot", "ai"],
	["anthropic-ai", "ClaudeBot", "ai"],
	["Perplexity-User", "Perplexity-User", "ai"],
	["PerplexityBot", "PerplexityBot", "ai"],
	["Google-CloudVertexBot", "Google-CloudVertexBot", "ai"],
	["meta-externalagent", "Meta-ExternalAgent", "ai"],
	["meta-externalfetcher", "Meta-ExternalFetcher", "ai"],
	["MistralAI-User", "MistralAI-User", "ai"],
	["DuckAssistBot", "DuckAssistBot", "ai"],
	["Amazonbot", "Amazonbot", "ai"],
	["Bytespider", "Bytespider", "ai"],
	["CCBot", "CCBot", "ai"],
	["cohere-ai", "Cohere", "ai"],
	["Google-InspectionTool", "Google-InspectionTool", "search"],
	["Googlebot", "Googlebot", "search"],
	["bingbot", "Bingbot", "search"],
	["Applebot", "Applebot", "search"],
	["DuckDuckBot", "DuckDuckBot", "search"],
	["YandexBot", "YandexBot", "search"],
	["Baiduspider", "Baiduspider", "search"],
	["coccocbot", "CocCocBot", "search"],
	["Yeti", "NaverBot", "search"],
	["SeznamBot", "SeznamBot", "search"],
	["facebookexternalhit", "Facebook", "preview"],
	["Twitterbot", "Twitter", "preview"],
	["LinkedInBot", "LinkedIn", "preview"],
	["Slackbot", "Slack", "preview"],
	["Discordbot", "Discord", "preview"],
	["TelegramBot", "Telegram", "preview"],
	["WhatsApp", "WhatsApp", "preview"],
];

/** Anything else that says it is automated. */
const OTHER_BOT = /bot\b|crawl|spider|slurp|headless|curl\/|wget\/|python-requests|python-httpx|go-http-client|node-fetch|axios\//i;

export function botOf(ua: string): { type: string; name: string } {
	for (const [needle, name, type] of BOTS) if (ua.includes(needle)) return { type, name };
	if (OTHER_BOT.test(ua)) return { type: "other", name: ua.match(/[A-Za-z][\w.-]*(?:bot|crawler|spider)/i)?.[0]?.slice(0, 40) ?? "other" };
	return { type: "", name: "" };
}

/** Where a visit came from, by referring site (or utm_source, which some AI apps add): [host pattern, source, channel]. */
const SOURCES: [RegExp, string, "ai" | "search" | "social"][] = [
	[/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt", "ai"],
	[/(^|\.)perplexity\.ai$/, "perplexity", "ai"],
	[/^gemini\.google\.com$|^bard\.google\.com$/, "gemini", "ai"],
	[/(^|\.)claude\.ai$/, "claude", "ai"],
	[/^copilot\.microsoft\.com$|^copilot\.cloud\.microsoft$/, "copilot", "ai"],
	[/(^|\.)deepseek\.com$/, "deepseek", "ai"],
	[/(^|\.)grok\.com$/, "grok", "ai"],
	[/(^|\.)meta\.ai$/, "meta-ai", "ai"],
	[/(^|\.)mistral\.ai$/, "mistral", "ai"],
	[/(^|\.)you\.com$/, "you", "ai"],
	[/(^|\.)phind\.com$/, "phind", "ai"],
	[/(^|\.)google\.[a-z.]+$/, "google", "search"],
	[/(^|\.)bing\.com$/, "bing", "search"],
	[/(^|\.)duckduckgo\.com$/, "duckduckgo", "search"],
	[/(^|\.)coccoc\.com$/, "coccoc", "search"],
	[/(^|\.)yahoo\.com$/, "yahoo", "search"],
	[/(^|\.)yandex\.[a-z.]+$/, "yandex", "search"],
	[/(^|\.)brave\.com$/, "brave", "search"],
	[/(^|\.)ecosia\.org$/, "ecosia", "search"],
	[/(^|\.)naver\.com$/, "naver", "search"],
	[/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)messenger\.com$/, "facebook", "social"],
	[/(^|\.)instagram\.com$/, "instagram", "social"],
	[/(^|\.)zalo\.me$/, "zalo", "social"],
	[/(^|\.)reddit\.com$/, "reddit", "social"],
	[/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x", "social"],
	[/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin", "social"],
	[/(^|\.)youtube\.com$|^youtu\.be$/, "youtube", "social"],
	[/(^|\.)tiktok\.com$/, "tiktok", "social"],
	[/(^|\.)threads\.(net|com)$/, "threads", "social"],
	[/(^|\.)producthunt\.com$/, "producthunt", "social"],
	[/(^|\.)news\.ycombinator\.com$/, "hackernews", "social"],
	[/(^|\.)alternativeto\.net$/, "alternativeto", "social"],
	[/(^|\.)github\.com$/, "github", "social"],
];

export function sourceOf(url: URL, referer: string | null): { channel: string; source: string; host: string } {
	// ChatGPT and some other assistants add ?utm_source=chatgpt.com to the links they show.
	const utm = url.searchParams.get("utm_source")?.toLowerCase().slice(0, 60) ?? "";
	let host = "";
	try {
		host = referer ? new URL(referer).hostname.toLowerCase() : "";
	} catch {
		// A malformed Referer counts as none.
	}
	for (const candidate of [utm.replace(/^https?:\/\//, "").split("/")[0], host]) {
		if (!candidate) continue;
		for (const [pattern, source, channel] of SOURCES) if (pattern.test(candidate)) return { channel, source, host };
	}
	if (host === SITE_HOST || host === "localhost") return { channel: "internal", source: "", host: "" };
	if (host) return { channel: "other", source: host, host };
	if (utm) return { channel: "other", source: utm, host: "" };
	return { channel: "direct", source: "", host: "" };
}
