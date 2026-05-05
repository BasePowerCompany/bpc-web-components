import path from "node:path";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), visualizer()],
	test: {
		environment: "jsdom",
		globals: true,
	},
	build: {
		// Build a single-file, browser-ready bundle
		lib: {
			entry: "src/entry.tsx", // or "src/entry-mount.tsx" for the mount variant
			name: "BPCWebComponents", // global name when loaded via <script>
			formats: ["iife"],
			fileName: () => "bpc-web-components.js",
		},
		target: "es2020",
		cssCodeSplit: false, // inline CSS into the JS file
		rollupOptions: {
			output: {
				inlineDynamicImports: true, // force single chunk
				manualChunks: undefined,
			},
		},
	},
	resolve: {
		// If you ever import "react" libs, alias them to compat
		alias: {
			react: "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
			"react-dom": "preact/compat",
			"react-dom/client": "preact/compat/client",
			"react-dom/test-utils": "preact/test-utils",
			"@": path.resolve(__dirname, "src"),
		},
	},
});
