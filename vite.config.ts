import path from "node:path";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

console.log(process.env.NODE_ENV);

export default defineConfig({
	plugins: [react(), visualizer()],
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
			"react-dom": "preact/compat",
			"@": path.resolve(__dirname, "src"),
		},
	},
});
