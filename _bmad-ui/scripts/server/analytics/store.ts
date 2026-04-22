import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentsDir, sprintStatusFile } from "../paths.js";
import { buildMode, runtimeLogsDir, runtimeStatePath, type RuntimeSession, type RuntimeState } from "../runtime/index.js";
import { SPRINT_STORY_STATUS_REGEX } from "../sprint/index.js";
import type { AgentSession, AnalyticsCostingData, SessionAnalyticsData } from "./costing.js";
import { parseTokenUsageFromLog, zeroUsage } from "./costing.js";

export const analyticsStorePath = path.join(agentsDir, "agent-sessions.json");
export const legacyAnalyticsStorePaths: string[] = [];
export const agentSessionsPath = analyticsStorePath;

export type AnalyticsStore = {
	sessions: Record<string, SessionAnalyticsData>;
	costing?: AnalyticsCostingData;
};

export function getEpicIdFromStoryId(storyId: string | null): string | null {
	if (!storyId) {
		return null;
	}
	if (storyId.startsWith("epic-")) {
		return storyId;
	}
	const epicNum = Number(storyId.split("-")[0]);
	if (Number.isFinite(epicNum) && epicNum > 0) {
		return `epic-${epicNum}`;
	}
	return null;
}

export function inferSkillFromLogFilename(filename: string): string {
	if (filename.includes("dev-story")) {
		return "bmad-dev-story";
	}
	if (filename.includes("code-review")) {
		return "bmad-code-review";
	}
	if (filename.includes("create-story")) {
		return "bmad-create-story";
	}
	if (filename.includes("sprint-status")) {
		return "bmad-sprint-status";
	}
	if (filename.includes("sprint-planning") || filename.includes("planning")) {
		return "bmad-sprint-planning";
	}
	if (filename.includes("retrospective")) {
		return "bmad-retrospective";
	}
	return filename;
}

export function inferStoryIdFromLogFilename(
	filename: string,
	sprintStoryIds: string[],
	analyticsOldStyleRegex: RegExp,
	analyticsEpicSessionRegex: RegExp,
): string | null {
	const epicMatch = filename.match(analyticsEpicSessionRegex);
	if (epicMatch) {
		return `epic-${epicMatch[1]}`;
	}

	const oldMatch = filename.match(analyticsOldStyleRegex);
	if (oldMatch) {
		const prefix = `${oldMatch[1]}-${oldMatch[2]}`;
		const full = sprintStoryIds.find((id) => id.startsWith(`${prefix}-`));
		return full || prefix;
	}

	return null;
}

export async function parseRuntimeStateRobust(): Promise<RuntimeState | null> {
	if (!existsSync(runtimeStatePath)) {
		return null;
	}

	try {
		const raw = await readFile(runtimeStatePath, "utf8");
		return JSON.parse(raw) as RuntimeState;
	} catch {
		// Handle concatenated/malformed JSON — take first complete object
		try {
			const raw = await readFile(runtimeStatePath, "utf8");
			let depth = 0;
			let inString = false;
			let inEscape = false;
			let end = -1;

			for (let i = 0; i < raw.length; i += 1) {
				const ch = raw[i];
				if (inEscape) {
					inEscape = false;
					continue;
				}
				if (ch === "\\") {
					inEscape = true;
					continue;
				}
				if (ch === '"') {
					inString = !inString;
					continue;
				}
				if (inString) {
					continue;
				}
				if (ch === "{") {
					depth += 1;
				} else if (ch === "}") {
					depth -= 1;
					if (depth === 0) {
						end = i;
						break;
					}
				}
			}

			if (end === -1) {
				return null;
			}

			return JSON.parse(raw.slice(0, end + 1)) as RuntimeState;
		} catch {
			return null;
		}
	}
}

