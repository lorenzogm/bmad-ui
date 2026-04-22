import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { RuntimeSession } from "../runtime/index.js";
import { buildMode, runningSessionProcesses } from "../runtime/index.js";
import type { StoryWorkflowStepSkill, WorkflowStepState } from "../sprint/index.js";
import type { SessionAnalyticsData } from "../analytics/index.js";
import { buildCleanLogContent, stripAnsi } from "./events.js";

const execFileAsync = promisify(execFile);

const PS_LINE_REGEX = /^(\d+)\s+([^\s]+)\s+(.+)$/;
const SUMMARY_LINE_REGEX = /(?:^|\n)(?:summary|resumen)\s*:\s*(.+)$/im;

export type ExternalProcess = {
	pid: number;
	elapsed: string;
	command: string;
};

export type SessionDetailResponse = {
	session: RuntimeSession;
	logContent: string | null;
	promptContent: string | null;
	summary: string | null;
	logExists: boolean;
	promptExists: boolean;
	isRunning: boolean;
	canSendInput: boolean;
};

type UpsertSessionFn = (update: {
	sessionId: string;
	status?: string;
	error?: string;
	endedAt?: string | null;
	exitCode?: number | null;
}) => Promise<void>;

type BuildSessionDetailDeps = {
	readAnalyticsStore: () => Promise<{ sessions: Record<string, SessionAnalyticsData> }>;
	markZombiesFailed: (entries: SessionAnalyticsData[], upsertFn: UpsertSessionFn) => Promise<boolean>;
	upsertSession: UpsertSessionFn;
	analyticsToRuntimeSession: (entry: SessionAnalyticsData) => RuntimeSession;
};

export async function readOptionalTextFile(
	filePath: string | null,
): Promise<string | null> {
	if (!filePath) {
		return null;
	}

	if (!existsSync(filePath)) {
		return null;
	}

	try {
		return await readFile(filePath, "utf8");
	} catch {
		return null;
	}
}

export function extractGeneratedSummary(logContent: string): string | null {
	const clean = stripAnsi(logContent).replace(/\r/g, "").trim();
	if (!clean) {
		return null;
	}

	const summaryMatch = clean.match(SUMMARY_LINE_REGEX);
	if (summaryMatch?.[1]) {
		return summaryMatch[1].trim();
	}

	const lines = clean
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index];
		if (line.length >= 40 && !line.startsWith("[") && !line.startsWith("{")) {
			return line;
		}
	}

	return null;
}

export function extractLastAssistantBlock(logContent: string): string | null {
	const clean = stripAnsi(logContent).replace(/\r/g, "").trim();
	if (!clean) {
		return null;
	}

	const lines = clean.split("\n");

	// Skip trailing non-text lines (orchestrator, tools, user)
	let end = lines.length - 1;
	while (end >= 0) {
		const line = lines[end];
		if (
			line.startsWith("[user] ") ||
			line.startsWith("[orchestrator]") ||
			line.startsWith("● ") ||
			line.startsWith("  │") ||
			line.startsWith("  └") ||
			line.trim().length === 0
		) {
			end -= 1;
		} else {
			break;
		}
	}

	if (end < 0) {
		return null;
	}

	// Collect text lines backwards until we hit a non-text line
	const textLines: string[] = [];
	for (let i = end; i >= 0; i -= 1) {
		const line = lines[i];
		if (
			line.startsWith("[user] ") ||
			line.startsWith("[orchestrator]") ||
			line.startsWith("● ") ||
			line.startsWith("  │") ||
			line.startsWith("  └")
		) {
			break;
		}
		textLines.unshift(line);
	}

	const text = textLines.join("\n").trim();
	return text.length > 0 ? text : null;
}

export async function getCompletedSessionSummary(
	sessions: SessionAnalyticsData[],
	storyId: string,
	skill: StoryWorkflowStepSkill,
): Promise<string | null> {
	const latest = sessions
		.filter((session) => session.storyId === storyId && session.skill === skill)
		.filter((session) => session.status === "completed")
		.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];

	const latestLogPath = latest?.logPath;
	if (!latestLogPath) {
		return null;
	}

	if (!existsSync(latestLogPath)) {
		return null;
	}

	try {
		const logContent = await readFile(latestLogPath, "utf8");
		return extractGeneratedSummary(logContent);
	} catch {
		return null;
	}
}

export function fallbackSummary(
	skill: StoryWorkflowStepSkill,
	state: WorkflowStepState,
	markdownPath: string | null,
): string {
	if (skill === "bmad-create-story" && state === "completed" && markdownPath) {
		return `Story artifact generated at ${markdownPath}.`;
	}

	if (state === "running") {
		return "Skill execution in progress.";
	}

	if (state === "not-started") {
		return "No generated summary yet.";
	}

	if (state === "failed") {
		return "Skill failed. Check session logs for details.";
	}

	return "Completed, but no generated summary was found.";
}

export async function getExternalCliProcesses(): Promise<ExternalProcess[]> {
	if (buildMode) {
		return [];
	}
	const { stdout } = await execFileAsync("ps", [
		"-ax",
		"-o",
		"pid=,etime=,command=",
	]);
	const keywords = [
		"copilot",
		"orchestrator.mjs",
		"bmad:orchestrate",
		"agent run",
	];

	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const match = line.match(PS_LINE_REGEX);
			if (!match) {
				return null;
			}
			const pid = Number(match[1]);
			const elapsed = match[2];
			const command = match[3];
			return { pid, elapsed, command };
		})
		.filter((item): item is ExternalProcess => item !== null)
		.filter((item) =>
			keywords.some((keyword) => item.command.toLowerCase().includes(keyword)),
		)
		.slice(0, 12);
}

export async function buildSessionDetailPayload(
	sessionId: string,
	deps: BuildSessionDetailDeps,
): Promise<SessionDetailResponse | null> {
	const store = await deps.readAnalyticsStore();
	await deps.markZombiesFailed(Object.values(store.sessions), deps.upsertSession);
	const analyticsEntry = store.sessions[sessionId] || null;
	if (!analyticsEntry) {
		return null;
	}
	const session = deps.analyticsToRuntimeSession(analyticsEntry);

	const rawLogContent = await readOptionalTextFile(session.logPath);
	const fallbackLog = rawLogContent
		? stripAnsi(rawLogContent).replace(/\r/g, "")
		: null;
	const logContent = await buildCleanLogContent(
		session.id,
		session.userMessages || [],
		fallbackLog,
	);
	const promptContent = await readOptionalTextFile(session.promptPath);

	return {
		session,
		logContent,
		promptContent,
		summary: logContent ? extractLastAssistantBlock(logContent) : null,
		logExists: Boolean(session.logPath && existsSync(session.logPath)),
		promptExists: Boolean(session.promptPath && existsSync(session.promptPath)),
		isRunning:
			session.status === "running" || runningSessionProcesses.has(session.id),
		canSendInput: runningSessionProcesses.has(session.id),
	};
}
