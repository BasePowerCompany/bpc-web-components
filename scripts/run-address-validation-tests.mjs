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
const outfile = path.join(tempDir, "addressValidation.test.mjs");

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
		],
		outfile,
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node22",
		sourcemap: "inline",
		plugins: [aliasPlugin],
	});

	const result = spawnSync(process.execPath, ["--test", outfile], {
		stdio: "inherit",
	});

	process.exitCode = result.status ?? 1;
} finally {
	await rm(tempDir, { recursive: true, force: true });
}