export async function readAnalyticsStore(): Promise<AnalyticsStore> {
	const candidatePath =
		[analyticsStorePath, ...legacyAnalyticsStorePaths].find((p) =>
			existsSync(p),
		) || null;
	if (!candidatePath) {
		return { sessions: {} };
	}
	try {
		const raw = await readFile(candidatePath, "utf8");
		const parsed = JSON.parse(raw) as {
			sessions: Record<string, Record<string, unknown>>;
			costing?: AnalyticsCostingData;
		};
		const normalized: Record<string, SessionAnalyticsData> = {};
		for (const [key, entry] of Object.entries(parsed.sessions ?? {})) {
			// Already in SessionAnalyticsData format (workflow sessions)
			if ("sessionId" in entry && "usage" in entry) {
				normalized[key] = entry as unknown as SessionAnalyticsData;
				continue;
			}
			// AgentSession format (copilot-cli sessions) — normalize
			const agentEntry = entry as unknown as AgentSession;
			const sessionId =
				agentEntry.session_id ||
				(entry as Record<string, string>).sessionId ||
				key;
			normalized[sessionId] = {
				sessionId,
				storyId: null,
				epicId: null,
				skill: agentEntry.agent || "general",
				model: agentEntry.model || "unknown",
				status: agentEntry.status || "completed",
				startedAt: agentEntry.start_date || "",
				endedAt: agentEntry.end_date || null,
				usage: {
					requests: agentEntry.premium_requests || 0,
					tokensIn: agentEntry.tokens?.input || 0,
					tokensOut: agentEntry.tokens?.output || 0,
					tokensCached: 0,
					totalTokens: agentEntry.tokens?.total || 0,
				},
			};
		}
		return { sessions: normalized, costing: parsed.costing };
	} catch {
		return { sessions: {} };
	}
}

export async function persistAnalyticsStore(store: AnalyticsStore): Promise<void> {
	await mkdir(path.dirname(analyticsStorePath), { recursive: true });
	await writeFile(
		analyticsStorePath,
		`${JSON.stringify(store, null, 2)}\n`,
		"utf8",
	);
}

export async function upsertAnalyticsSession(
	update: Partial<SessionAnalyticsData> & { sessionId: string },
): Promise<void> {
	const store = await readAnalyticsStore();
	const existing = store.sessions[update.sessionId] ?? {
		sessionId: update.sessionId,
		storyId: null,
		epicId: null,
		skill: "unknown",
		model: "unknown",
		status: "planned",
		startedAt: new Date().toISOString(),
		endedAt: null,
		usage: zeroUsage(),
	};
	store.sessions[update.sessionId] = { ...existing, ...update };
	await persistAnalyticsStore(store);
}

export function analyticsToRuntimeSession(s: SessionAnalyticsData): RuntimeSession {
	return {
		id: s.sessionId,
		skill: s.skill,
		model: s.model,
		storyId: s.storyId,
		status: s.status,
		startedAt: s.startedAt,
		endedAt: s.endedAt ?? null,
		command: s.command ?? "",
		promptPath: s.promptPath ?? "",
		logPath: s.logPath ?? "",
		worktreePath: s.worktreePath ?? null,
		exitCode: s.exitCode ?? null,
		error: s.error ?? null,
		userMessages: s.userMessages ?? [],
	};
}

export function sessionToAnalyticsUpdate(
	session: RuntimeSession,
): Partial<SessionAnalyticsData> & { sessionId: string } {
	return {
		sessionId: session.id,
		skill: session.skill,
		model: session.model,
		storyId: session.storyId,
		epicId: getEpicIdFromStoryId(session.storyId),
		status: session.status,
		startedAt: session.startedAt,
		endedAt: session.endedAt,
		logPath: session.logPath,
		promptPath: session.promptPath,
		command: session.command,
		worktreePath: session.worktreePath,
		exitCode: session.exitCode,
		error: session.error,
		userMessages: session.userMessages,
	};
}

export async function persistSessionAnalytics(session: RuntimeSession): Promise<void> {
	const { logPath } = session;
	if (!logPath) {
		return;
	}
	if (!existsSync(logPath)) {
		return;
	}
	try {
		const logContent = await readFile(logPath, "utf8");
		const usage = parseTokenUsageFromLog(logContent);
		await upsertAnalyticsSession({
			...sessionToAnalyticsUpdate(session),
			usage,
		});
	} catch {
		// ignore — analytics persistence is best-effort
	}
}

