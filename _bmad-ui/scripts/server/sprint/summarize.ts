import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { artifactsRoot, sprintStatusFile } from "../paths.js";
import {
	EPICS_EPIC_HEADING_REGEX,
	EPICS_EPIC_HEADING_WITH_NAME_REGEX,
	EPICS_STORY_HEADING_REGEX,
	STORY_ID_PREFIX_REGEX,
	deriveEpicStatusFromStories,
	epicsFile,
	slugifyStoryLabel,
} from "../epics/index.js";

// TODO Story 11.5: replace with import from ../analytics
type SprintSessionRef = {
	storyId: string | null | undefined;
	skill: string;
	status: string;
	startedAt: string;
};

export type StoryStatus =
	| "backlog"
	| "ready-for-dev"
	| "in-progress"
	| "review"
	| "done";
export type EpicStatus = "backlog" | "in-progress" | "done";
export type WorkflowStepState = "not-started" | "running" | "completed" | "failed";
export type StoryWorkflowStepSkill =
	| "bmad-create-story"
	| "bmad-dev-story"
	| "bmad-code-review";

export type EpicWorkflowStepSkill =
	| "bmad-sprint-status"
	| "bmad-sprint-planning"
	| "bmad-retrospective";

export type EpicLifecycleSteps = Record<EpicWorkflowStepSkill, WorkflowStepState>;

export type SprintOverview = {
	totalStories: number;
	storiesByStatus: Record<string, number>;
	stories: Array<{
		id: string;
		status: StoryStatus;
		steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
	}>;
	epics: Array<{
		id: string;
		number: number;
		name: string;
		status: EpicStatus;
		storyCount: number;
		plannedStoryCount: number;
		storiesToCreate: number;
		byStoryStatus: Record<StoryStatus, number>;
		lifecycleSteps: EpicLifecycleSteps;
	}>;
};

export const STORY_WORKFLOW_STEPS: Array<{
	skill: StoryWorkflowStepSkill;
	label: string;
}> = [
	{ skill: "bmad-create-story", label: "Create Story" },
	{ skill: "bmad-dev-story", label: "Dev Story" },
	{ skill: "bmad-code-review", label: "Code Review" },
];

export const EPIC_WORKFLOW_STEPS: Array<{
	skill: EpicWorkflowStepSkill;
	label: string;
}> = [
	{ skill: "bmad-sprint-status", label: "Sprint Status" },
	{ skill: "bmad-sprint-planning", label: "Sprint Planning" },
	{ skill: "bmad-retrospective", label: "Retrospective" },
];

export const SPRINT_STORY_STATUS_REGEX =
	/^([0-9]+-[0-9]+-[a-z0-9-]+):\s*(backlog|ready-for-dev|in-progress|review|done)$/;
export const EPIC_STATUS_REGEX = /^epic-(\d+):\s*(backlog|in-progress|done)$/;
export const EPIC_PLANNING_REGEX = /^epic-(\d+)-planning:\s*([a-z-]+)$/;
export const EPIC_RETROSPECTIVE_REGEX = /^epic-(\d+)-retrospective:\s*([a-z-]+)$/;
export const STORY_MARKDOWN_STATUS_REGEX =
	/^Status:\s*(backlog|ready-for-dev|in-progress|review|done)\s*$/im;
export const STORY_STATUS_ORDER: Record<StoryStatus, number> = {
	backlog: 0,
	"ready-for-dev": 1,
	"in-progress": 2,
	review: 3,
	done: 4,
};

export function toStepState(sessionStatus: string): WorkflowStepState {
	if (sessionStatus === "running") {
		return "running";
	}
	if (sessionStatus === "completed") {
		return "completed";
	}
	if (sessionStatus === "failed" || sessionStatus === "cancelled") {
		return "failed";
	}
	return "not-started";
}

export function deriveStoryStepStateFromStatus(
	storyStatus: StoryStatus,
	step: StoryWorkflowStepSkill,
): WorkflowStepState {
	if (storyStatus === "done") {
		return "completed";
	}

	if (step === "bmad-create-story") {
		return storyStatus === "backlog" ? "not-started" : "completed";
	}

	if (step === "bmad-dev-story") {
		if (storyStatus === "backlog" || storyStatus === "ready-for-dev") {
			return "not-started";
		}
		return storyStatus === "in-progress" ? "running" : "completed";
	}

	if (storyStatus === "review") {
		return "running";
	}

	return "not-started";
}

