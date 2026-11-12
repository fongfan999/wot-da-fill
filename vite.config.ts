import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * In the dev server the pages aren't pre-rendered, so every page's address (/vi/,
 * /invitation-names, /vi/dien-ten-thiep-moi: lib/pages.ts) gets the same index.html as /, and the
 * app picks the page and language from the address. The build writes a file for each.
 */
const devHomePages: Plugin = {
	name: "wdf-dev-home-pages",
	// Before the Cloudflare plugin, which answers every request itself.
	enforce: "pre",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use((req, _res, next) => {
			// One or two lowercase words, like /vi/ or /vi/the-ten-tu-excel; never files, /t/ or /api/.
			const match = req.url?.match(/^\/(?:vi\/?)?(?:[a-z0-9]+-[a-z0-9-]+)?\/?(\?.*)?$/);
			// The Cloudflare plugin reads originalUrl, so both change.
			if (match) req.url = req.originalUrl = "/" + (match[1] ?? "");
			next();
		});
	},
};

export default defineConfig({
	plugins: [devHomePages, react(), cloudflare()],
	worker: {
		format: "es",
	},
	optimizeDeps: {
		// jSquash codecs locate their .wasm files via `new URL(..., import.meta.url)`;
		// pre-bundling would break those relative URLs in dev.
		exclude: ["@jsquash/jpeg", "@jsquash/oxipng", "@jsquash/webp"],
	},
});
