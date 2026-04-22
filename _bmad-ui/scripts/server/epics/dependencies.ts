import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { ParsedEpicMarkdownRow } from "./parser";
import { projectRoot, sprintStatusFile } from "../paths.js";
import type { EpicStatus, SprintOverview, StoryStatus } from "../sprint/index.js";

export const storyDependenciesFile = path.join(
	projectRoot,
	"_bmad-ui",
	"story-dependencies.yaml",
);

export type DependencyTreeNode = {
	id: string;
	label: string;
	status: EpicStatus;
	storyCount: number;
	dependsOn: string[];
};

export type EpicConsistency = {
	hasMismatch: boolean;
	epicsMarkdownCount: number;
	sprintStatusCount: number;
	warning: string | null;
};

export const YAML_COMMENT_REGEX = /#.*$/;
export const LAST_UPDATED_COMMENT_REGEX = /^#\s*last_updated:\s*.*$/m;
export const YAML_STORY_HEADER_REGEX = /^ {2}(\d+-\d+-[a-z0-9-]+):$/;
export const YAML_DEP_ITEM_REGEX = /^\s{4}- (\d+-\d+-[a-z0-9-]+)$/;

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deriveEpicStatusFromStories(
	currentStatus: EpicStatus,
	storyCount: number,
	byStoryStatus: Record<StoryStatus, number>,
): EpicStatus {
	if (storyCount === 0) {
		return currentStatus;
	}

	if (byStoryStatus.done === storyCount) {
		return "done";
	}

	const hasProgress =
		byStoryStatus["ready-for-dev"] > 0 ||
		byStoryStatus["in-progress"] > 0 ||
		byStoryStatus.review > 0 ||
		byStoryStatus.done > 0;

	return hasProgress ? "in-progress" : "backlog";
}

export function syncEpicStatusInSprintContent(
	content: string,
	epicNumber: number,
): string {
	const storyLinePattern = new RegExp(
		`^${epicNumber}-\\d+-[a-z0-9-]+:\\s*(backlog|ready-for-dev|in-progress|review|done)$`,
		"gm",
	);
	const byStoryStatus: Record<StoryStatus, number> = {
		backlog: 0,
		"ready-for-dev": 0,
		"in-progress": 0,
		review: 0,
		done: 0,
	};

	let storyCount = 0;
	for (const match of content.matchAll(storyLinePattern)) {
		const storyStatus = match[1] as StoryStatus;
		byStoryStatus[storyStatus] += 1;
		storyCount += 1;
	}

	if (storyCount === 0) {
		return content;
	}

	const epicLinePattern = new RegExp(
		`^(\\s*epic-${epicNumber}:\\s*)(backlog|in-progress|done)$`,
		"m",
	);
	const epicLineMatch = content.match(epicLinePattern);
	if (!epicLineMatch?.[2]) {
		return content;
	}

	const currentStatus = epicLineMatch[2] as EpicStatus;
	const derivedStatus = deriveEpicStatusFromStories(
		currentStatus,
		storyCount,
		byStoryStatus,
	);

	if (derivedStatus === currentStatus) {
		return content;
	}

	return content.replace(epicLinePattern, `$1${derivedStatus}`);
}

/**
 * Load story-level dependencies from the YAML file.
 * Returns Record<storyId, string[]> for all stories with explicit dependencies.
 */
export function loadStoryDependencies(): Record<string, string[]> {
	const deps: Record<string, string[]> = {};

	if (!existsSync(storyDependenciesFile)) {
		return deps;
	}

	let content: string;
	try {
		content = readFileSync(storyDependenciesFile, "utf8");
	} catch {
		return deps;
	}

	let currentStory: string | null = null;

	for (const rawLine of content.split("\n")) {
		const line = rawLine.replace(YAML_COMMENT_REGEX, "").trimEnd();
		if (line.trim().length === 0) {
			continue;
		}

		const storyMatch = line.match(YAML_STORY_HEADER_REGEX);
		if (storyMatch) {
			currentStory = storyMatch[1];
			if (!deps[currentStory]) {
				deps[currentStory] = [];
			}
			continue;
		}

		const depMatch = line.match(YAML_DEP_ITEM_REGEX);
		if (depMatch && currentStory) {
			deps[currentStory].push(depMatch[1]);
			continue;
		}

		// Epic header or anything else: reset current story
		if (!line.startsWith("  ")) {
			currentStory = null;
		}
	}

	return deps;
}

export function buildDependencyTree(
	parsedEpicRows: ParsedEpicMarkdownRow[],
	sprintOverview: SprintOverview,
): DependencyTreeNode[] {
	const sprintEpicMap = new Map(
		sprintOverview.epics.map((epic) => [
			epic.id,
			{ status: epic.status, storyCount: epic.storyCount },
		]),
	);

	const nodes: DependencyTreeNode[] = [];

	for (const row of parsedEpicRows) {
		const id = row.id;
		const sprintData = sprintEpicMap.get(id);

		nodes.push({
			id,
			label: row.label,
			status: sprintData?.status || "backlog",
			storyCount: sprintData?.storyCount || 0,
			dependsOn: row.dependsOn,
		});
	}

	if (nodes.length === 0) {
		return sprintOverview.epics.map((epic) => ({
			id: epic.id,
			label: epic.id,
			status: epic.status,
			storyCount: epic.storyCount,
			dependsOn: [],
		}));
	}

	return nodes.sort((a, b) => {
		const aNumber = Number(a.id.replace("epic-", ""));
		const bNumber = Number(b.id.replace("epic-", ""));
		return aNumber - bNumber;
	});
}

export function summarizeEpicConsistency(
	parsedEpicRows: ParsedEpicMarkdownRow[],
	sprintOverview: SprintOverview,
): EpicConsistency {
	const epicsMarkdownCount = parsedEpicRows.length;
	const sprintStatusCount = sprintOverview.epics.length;
	const hasMismatch = epicsMarkdownCount !== sprintStatusCount;

	if (!hasMismatch) {
		return {
			hasMismatch,
			epicsMarkdownCount,
			sprintStatusCount,
			warning: null,
		};
	}

	return {
		hasMismatch,
		epicsMarkdownCount,
		sprintStatusCount,
		warning: `Epic count mismatch: epics.md defines ${epicsMarkdownCount} epic${epicsMarkdownCount === 1 ? "" : "s"}, sprint-status.yaml tracks ${sprintStatusCount}. Re-run Sprint Planning to synchronize.`,
	};
}

export async function updateSprintStoryStatus(
	storyId: string,
	newStatus: string,
): Promise<void> {
	if (!existsSync(sprintStatusFile)) return;
	const content = await readFile(sprintStatusFile, "utf8");
	const linePattern = new RegExp(
		`^(${escapeRegExp(storyId)}:\\s*)(backlog|ready-for-dev|in-progress|review|done)$`,
		"m",
	);
	if (!linePattern.test(content)) return;
	let next = content.replace(linePattern, `$1${newStatus}`);
	const epicNumber = Number(storyId.split("-")[0]);
	if (Number.isFinite(epicNumber)) {
		next = syncEpicStatusInSprintContent(next, epicNumber);
	}
	next = next.replace(
		LAST_UPDATED_COMMENT_REGEX,
		`# last_updated: ${new Date().toISOString().slice(0, 10)}`,
	);
	const lastUpdatedFieldPattern = /^last_updated:\s*.*$/m;
	next = next.replace(
		lastUpdatedFieldPattern,
		`last_updated: ${new Date().toISOString()}`,
	);
	await writeFile(sprintStatusFile, next, "utf8");
}