export function summarizeSprintFromEpics(
	epicsContent: string,
	sessions: SprintSessionRef[],
): SprintOverview {
	const stories: Array<{
		id: string;
		status: StoryStatus;
		steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
	}> = [];

	const seenStoryIds = new Set<string>();
	const mentionedEpicNumbers = new Set<number>();
	const epicNames = new Map<number, string>();

	for (const line of epicsContent.split("\n")) {
		const raw = line.trim();
		const epicNameMatch = raw.match(EPICS_EPIC_HEADING_WITH_NAME_REGEX);
		if (epicNameMatch) {
			const epicNumber = Number(epicNameMatch[1]);
			if (Number.isFinite(epicNumber)) {
				mentionedEpicNumbers.add(epicNumber);
				epicNames.set(epicNumber, epicNameMatch[2].trim());
			}
		} else {
			const epicMatch = raw.match(EPICS_EPIC_HEADING_REGEX);
			if (epicMatch) {
				const epicNumber = Number(epicMatch[1]);
				if (Number.isFinite(epicNumber)) {
					mentionedEpicNumbers.add(epicNumber);
				}
			}
		}

		const match = raw.match(EPICS_STORY_HEADING_REGEX);
		if (!match) {
			continue;
		}

		const epicNumber = Number(match[1]);
		const storyNumber = Number(match[2]);
		const storySlug = slugifyStoryLabel(match[3]);

		if (!Number.isFinite(epicNumber) || !Number.isFinite(storyNumber)) {
			continue;
		}

		const id = `${epicNumber}-${storyNumber}-${storySlug}`;
		if (seenStoryIds.has(id)) {
			continue;
		}

		stories.push({
			id,
			status: "backlog",
			steps: {
				"bmad-create-story": "not-started",
				"bmad-dev-story": "not-started",
				"bmad-code-review": "not-started",
			},
		});
		seenStoryIds.add(id);
		mentionedEpicNumbers.add(epicNumber);
	}

	if (sessions.length > 0) {
		for (const story of stories) {
			for (const step of STORY_WORKFLOW_STEPS) {
				const history = sessions
					.filter(
						(session) =>
							session.storyId === story.id && session.skill === step.skill,
					)
					.filter((session) => session.status !== "planned")
					.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

				if (history[0]) {
					const sessionState = toStepState(history[0].status);
					if (sessionState === "completed") {
						story.steps[step.skill] = "completed";
					} else if (
						sessionState === "running" &&
						story.steps[step.skill] !== "completed"
					) {
						story.steps[step.skill] = sessionState;
					}
				}
			}

			// Implicit step inference: later steps imply earlier steps are completed
			if (
				story.steps["bmad-code-review"] === "completed" ||
				story.steps["bmad-code-review"] === "running"
			) {
				story.steps["bmad-dev-story"] = "completed";
			}
			if (
				story.steps["bmad-dev-story"] === "completed" ||
				story.steps["bmad-dev-story"] === "running"
			) {
				story.steps["bmad-create-story"] = "completed";
			}

			if (story.steps["bmad-code-review"] === "completed") {
				story.status = "done";
			} else if (story.steps["bmad-code-review"] === "running") {
				story.status = "review";
			} else if (story.steps["bmad-dev-story"] === "running") {
				story.status = "in-progress";
			} else if (story.steps["bmad-dev-story"] === "completed") {
				story.status = "review";
			} else if (story.steps["bmad-create-story"] === "completed") {
				story.status = "ready-for-dev";
			}
		}
	}

	const storiesByStatus: Record<string, number> = {
		backlog: 0,
		"ready-for-dev": 0,
		"in-progress": 0,
		review: 0,
		done: 0,
	};

	for (const story of stories) {
		storiesByStatus[story.status] += 1;
	}

	const epicMap = new Map<
		number,
		{
			id: string;
			number: number;
			name: string;
			status: EpicStatus;
			storyCount: number;
			plannedStoryCount: number;
			storiesToCreate: number;
			byStoryStatus: Record<StoryStatus, number>;
			lifecycleSteps: EpicLifecycleSteps;
		}
	>();

	for (const epicNumber of mentionedEpicNumbers) {
		if (!Number.isFinite(epicNumber)) {
			continue;
		}

		epicMap.set(epicNumber, {
			id: `epic-${epicNumber}`,
			number: epicNumber,
			name: epicNames.get(epicNumber) ?? `Epic ${epicNumber}`,
			status: "backlog",
			storyCount: 0,
			plannedStoryCount: 0,
			storiesToCreate: 0,
			byStoryStatus: {
				backlog: 0,
				"ready-for-dev": 0,
				"in-progress": 0,
				review: 0,
				done: 0,
			},
			lifecycleSteps: {
				"bmad-sprint-status": "not-started",
				"bmad-sprint-planning": "not-started",
				"bmad-retrospective": "not-started",
			},
		});
	}

	for (const story of stories) {
		const epicNumber = Number(story.id.split("-")[0]);
		if (!Number.isFinite(epicNumber)) {
			continue;
		}

		const epic = epicMap.get(epicNumber);
		if (!epic) {
			continue;
		}

		epic.storyCount += 1;
		epic.byStoryStatus[story.status] += 1;
	}

	for (const epic of epicMap.values()) {
		epic.status = deriveEpicStatusFromStories(
			epic.status,
			epic.storyCount,
			epic.byStoryStatus,
		);

		// In epics-only mode, all stories come from epics.md so plannedStoryCount == storyCount
		epic.plannedStoryCount = epic.storyCount;
		epic.storiesToCreate = stories
			.filter((s) => Number(s.id.split("-")[0]) === epic.number)
			.filter((s) => s.steps["bmad-create-story"] !== "completed").length;

		if (epic.status === "done") {
			epic.lifecycleSteps["bmad-sprint-status"] = "completed";
			epic.lifecycleSteps["bmad-sprint-planning"] = "completed";
			epic.lifecycleSteps["bmad-retrospective"] = "completed";
			continue;
		}

		if (epic.status === "in-progress") {
			epic.lifecycleSteps["bmad-sprint-status"] = "completed";
		}
	}

	const epics = Array.from(epicMap.values()).sort(
		(a, b) => a.number - b.number,
	);

	return {
		totalStories: stories.length,
		storiesByStatus,
		stories,
		epics,
	};
}

