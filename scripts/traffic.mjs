#!/usr/bin/env node
// Where visits come from, read from the Workers Analytics Engine dataset the Worker writes one row
// per page to (src/worker/visits.ts): people arriving from AI assistants, search and social sites,
// which pages they land on, and which crawlers (AI and search) read the site.
//
//   pnpm traffic              the last 28 days
//   pnpm traffic --days 7     the last 7 days (data is kept for 3 months)
//   pnpm traffic --sql        print the queries, query nothing
//
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, in the environment or in .env (never
// committed). Make the token at dash.cloudflare.com/profile/api-tokens with one permission:
// Account > Account Analytics > Read.

const DATASET = "wot_da_fill_visits";
const args = process.argv.slice(2);
const daysArg = args.includes("--days") ? args[args.indexOf("--days") + 1] : "28";
const days = Number.parseInt(daysArg, 10);
if (!Number.isInteger(days) || days < 1 || days > 92) throw new Error(`--days must be a whole number from 1 to 92, not "${daysArg}".`);

// Columns (see visits.ts): blob1 path · blob2 kind · blob3 channel · blob4 source · blob5 referrer
// host · blob6 bot type · blob7 bot name · blob8 country · double1 status.
const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
const people = `${since} AND blob6 = '' AND blob2 IN ('page', 'share') AND double1 < 300`;
const count = "SUM(_sample_interval)";

const REPORTS = [
	{
		title: "People, by where they came from",
		sql: `SELECT blob3 AS channel, ${count} AS visits FROM ${DATASET} WHERE ${people} GROUP BY channel ORDER BY visits DESC`,
	},
	{
		title: "People sent by AI assistants, by page",
		sql: `SELECT blob4 AS assistant, blob1 AS page, ${count} AS visits FROM ${DATASET} WHERE ${people} AND blob3 = 'ai' GROUP BY assistant, page ORDER BY visits DESC LIMIT 40`,
	},
	{
		title: "People from search, social and other sites",
		sql: `SELECT blob3 AS channel, blob4 AS source, ${count} AS visits FROM ${DATASET} WHERE ${people} AND blob3 IN ('search', 'social', 'other') GROUP BY channel, source ORDER BY visits DESC LIMIT 30`,
	},
	{
		title: "Pages people opened",
		sql: `SELECT blob1 AS page, ${count} AS visits FROM ${DATASET} WHERE ${people} GROUP BY page ORDER BY visits DESC LIMIT 30`,
	},
	{
		title: "Crawlers",
		sql: `SELECT blob6 AS type, blob7 AS crawler, ${count} AS requests FROM ${DATASET} WHERE ${since} AND blob6 != '' GROUP BY type, crawler ORDER BY requests DESC LIMIT 40`,
	},
	{
		title: "What AI crawlers read",
		sql: `SELECT blob7 AS crawler, blob1 AS page, ${count} AS requests FROM ${DATASET} WHERE ${since} AND blob6 = 'ai' GROUP BY crawler, page ORDER BY requests DESC LIMIT 40`,
	},
	{
		title: "Addresses that don't exist (404)",
		sql: `SELECT blob1 AS page, blob6 AS bot, ${count} AS requests FROM ${DATASET} WHERE ${since} AND blob2 = 'notfound' GROUP BY page, bot ORDER BY requests DESC LIMIT 20`,
	},
	{
		title: "People, by country",
		sql: `SELECT blob8 AS country, ${count} AS visits FROM ${DATASET} WHERE ${people} GROUP BY country ORDER BY visits DESC LIMIT 15`,
	},
];

if (args.includes("--sql")) {
	for (const { title, sql } of REPORTS) console.log(`-- ${title}\n${sql};\n`);
	process.exit(0);
}

try {
	process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
	// No .env: the environment has to have them.
}
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
	console.error(
		"Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (in the environment or .env).\n" +
			"The token needs Account > Account Analytics > Read: dash.cloudflare.com/profile/api-tokens",
	);
	process.exit(1);
}

async function query(sql) {
	const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
		body: `${sql} FORMAT JSON`,
	});
	const text = await res.text();
	if (!res.ok) {
		// Before the first visit is written, the dataset doesn't exist yet.
		if (/unknown table|does not exist/i.test(text)) return null;
		throw new Error(`Analytics Engine said ${res.status}: ${text.slice(0, 300)}`);
	}
	return JSON.parse(text).data;
}

console.log(`fill.wotda.app, the last ${days} days\n`);
for (const { title, sql } of REPORTS) {
	const rows = await query(sql);
	if (rows === null) {
		console.log("No visits recorded yet: the dataset appears with the first page view after deploying.");
		break;
	}
	console.log(title);
	if (rows.length) console.table(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "" ? "-" : v]))));
	else console.log("  none\n");
}
