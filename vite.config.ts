import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * In the dev server the home pages aren't pre-rendered, so /vi/ is the same index.html as /: the
 * app picks the language from the address. (The build writes vi/index.html; scripts/prerender.mjs.)
 */
const devHomePages: Plugin = {
	name: "wdf-dev-home-pages",
	// Before the Cloudflare plugin, which answers every request itself.
	enforce: "pre",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use((req, _res, next) => {
			const match = req.url?.match(/^\/vi\/?(\?.*)?$/);
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