export async function loadSprintOverview(
	sessions: SprintSessionRef[],
): Promise<SprintOverview> {
	let epicNames = new Map<number, string>();
	let epicsContentForPlanning = "";
	if (existsSync(epicsFile)) {
		try {
			epicsContentForPlanning = await readFile(epicsFile, "utf8");
			for (const line of epicsContentForPlanning.split("\n")) {
				const m = line.trim().match(EPICS_EPIC_HEADING_WITH_NAME_REGEX);
				if (m) {
					const n = Number(m[1]);
					if (Number.isFinite(n)) {
						epicNames.set(n, m[2].trim());
					}
				}
			}
		} catch {
			epicNames = new Map();
			epicsContentForPlanning = "";
		}
	}

	let overview: SprintOverview;
	if (existsSync(sprintStatusFile)) {
		const sprintContent = await readFile(sprintStatusFile, "utf8");
		overview = summarizeSprint(sprintContent, sessions);

		// Compute plannedStoryCount and storiesToCreate from epics.md
		if (epicsContentForPlanning) {
			const plannedPerEpic = new Map<number, Set<number>>();
			for (const line of epicsContentForPlanning.split("\n")) {
				const match = line.trim().match(EPICS_STORY_HEADING_REGEX);
				if (!match) continue;
				const epicNum = Number(match[1]);
				const storyNum = Number(match[2]);
				if (!Number.isFinite(epicNum) || !Number.isFinite(storyNum)) continue;
				if (!plannedPerEpic.has(epicNum))
					plannedPerEpic.set(epicNum, new Set());
				plannedPerEpic.get(epicNum)?.add(storyNum);
			}
			for (const epic of overview.epics) {
				const plannedCount =
					plannedPerEpic.get(epic.number)?.size ?? epic.storyCount;
				epic.plannedStoryCount = plannedCount;
				const createdCount = overview.stories
					.filter((s) => Number(s.id.split("-")[0]) === epic.number)
					.filter((s) => s.steps["bmad-create-story"] === "completed").length;
				epic.storiesToCreate = Math.max(0, plannedCount - createdCount);
			}
		} else {
			for (const epic of overview.epics) {
				epic.plannedStoryCount = epic.storyCount;
				epic.storiesToCreate = overview.stories
					.filter((s) => Number(s.id.split("-")[0]) === epic.number)
					.filter((s) => s.steps["bmad-create-story"] !== "completed").length;
			}
		}
	} else {
		overview = summarizeSprintFromEpics(epicsContentForPlanning, sessions);
	}

	for (const epic of overview.epics) {
		const name = epicNames.get(epic.number);
		if (name) {
			epic.name = name;
		}
	}

	await applyStoryStatusOverridesFromMarkdown(overview);

	return overview;
}

