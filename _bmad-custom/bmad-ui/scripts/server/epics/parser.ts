import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";

// TODO(11.1): Replace inline path resolution with imports from "../paths" once Story 11.1 is merged.
const __epicParserDirname =
	typeof __dirname !== "undefined"
		? __dirname
		: fileURLToPath(new URL(".", import.meta.url));

const projectRoot = path.resolve(__epicParserDirname, "..", "..", "..", "..", "..");
const artifactsRoot = path.join(projectRoot, "_bmad-output");

export type ParsedEpicMarkdownRow = {
	id: string;
	number: number;
	label: string;
	dependsOn: string[];
};

export const EPICS_MARKDOWN_ROW_REGEX =
	/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/;
export const EPICS_STORY_HEADING_REGEX = /^###\s+Story\s+(\d+)\.(\d+):\s*(.*)$/i;
export const EPICS_EPIC_HEADING_REGEX = /^##+\s+Epic\s+(\d+)\s*:/i;
export const EPICS_EPIC_HEADING_WITH_NAME_REGEX = /^##+\s+Epic\s+(\d+)\s*:\s*(.+)$/i;
export const EPICS_STORY_FALLBACK_LABEL = "story";
export const EPIC_DEPENDENCY_NUMBER_REGEX = /\d+/g;
export const STORY_ID_PREFIX_REGEX = /^(\d+)-(\d+)-/;

export const epicsFile = path.join(artifactsRoot, "planning-artifacts", "epics.md");

export function slugifyStoryLabel(value: string): string {
	const lowered = value.toLowerCase();
	const sanitized = lowered
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
	return sanitized || EPICS_STORY_FALLBACK_LABEL;
}

export function parseEpicMarkdownRows(epicsContent: string): ParsedEpicMarkdownRow[] {
	const rows: ParsedEpicMarkdownRow[] = [];
	const seen = new Set<string>();

	for (const line of epicsContent.split("\n")) {
		const trimmed = line.trim();

		// Try markdown table row first: | 1 | Name | ... | deps |
		const tableRow = trimmed.match(EPICS_MARKDOWN_ROW_REGEX);
		if (tableRow) {
			const epicNumber = Number(tableRow[1]);
			if (!Number.isFinite(epicNumber)) {
				continue;
			}
			const id = `epic-${epicNumber}`;
			if (seen.has(id)) {
				continue;
			}
			const label = tableRow[2].trim();
			const dependenciesCell = tableRow[4].trim();
			const dependencyNumbers =
				dependenciesCell.match(EPIC_DEPENDENCY_NUMBER_REGEX) || [];
			const dependsOn = dependencyNumbers.map(
				(value) => `epic-${Number(value)}`,
			);
			rows.push({ id, number: epicNumber, label, dependsOn });
			seen.add(id);
			continue;
		}

		// Fallback: heading format ## Epic N: Name
		const headingRow = trimmed.match(EPICS_EPIC_HEADING_WITH_NAME_REGEX);
		if (headingRow) {
			const epicNumber = Number(headingRow[1]);
			if (!Number.isFinite(epicNumber)) {
				continue;
			}
			const id = `epic-${epicNumber}`;
			if (seen.has(id)) {
				continue;
			}
			const label = headingRow[2].trim();
			rows.push({ id, number: epicNumber, label, dependsOn: [] });
			seen.add(id);
		}
	}

	return rows.sort((a, b) => a.number - b.number);
}

export function getEpicMetadataFromMarkdown(
	epicsContent: string,
	epicNumber: number,
): { name: string; description: string } {
	const lines = epicsContent.split("\n");
	let name = "";
	const descLines: string[] = [];
	let foundHeading = false;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();

		if (!foundHeading) {
			const headingMatch = trimmed.match(EPICS_EPIC_HEADING_WITH_NAME_REGEX);
			if (headingMatch && Number(headingMatch[1]) === epicNumber) {
				name = headingMatch[2].trim();
				foundHeading = true;
			}
			continue;
		}

		if (
			trimmed.startsWith("#") ||
			trimmed.startsWith("**Story to FR") ||
			trimmed.startsWith("**FRs covered")
		) {
			break;
		}

		if (trimmed.length > 0) {
			descLines.push(trimmed);
		}
	}

	return { name, description: descLines.join(" ") };
}

export function getStoryContentFromEpics(
	epicsContent: string,
	storyId: string,
): { title: string; content: string } | null {
	const idMatch = storyId.match(STORY_ID_PREFIX_REGEX);
	if (!idMatch) {
		return null;
	}

	const epicNum = idMatch[1];
	const storyNum = idMatch[2];
	const storyHeadingPrefix = `### Story ${epicNum}.${storyNum}:`;

	const lines = epicsContent.split("\n");
	let startIndex = -1;
	let endIndex = lines.length;
	let title = "";

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();

		if (startIndex === -1) {
			if (trimmed.startsWith(storyHeadingPrefix)) {
				startIndex = i;
				title = trimmed.replace(/^###\s*/, "");
			}
			continue;
		}

		if (
			trimmed.startsWith("### ") ||
			trimmed.startsWith("## ") ||
			trimmed === "---"
		) {
			endIndex = i;
			break;
		}
	}

	if (startIndex === -1) {
		return null;
	}

	const content = lines
		.slice(startIndex + 1, endIndex)
		.join("\n")
		.trim();
	return { title, content };
}

/**
 * Extract planned story IDs for a given epic from epics.md content.
 * Returns full story IDs for stories already tracked in sprintStories,
 * or the "N-M-" prefix for stories not yet tracked in sprint-status.
 */
export function getPlannedStoriesFromEpics(
	epicsContent: string,
	epicNumber: number,
	sprintStories: Array<{ id: string }>,
): string[] {
	const seen = new Set<string>();
	const results: string[] = [];
	for (const line of epicsContent.split("\n")) {
		const match = line.trim().match(EPICS_STORY_HEADING_REGEX);
		if (!match) continue;
		if (Number(match[1]) !== epicNumber) continue;
		const prefix = `${match[1]}-${match[2]}-`;
		if (seen.has(prefix)) continue;
		seen.add(prefix);
		const found = sprintStories.find((s) => s.id.startsWith(prefix));
		results.push(found ? found.id : prefix);
	}
	return results;
}

export function findStoryMarkdown(
	storyId: string,
): Promise<{ path: string; content: string } | null> {
	const root = path.join(artifactsRoot, "implementation-artifacts");

	async function walk(
		dirPath: string,
	): Promise<{ path: string; content: string } | null> {
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const absolutePath = path.join(dirPath, entry.name);

			if (entry.isDirectory()) {
				const nested = await walk(absolutePath);
				if (nested) {
					return nested;
				}
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			if (!entry.name.endsWith(".md")) {
				continue;
			}

			if (!entry.name.startsWith(storyId)) {
				continue;
			}

			const content = await readFile(absolutePath, "utf8");
			return {
				path: path.relative(projectRoot, absolutePath),
				content,
			};
		}

		return null;
	}

	if (!existsSync(root)) {
		return Promise.resolve(null);
	}

	return walk(root);
}
