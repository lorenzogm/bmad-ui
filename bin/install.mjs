#!/usr/bin/env node
// bin/install.mjs
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const [, , command] = process.argv;

if (command !== "install") {
	console.error("Usage: npx bmad-method-ui install");
	process.exit(1);
}

// fileURLToPath correctly handles Windows drive letters and URL-encoded paths
const __pkgDir = fileURLToPath(new URL("..", import.meta.url));
const dest = join(process.cwd(), "_bmad-custom", "bmad-ui");
const src = join(__pkgDir, "_bmad-custom", "bmad-ui");

// Guard: source must exist in the published package
if (!existsSync(src)) {
	console.error(`Error: source not found in package: ${src}`);
	console.error(
		"The npm package may be missing _bmad-custom/bmad-ui/. Please report this bug.",
	);
	process.exit(1);
}

const EXCLUDED_SEGMENTS = new Set([
	"node_modules",
	"dist",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
]);

if (existsSync(dest)) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	rl.question(
		"_bmad-custom/bmad-ui already exists. Overwrite? (y/N) ",
		(answer) => {
			rl.close();
			if (answer.toLowerCase() !== "y") {
				console.log("Aborted.");
				process.exit(0);
			}
			copyAndFinish(src, dest);
		},
	);
} else {
	copyAndFinish(src, dest);
}

function copyAndFinish(src, dest) {
	// Ensure _bmad-custom/ parent exists before copying
	mkdirSync(join(process.cwd(), "_bmad-custom"), { recursive: true });
	try {
		cpSync(src, dest, {
			recursive: true,
			filter: (source) => !EXCLUDED_SEGMENTS.has(basename(source)),
		});
	} catch (err) {
		console.error(`\n❌  Install failed: ${err.message}`);
		console.error(
			"The destination may be partially copied. Remove it and try again.",
		);
		process.exit(1);
	}
	console.log(`\n✅  bmad-ui installed at _bmad-custom/bmad-ui\n`);
	console.log("Next steps:");
	console.log("  cd _bmad-custom/bmad-ui");
	console.log("  pnpm install");
	console.log("  pnpm run dev\n");
}