export async function applyStoryStatusOverridesFromMarkdown(
	overview: SprintOverview,
): Promise<void> {
	const markdownStatuses = await loadStoryStatusesFromMarkdown();
	if (markdownStatuses.size === 0) {
		return;
	}

	let changed = false;
	for (const story of overview.stories) {
		const markdownStatus = markdownStatuses.get(story.id);
		if (!markdownStatus) {
			continue;
		}

		const markdownRank = STORY_STATUS_ORDER[markdownStatus];
		const currentRank = STORY_STATUS_ORDER[story.status];
		if (markdownRank <= currentRank) {
			continue;
		}

		story.status = markdownStatus;
		story.steps = {
			"bmad-create-story": deriveStoryStepStateFromStatus(
				markdownStatus,
				"bmad-create-story",
			),
			"bmad-dev-story": deriveStoryStepStateFromStatus(
				markdownStatus,
				"bmad-dev-story",
			),
			"bmad-code-review": deriveStoryStepStateFromStatus(
				markdownStatus,
				"bmad-code-review",
			),
		};
		changed = true;
	}

	if (!changed) {
		return;
	}

	recomputeSprintOverviewCounts(overview);
}

export async function loadStoryStatusesFromMarkdown(): Promise<
	Map<string, StoryStatus>
> {
	const implementationDir = path.join(
		artifactsRoot,
		"implementation-artifacts",
	);
	if (!existsSync(implementationDir)) {
		return new Map();
	}

	const statuses = new Map<string, StoryStatus>();

	async function walk(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}

			if (!entry.isFile() || !entry.name.endsWith(".md")) {
				continue;
			}

			const storyId = entry.name.replace(/\.md$/, "");
			const match = storyId.match(STORY_ID_PREFIX_REGEX);
			if (!match) {
				continue;
			}

			let content = "";
			try {
				content = await readFile(fullPath, "utf8");
			} catch {
				continue;
			}

			const statusMatch = content.match(STORY_MARKDOWN_STATUS_REGEX);
			if (!statusMatch) {
				continue;
			}

			statuses.set(storyId, statusMatch[1] as StoryStatus);
		}
	}

	await walk(implementationDir);
	return statuses;
}

export function recomputeSprintOverviewCounts(overview: SprintOverview): void {
	const nextStoriesByStatus: Record<string, number> = {
		backlog: 0,
		"ready-for-dev": 0,
		"in-progress": 0,
		review: 0,
		done: 0,
	};

	for (const story of overview.stories) {
		nextStoriesByStatus[story.status] += 1;
	}
	overview.storiesByStatus = nextStoriesByStatus;

	for (const epic of overview.epics) {
		epic.storyCount = 0;
		epic.byStoryStatus = {
			backlog: 0,
			"ready-for-dev": 0,
			"in-progress": 0,
			review: 0,
			done: 0,
		};
	}

	for (const story of overview.stories) {
		const epicNumber = Number(story.id.split("-")[0]);
		if (!Number.isFinite(epicNumber)) {
			continue;
		}
		const epic = overview.epics.find(
			(candidate) => candidate.number === epicNumber,
		);
		if (!epic) {
			continue;
		}
		epic.storyCount += 1;
		epic.byStoryStatus[story.status] += 1;
	}

	for (const epic of overview.epics) {
		epic.status = deriveEpicStatusFromStories(
			epic.status,
			epic.storyCount,
			epic.byStoryStatus,
		);
	}
}

