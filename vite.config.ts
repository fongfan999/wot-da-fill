import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), cloudflare()],
	worker: {
		format: "es",
	},
	optimizeDeps: {
		// jSquash codecs locate their .wasm files via `new URL(..., import.meta.url)`;
		// pre-bundling would break those relative URLs in dev.
		exclude: ["@jsquash/jpeg", "@jsquash/oxipng", "@jsquash/webp"],
	},
});
