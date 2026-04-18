#!/usr/bin/env node
// bin/install.mjs
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [, , command] = process.argv;

if (command !== "install") {
	console.error("Usage: npx bmad-method-ui install");
	process.exit(1);
}

const __pkgDir = new URL("..", import.meta.url).pathname;
const dest = join(process.cwd(), "_bmad-custom", "bmad-ui");
const src = join(__pkgDir, "_bmad-custom", "bmad-ui");

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
	cpSync(src, dest, {
		recursive: true,
		filter: (source) => !source.includes("node_modules"),
	});
	console.log(`\n✅  bmad-ui installed at _bmad-custom/bmad-ui\n`);
	console.log("Next steps:");
	console.log("  cd _bmad-custom/bmad-ui");
	console.log("  npm install");
	console.log("  npm run dev\n");
}