export async function backfillAnalyticsStore(): Promise<void> {
	if (buildMode) {
		return;
	}
	const runtimeState = await parseRuntimeStateRobust();
	const allSessions = runtimeState?.sessions || [];
	const store = await readAnalyticsStore();
	let dirty = false;

	// Backfill sessions from runtime-state that have logs but no store entry
	for (const session of allSessions) {
		const existing = store.sessions[session.id];
		if (existing && existing.usage.requests > 0) {
			continue;
		}
		const { logPath } = session;
		if (!logPath) {
			continue;
		}
		if (!existsSync(logPath)) {
			continue;
		}
		try {
			const logContent = await readFile(logPath, "utf8");
			const usage = parseTokenUsageFromLog(logContent);
			const hasChanged =
				!existing ||
				existing.usage.requests !== usage.requests ||
				existing.usage.totalTokens !== usage.totalTokens ||
				existing.usage.tokensIn !== usage.tokensIn ||
				existing.usage.tokensOut !== usage.tokensOut ||
				existing.usage.tokensCached !== usage.tokensCached;
			if (!hasChanged) {
				continue;
			}
			store.sessions[session.id] = {
				sessionId: session.id,
				storyId: session.storyId,
				epicId: getEpicIdFromStoryId(session.storyId),
				skill: session.skill,
				model: session.model,
				status: session.status,
				startedAt: session.startedAt,
				endedAt: session.endedAt,
				usage,
				logPath: session.logPath,
				promptPath: session.promptPath,
				command: session.command,
				worktreePath: session.worktreePath,
				exitCode: session.exitCode,
				error: session.error,
				userMessages: session.userMessages,
			};
			dirty = true;
		} catch {
			// ignore
		}
	}

	// Backfill orphaned log files not in runtime-state or store
	let sprintStoryIds: string[] = [];
	try {
		const sprintContent = await readFile(sprintStatusFile, "utf8");
		sprintStoryIds = sprintContent
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.match(SPRINT_STORY_STATUS_REGEX))
			.map((line) => line.split(":")[0].trim());
	} catch {
		// ignore
	}

	let logDirFiles: string[] = [];
	try {
		logDirFiles = await readdir(runtimeLogsDir);
	} catch {
		// ignore
	}

	const knownLogPaths = new Set(
		allSessions.map((s) => s.logPath).filter(Boolean),
	);

	const ANALYTICS_OLD_STYLE_SESSION_REGEX = /^(\d+)-(\d+)-(.+)$/;
	const ANALYTICS_EPIC_SESSION_REGEX = /^epic-(\d+)-(.+)$/;

	for (const filename of logDirFiles) {
		if (!filename.endsWith(".log")) {
			continue;
		}
		const logPath = path.join(runtimeLogsDir, filename);
		const sessionId = filename.slice(0, filename.length - 4);
		const existing = store.sessions[sessionId];
		if (existing && existing.usage.requests > 0) {
			continue;
		}
		if (
			knownLogPaths.has(logPath) &&
			existing?.usage.requests &&
			existing.usage.requests > 0
		) {
			continue;
		}
		try {
			const logContent = await readFile(logPath, "utf8");
			const usage = parseTokenUsageFromLog(logContent);
			if (usage.requests === 0 && usage.totalTokens === 0) {
				continue;
			}
			const hasChanged =
				!existing ||
				existing.usage.requests !== usage.requests ||
				existing.usage.totalTokens !== usage.totalTokens ||
				existing.usage.tokensIn !== usage.tokensIn ||
				existing.usage.tokensOut !== usage.tokensOut ||
				existing.usage.tokensCached !== usage.tokensCached;
			if (!hasChanged) {
				continue;
			}
			const storyId = inferStoryIdFromLogFilename(
				sessionId,
				sprintStoryIds,
				ANALYTICS_OLD_STYLE_SESSION_REGEX,
				ANALYTICS_EPIC_SESSION_REGEX,
			);
			store.sessions[sessionId] = {
				sessionId,
				storyId,
				epicId: getEpicIdFromStoryId(storyId),
				skill: inferSkillFromLogFilename(sessionId),
				model: "unknown",
				status: "completed",
				startedAt: "",
				endedAt: null,
				usage,
			};
			dirty = true;
		} catch {
			// ignore
		}
	}

	if (dirty) {
		await persistAnalyticsStore(store);
	}
}