export function summarizeSprint(
	content: string,
	sessions: SprintSessionRef[],
): SprintOverview {
	const lines = content.split("\n");
	const stories: Array<{
		id: string;
		status: StoryStatus;
		steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
	}> = [];
	const explicitEpicStatus = new Map<number, EpicStatus>();
	const epicOrder: number[] = [];
	const planningStatus = new Map<number, string>();
	const retrospectiveStatus = new Map<number, string>();

	for (const line of lines) {
		const raw = line.trim();
		if (!raw || raw.startsWith("#")) {
			continue;
		}

		const match = raw.match(SPRINT_STORY_STATUS_REGEX);
		if (!match) {
			const epicMatch = raw.match(EPIC_STATUS_REGEX);
			if (epicMatch) {
				const epicNumber = Number(epicMatch[1]);
				explicitEpicStatus.set(epicNumber, epicMatch[2] as EpicStatus);
				if (!epicOrder.includes(epicNumber)) {
					epicOrder.push(epicNumber);
				}
			}

			const planningMatch = raw.match(EPIC_PLANNING_REGEX);
			if (planningMatch) {
				planningStatus.set(Number(planningMatch[1]), planningMatch[2]);
			}

			const retrospectiveMatch = raw.match(EPIC_RETROSPECTIVE_REGEX);
			if (retrospectiveMatch) {
				retrospectiveStatus.set(
					Number(retrospectiveMatch[1]),
					retrospectiveMatch[2],
				);
			}
			continue;
		}

		const storyStatus = match[2] as StoryStatus;
		stories.push({
			id: match[1],
			status: storyStatus,
			steps: {
				"bmad-create-story": deriveStoryStepStateFromStatus(
					storyStatus,
					"bmad-create-story",
				),
				"bmad-dev-story": deriveStoryStepStateFromStatus(
					storyStatus,
					"bmad-dev-story",
				),
				"bmad-code-review": deriveStoryStepStateFromStatus(
					storyStatus,
					"bmad-code-review",
				),
			},
		});
	}

	const storiesByStatus: Record<string, number> = {
		backlog: 0,
		"ready-for-dev": 0,
		"in-progress": 0,
		review: 0,
		done: 0,
	};

	for (const story of stories) {
		storiesByStatus[story.status] += 1;
	}

	if (sessions.length > 0) {
		for (const story of stories) {
			for (const step of STORY_WORKFLOW_STEPS) {
				const history = sessions
					.filter(
						(session) =>
							session.storyId === story.id && session.skill === step.skill,
					)
					.filter((session) => session.status !== "planned")
					.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

				if (history[0]) {
					const sessionState = toStepState(history[0].status);
					// A completed session always upgrades the step to completed.
					// A running session overrides to show live status.
					// A failed/cancelled session does NOT downgrade — the YAML is the
					// source of truth for story progress; cancelled runs are just
					// interrupted sessions, not rollbacks of the story's state.
					if (sessionState === "completed") {
						story.steps[step.skill] = "completed";
					} else if (
						sessionState === "running" &&
						story.steps[step.skill] !== "completed"
					) {
						story.steps[step.skill] = sessionState;
					}
				}
			}

			// Implicit step inference: later steps imply earlier steps are completed
			if (
				story.steps["bmad-code-review"] === "completed" ||
				story.steps["bmad-code-review"] === "running"
			) {
				story.steps["bmad-dev-story"] = "completed";
			}
			if (
				story.steps["bmad-dev-story"] === "completed" ||
				story.steps["bmad-dev-story"] === "running"
			) {
				story.steps["bmad-create-story"] = "completed";
			}

			// Derive story status from steps — sessions are more up-to-date than YAML
			if (story.steps["bmad-code-review"] === "completed") {
				story.status = "done";
			} else if (story.steps["bmad-code-review"] === "running") {
				story.status = "review";
			} else if (story.steps["bmad-dev-story"] === "running") {
				story.status = "in-progress";
			} else if (story.steps["bmad-dev-story"] === "completed") {
				story.status = "review";
			} else if (story.steps["bmad-create-story"] === "completed") {
				story.status = "ready-for-dev";
			}
		}
	}

	const epicMap = new Map<
		number,
		{
			id: string;
			number: number;
			name: string;
			status: EpicStatus;
			storyCount: number;
			plannedStoryCount: number;
			storiesToCreate: number;
			byStoryStatus: Record<StoryStatus, number>;
			lifecycleSteps: EpicLifecycleSteps;
		}
	>();

	for (const story of stories) {
		const storyNumber = Number(story.id.split("-")[0]);
		if (!Number.isFinite(storyNumber)) {
			continue;
		}

		if (!epicMap.has(storyNumber)) {
			epicMap.set(storyNumber, {
				id: `epic-${storyNumber}`,
				number: storyNumber,
				name: `Epic ${storyNumber}`,
				status: explicitEpicStatus.get(storyNumber) || "backlog",
				storyCount: 0,
				plannedStoryCount: 0,
				storiesToCreate: 0,
				byStoryStatus: {
					backlog: 0,
					"ready-for-dev": 0,
					"in-progress": 0,
					review: 0,
					done: 0,
				},
				lifecycleSteps: {
					"bmad-sprint-status": "not-started",
					"bmad-sprint-planning": "not-started",
					"bmad-retrospective": "not-started",
				},
			});
		}

		const epic = epicMap.get(storyNumber);
		if (!epic) {
			continue;
		}

		epic.storyCount += 1;
		epic.byStoryStatus[story.status] += 1;
	}

	for (const [epicNumber, status] of explicitEpicStatus.entries()) {
		if (!epicMap.has(epicNumber)) {
			epicMap.set(epicNumber, {
				id: `epic-${epicNumber}`,
				number: epicNumber,
				name: `Epic ${epicNumber}`,
				status,
				storyCount: 0,
				plannedStoryCount: 0,
				storiesToCreate: 0,
				byStoryStatus: {
					backlog: 0,
					"ready-for-dev": 0,
					"in-progress": 0,
					review: 0,
					done: 0,
				},
				lifecycleSteps: {
					"bmad-sprint-status": "not-started",
					"bmad-sprint-planning": "not-started",
					"bmad-retrospective": "not-started",
				},
			});
		}
	}

	for (const epic of epicMap.values()) {
		epic.status = deriveEpicStatusFromStories(
			epic.status,
			epic.storyCount,
			epic.byStoryStatus,
		);

		if (epic.status === "backlog") {
			epic.lifecycleSteps["bmad-sprint-status"] = "not-started";
			epic.lifecycleSteps["bmad-sprint-planning"] = "not-started";
			epic.lifecycleSteps["bmad-retrospective"] = "not-started";
			continue;
		}

		epic.lifecycleSteps["bmad-sprint-status"] = "completed";
		epic.lifecycleSteps["bmad-sprint-planning"] =
			planningStatus.get(epic.number) === "done" || epic.status === "done"
				? "completed"
				: "not-started";
		epic.lifecycleSteps["bmad-retrospective"] =
			retrospectiveStatus.get(epic.number) === "done"
				? "completed"
				: "not-started";
	}

	const epics = Array.from(epicMap.values()).sort((a, b) => {
		const aIndex = epicOrder.indexOf(a.number);
		const bIndex = epicOrder.indexOf(b.number);

		if (aIndex !== -1 && bIndex !== -1) {
			return aIndex - bIndex;
		}
		if (aIndex !== -1) {
			return -1;
		}
		if (bIndex !== -1) {
			return 1;
		}
		return a.number - b.number;
	});

	return {
		totalStories: stories.length,
		storiesByStatus,
		stories,
		epics,
	};
}

export function summarizeEpicSteps(sessions: SprintSessionRef[]): Array<{
	skill: EpicWorkflowStepSkill;
	label: string;
	state: WorkflowStepState;
}> {
	return EPIC_WORKFLOW_STEPS.map((step) => {
		const latest = sessions
			.filter((session) => session.skill === step.skill)
			.filter((session) => session.status !== "planned")
			.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];

		return {
			skill: step.skill,
			label: step.label,
			state: latest ? toStepState(latest.status) : "not-started",
		};
	});
}
