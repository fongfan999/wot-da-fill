#!/usr/bin/env node
// Tells search engines that support IndexNow (Bing, which ChatGPT search draws on, plus Yandex,
// Seznam, Naver and others) that the site's pages changed, so they come back soon instead of
// whenever they next crawl. Google doesn't use IndexNow; it reads the sitemap.
//
// Runs after `wrangler deploy` (pnpm deploy). It sends every page in dist/client/sitemap.xml. The
// key is the 32-character file in public/: IndexNow fetches it from the live site to check the
// request comes from whoever runs the site, so the script checks it is live first.
//
//   node scripts/indexnow.mjs            send
//   node scripts/indexnow.mjs --dry-run  show what would be sent, send nothing
import { readdir, readFile } from "node:fs/promises";

const HOST = "fill.wotda.app";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");

const keyFile = (await readdir(new URL("../public/", import.meta.url))).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("No IndexNow key in public/ (a file named <32 hex characters>.txt holding those characters).");
const key = keyFile.slice(0, -4);
const keyLocation = `https://${HOST}/${keyFile}`;

const sitemap = await readFile(new URL("../dist/client/sitemap.xml", import.meta.url), "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error("dist/client/sitemap.xml lists no pages. Run pnpm build first.");

if (dryRun) {
	console.log(`IndexNow (dry run): would send ${urlList.length} pages with key ${keyLocation}`);
	for (const url of urlList) console.log(`  ${url}`);
	process.exit(0);
}

try {
	const live = await fetch(keyLocation);
	if (!live.ok || (await live.text()).trim() !== key) {
		console.warn(`IndexNow: skipped. ${keyLocation} isn't live yet (${live.status}); it goes up with the next deploy.`);
		process.exit(0);
	}
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json; charset=utf-8" },
		body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
	});
	// 200 = received, 202 = received and the key is still being checked.
	if (res.ok) console.log(`IndexNow: sent ${urlList.length} pages (${res.status}).`);
	else console.warn(`IndexNow: not accepted (${res.status} ${res.statusText}). ${(await res.text()).slice(0, 200)}`);
} catch (err) {
	// The site is already deployed; a failed ping only means search engines find out later.
	console.warn(`IndexNow: couldn't send (${err.message}). The deploy itself is fine.`);
}
