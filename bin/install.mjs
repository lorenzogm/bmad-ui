#!/usr/bin/env node
// bin/install.mjs
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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
const src = join(__pkgDir, "_bmad-ui");
const dest = join(process.cwd(), "_bmad-ui");

// Guard: source must exist in the published package
if (!existsSync(src)) {
	console.error(`Error: source not found in package: ${src}`);
	console.error(
		"The npm package may be missing _bmad-ui/. Please report this bug.",
	);
	process.exit(1);
}

const VERSION_FILE = ".bmad-method-ui-version";
const pkgVersion = JSON.parse(
	readFileSync(join(__pkgDir, "package.json"), "utf8"),
).version;

const EXCLUDED_SEGMENTS = new Set([
	"node_modules",
	"dist",
	"agents",
	"artifacts",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"test-results",
	".turbo",
]);

if (existsSync(dest)) {
	const versionFile = join(dest, VERSION_FILE);
	const installedVersion = existsSync(versionFile)
		? readFileSync(versionFile, "utf8").trim()
		: null;

	if (installedVersion === pkgVersion) {
		console.log(
			`\n✅  bmad-ui is already installed and up to date (v${pkgVersion}).\n`,
		);
		process.exit(0);
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const prompt = installedVersion
		? `_bmad-ui exists (v${installedVersion}). Upgrade to v${pkgVersion}? (y/N) `
		: `_bmad-ui exists (unknown version). Upgrade to v${pkgVersion}? (y/N) `;

	rl.question(prompt, (answer) => {
		rl.close();
		if (answer.toLowerCase() !== "y") {
			console.log("Aborted.");
			process.exit(0);
		}
		copyAndFinish(src, dest);
	});
} else {
	copyAndFinish(src, dest);
}

function copyAndFinish(src, dest) {
	try {
		cpSync(src, dest, {
			recursive: true,
			filter: (source) => !EXCLUDED_SEGMENTS.has(basename(source)),
		});
		writeFileSync(join(dest, VERSION_FILE), pkgVersion + "\n");

		// Bootstrap agents/ directory so the app works without agent-sessions.json
		const agentsDir = join(dest, "agents");
		if (!existsSync(agentsDir)) {
			mkdirSync(agentsDir, { recursive: true });
		}
		const sessionsFile = join(agentsDir, "agent-sessions.json");
		if (!existsSync(sessionsFile)) {
			writeFileSync(sessionsFile, '{"sessions":{}}\n');
		}
	} catch (err) {
		console.error(`\n❌  Install failed: ${err.message}`);
		console.error(
			"The destination may be partially copied. Remove it and try again.",
		);
		process.exit(1);
	}
	console.log(`\n✅  bmad-ui v${pkgVersion} installed at _bmad-ui\n`);
	console.log("Next steps:");
	console.log("  cd _bmad-ui");
	console.log("  pnpm install");
	console.log("  pnpm run dev\n");
}
