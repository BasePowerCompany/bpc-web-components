import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const rootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const tempDir = await mkdtemp(path.join(tmpdir(), "bpc-address-tests-"));

// Stands in for the Vite env var under test. Tests assert request URLs against
// this literal, so keep it in step with energyDestination.test.ts.
const DASHBOARD_WEB_HOST = "https://dashboard.test";

const aliasPlugin = {
	name: "local-alias",
	setup(build) {
		build.onResolve({ filter: /^@\// }, (args) => {
			const target = path.join(rootDir, "src", args.path.slice(2));
			const resolved =
				["", ".ts", ".tsx", ".js"]
					.map((ext) => `${target}${ext}`)
					.find(existsSync) ?? target;
			return { path: resolved };
		});
	},
};

try {
	await esbuild.build({
		entryPoints: [
			path.join(rootDir, "src/address-search/addressValidation.test.ts"),
			path.join(rootDir, "src/address-search/energyDestination.test.ts"),
			path.join(rootDir, "src/address-search/energyFunnel.test.ts"),
			path.join(rootDir, "src/address-search/experiments.test.ts"),
			path.join(rootDir, "src/address-search/flagGate.test.ts"),
			path.join(rootDir, "src/address-search/focusTarget.test.ts"),
			path.join(rootDir, "src/address-search/preferredUtility.test.ts"),
		],
		outdir: tempDir,
		outExtension: { ".js": ".mjs" },
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node22",
		sourcemap: "inline",
		plugins: [aliasPlugin],
		// Vite substitutes these; esbuild leaves `import.meta.env` as-is and Node
		// has no such object, so anything importing fetch.ts throws without this.
		define: {
			"import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST":
				JSON.stringify(DASHBOARD_WEB_HOST),
		},
	});

	const result = spawnSync(
		process.execPath,
		[
			"--test",
			path.join(tempDir, "addressValidation.test.mjs"),
			path.join(tempDir, "energyDestination.test.mjs"),
			path.join(tempDir, "energyFunnel.test.mjs"),
			path.join(tempDir, "experiments.test.mjs"),
			path.join(tempDir, "flagGate.test.mjs"),
			path.join(tempDir, "focusTarget.test.mjs"),
			path.join(tempDir, "preferredUtility.test.mjs"),
		],
		{ stdio: "inherit" },
	);

	process.exitCode = result.status ?? 1;
} finally {
	await rm(tempDir, { recursive: true, force: true });
}
