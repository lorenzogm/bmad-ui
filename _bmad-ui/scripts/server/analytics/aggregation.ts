import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { AgentSession, SessionAnalyticsData, TokenUsageData } from "./costing.js";
import { addUsage, normalizeAnalyticsCosting, zeroUsage } from "./costing.js";
import {
	analyticsStorePath,
	backfillAnalyticsStore,
	legacyAnalyticsStorePaths,
	readAnalyticsStore,
} from "./store.js";
import { runningSessionProcesses } from "../runtime/index.js";

export const ANALYTICS_OLD_STYLE_SESSION_REGEX = /^(\d+)-(\d+)-(.+)$/;
export const ANALYTICS_EPIC_SESSION_REGEX = /^epic-(\d+)-(.+)$/;

/**
 * Maximum time difference (ms) between a workflow session and a CLI/VSCode
 * session to consider them duplicates of the same actual work.
 */
export const SESSION_DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * If a session claims "running" but its last activity was longer than this
 * ago and it has no live process, mark it as stale/completed.
 */
export const STALE_SESSION_THRESHOLD_MS = 35 * 60 * 1000;

export async function readAgentSessionsFile(): Promise<AgentSession[]> {
	const candidatePath =
		[analyticsStorePath, ...legacyAnalyticsStorePaths].find((p) =>
			existsSync(p),
		) || null;
	if (!candidatePath) {
		return [];
	}

	try {
		const parsed = JSON.parse(await readFile(candidatePath, "utf8")) as {
			sessions:
				| Record<string, unknown>[]
				| Record<string, Record<string, unknown>>;
		};
		const entries: Record<string, unknown>[] = Array.isArray(parsed.sessions)
			? parsed.sessions
			: parsed.sessions && typeof parsed.sessions === "object"
				? Object.values(parsed.sessions)
				: [];
		return entries.map((entry) => normalizeToAgentSession(entry));
	} catch {
		return [];
	}
}

export function normalizeToAgentSession(entry: Record<string, unknown>): AgentSession {
	// Already in AgentSession format (copilot-cli sessions with tokens field)
	if ("tokens" in entry && entry.tokens) {
		return entry as unknown as AgentSession;
	}
	// SessionAnalyticsData format (workflow sessions with usage field) — convert
	const usage = entry.usage as
		| {
				tokensIn?: number;
				tokensOut?: number;
				totalTokens?: number;
				requests?: number;
		  }
		| undefined;
	return {
		session_id:
			(entry.sessionId as string) || (entry.session_id as string) || undefined,
		storyId: (entry.storyId as string) || null,
		tool: "vscode",
		model: (entry.model as string) || "unknown",
		premium: true,
		premium_requests: usage?.requests || 0,
		premium_multiplier: 1,
		premium_cost_units: usage?.requests || 0,
		tokens: {
			input: usage?.tokensIn || 0,
			output: usage?.tokensOut || 0,
			total: usage?.totalTokens || 0,
		},
		agent: (entry.skill as string) || (entry.agent as string) || "general",
		turns: 0,
		status: (entry.status as "running" | "completed") || "completed",
		start_date:
			(entry.startedAt as string) || (entry.start_date as string) || "",
		end_date: (entry.endedAt as string) || (entry.end_date as string) || null,
	};
}

/**
 * Deduplicate sessions: when the agent-server launches a workflow session
 * (ID like `workflow-bmad-dev-story-<ts>`), the underlying Copilot CLI
 * process also creates a session under its own UUID. The sync-sessions
 * daemon picks up the UUID session separately, creating a duplicate.
 *
 * This function merges overlapping pairs: keeps the workflow entry (which
 * has story info & proper status) and enriches it with token data from
 * the UUID entry.
 */
export function deduplicateSessions(
	sessions: SessionAnalyticsData[],
): SessionAnalyticsData[] {
	const workflowSessions: SessionAnalyticsData[] = [];
	const uuidSessions: SessionAnalyticsData[] = [];

	for (const s of sessions) {
		if (s.sessionId.startsWith("workflow-")) {
			workflowSessions.push(s);
		} else {
			uuidSessions.push(s);
		}
	}

	// For each UUID session, check if it's a duplicate of a workflow session
	const mergedWorkflowIds = new Set<string>();
	const duplicateUuidIds = new Set<string>();

	for (const uuid of uuidSessions) {
		const uuidStart = new Date(uuid.startedAt).getTime();
		if (Number.isNaN(uuidStart)) continue;

		for (const wf of workflowSessions) {
			const wfStart = new Date(wf.startedAt).getTime();
			if (Number.isNaN(wfStart)) continue;

			const timeDiff = Math.abs(uuidStart - wfStart);
			const sameSkill =
				uuid.skill === wf.skill ||
				uuid.skill === "general" ||
				wf.skill === "general";

			if (timeDiff <= SESSION_DEDUP_WINDOW_MS && sameSkill) {
				// Merge: enrich workflow entry with UUID's token data if richer
				if (
					uuid.usage.totalTokens > wf.usage.totalTokens ||
					uuid.usage.requests > wf.usage.requests
				) {
					wf.usage = {
						...wf.usage,
						tokensIn: Math.max(wf.usage.tokensIn, uuid.usage.tokensIn),
						tokensOut: Math.max(wf.usage.tokensOut, uuid.usage.tokensOut),
						tokensCached: Math.max(
							wf.usage.tokensCached ?? 0,
							uuid.usage.tokensCached ?? 0,
						),
						totalTokens: Math.max(wf.usage.totalTokens, uuid.usage.totalTokens),
						requests: Math.max(wf.usage.requests, uuid.usage.requests),
					};
				}
				// Workflow session is authoritative for status, story, dates
				mergedWorkflowIds.add(wf.sessionId);
				duplicateUuidIds.add(uuid.sessionId);
				break;
			}
		}
	}

	// Return workflow sessions + non-duplicate UUID sessions
	return [
		...workflowSessions,
		...uuidSessions.filter((s) => !duplicateUuidIds.has(s.sessionId)),
	];
}

/**
 * Validate "running" status: cross-check against actual runtime state.
 * Sessions that claim "running" but have no live process and started
 * long ago are marked "completed".
 */
export function validateRunningStatus(
	sessions: SessionAnalyticsData[],
): SessionAnalyticsData[] {
	const activeProcessIds = new Set(runningSessionProcesses.keys());

	const now = Date.now();

	return sessions.map((s) => {
		if (s.status !== "running") return s;

		// If it's tracked as a live process, it's genuinely running
		if (activeProcessIds.has(s.sessionId)) {
			return s;
		}

		// Check if the session is stale (started long ago with no live process)
		const startMs = new Date(s.startedAt).getTime();
		if (!Number.isNaN(startMs) && now - startMs > STALE_SESSION_THRESHOLD_MS) {
			return {
				...s,
				status: "completed",
				endedAt: s.endedAt || s.startedAt,
			};
		}

		return s;
	});
}

const DELIVERED_OUTCOMES = ["pushed", "committed", "delivered"] as const;

type QualityMetricsAccumulator = {
	sessions: number;
	delivered: number;
	oneShot: number;
	corrected: number;
	aborted: number;
	durationSum: number;
	durationCount: number;
	agentTurnsSum: number;
	agentTurnsCount: number;
	humanTurnsSum: number;
	humanTurnsCount: number;
};

type QualityMetricsOut = {
	sessions: number;
	delivered: number;
	oneShot: number;
	corrected: number;
	aborted: number;
	avgDurationMin: number;
	avgAgentTurns: number;
	avgHumanTurns: number;
};

type QualityBySkillModelOut = QualityMetricsOut & { oneShotRate: number };

function zeroQualityAccumulator(): QualityMetricsAccumulator {
	return {
		sessions: 0,
		delivered: 0,
		oneShot: 0,
		corrected: 0,
		aborted: 0,
		durationSum: 0,
		durationCount: 0,
		agentTurnsSum: 0,
		agentTurnsCount: 0,
		humanTurnsSum: 0,
		humanTurnsCount: 0,
	};
}

function finalizeMetrics(acc: QualityMetricsAccumulator): QualityMetricsOut {
	return {
		sessions: acc.sessions,
		delivered: acc.delivered,
		oneShot: acc.oneShot,
		corrected: acc.corrected,
		aborted: acc.aborted,
		avgDurationMin: acc.durationCount > 0 ? acc.durationSum / acc.durationCount : 0,
		avgAgentTurns: acc.agentTurnsCount > 0 ? acc.agentTurnsSum / acc.agentTurnsCount : 0,
		avgHumanTurns: acc.humanTurnsCount > 0 ? acc.humanTurnsSum / acc.humanTurnsCount : 0,
	};
}

function finalizeSkillModel(acc: QualityMetricsAccumulator): QualityBySkillModelOut {
	const base = finalizeMetrics(acc);
	return { ...base, oneShotRate: base.sessions > 0 ? base.oneShot / base.sessions : 0 };
}

function accumulateSession(
	acc: QualityMetricsAccumulator,
	session: SessionAnalyticsData,
): void {
	acc.sessions++;

	const outcome = session.outcome ?? null;
	const isDelivered =
		outcome !== null && (DELIVERED_OUTCOMES as readonly string[]).includes(outcome);
	const isAbortedOutcome = outcome === "aborted";

	if (isDelivered) {
		acc.delivered++;
		if (session.human_turns === 1 && session.aborted !== true) {
			acc.oneShot++;
		} else if (typeof session.human_turns === "number" && session.human_turns > 1) {
			acc.corrected++;
		}
	}
	if (isAbortedOutcome) {
		acc.aborted++;
	}

	if (typeof session.duration_minutes === "number" && session.duration_minutes >= 0) {
		acc.durationSum += session.duration_minutes;
		acc.durationCount++;
	}
	if (typeof session.agent_turns === "number" && session.agent_turns >= 0) {
		acc.agentTurnsSum += session.agent_turns;
		acc.agentTurnsCount++;
	}
	if (typeof session.human_turns === "number" && session.human_turns >= 0) {
		acc.humanTurnsSum += session.human_turns;
		acc.humanTurnsCount++;
	}
}

export function buildQualityAggregation(sessions: SessionAnalyticsData[]): {
	bySkill: Record<string, QualityMetricsOut>;
	byModel: Record<string, QualityMetricsOut>;
	bySkillModel: Record<string, QualityBySkillModelOut>;
	overall: QualityMetricsOut;
} {
	const bySkill: Record<string, QualityMetricsAccumulator> = {};
	const byModel: Record<string, QualityMetricsAccumulator> = {};
	const bySkillModel: Record<string, QualityMetricsAccumulator> = {};
	const overall = zeroQualityAccumulator();

	for (const session of sessions) {
		const skill = session.skill || "unknown";
		const model = session.model || "unknown";
		const comboKey = `${skill}::${model}`;

		if (!bySkill[skill]) bySkill[skill] = zeroQualityAccumulator();
		if (!byModel[model]) byModel[model] = zeroQualityAccumulator();
		if (!bySkillModel[comboKey]) bySkillModel[comboKey] = zeroQualityAccumulator();

		accumulateSession(bySkill[skill], session);
		accumulateSession(byModel[model], session);
		accumulateSession(bySkillModel[comboKey], session);
		accumulateSession(overall, session);
	}

	return {
		bySkill: Object.fromEntries(
			Object.entries(bySkill).map(([k, v]) => [k, finalizeMetrics(v)]),
		),
		byModel: Object.fromEntries(
			Object.entries(byModel).map(([k, v]) => [k, finalizeMetrics(v)]),
		),
		bySkillModel: Object.fromEntries(
			Object.entries(bySkillModel).map(([k, v]) => [k, finalizeSkillModel(v)]),
		),
		overall: finalizeMetrics(overall),
	};
}

export async function buildAnalyticsPayload() {
	// Backfill any sessions/logs not yet in the store (idempotent)
	await backfillAnalyticsStore();

	const store = await readAnalyticsStore();

	// 1. Deduplicate workflow + UUID pairs
	const deduplicated = deduplicateSessions(Object.values(store.sessions));

	// 2. Validate "running" status against actual process state
	const validated = validateRunningStatus(deduplicated);

	const sessionAnalytics = validated.sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	// Aggregate by story
	const storyMap = new Map<
		string,
		{ usage: TokenUsageData; sessionCount: number; epicId: string | null }
	>();
	for (const session of sessionAnalytics) {
		if (!session.storyId) {
			continue;
		}
		const existing = storyMap.get(session.storyId);
		if (existing) {
			storyMap.set(session.storyId, {
				usage: addUsage(existing.usage, session.usage),
				sessionCount: existing.sessionCount + 1,
				epicId: session.epicId,
			});
		} else {
			storyMap.set(session.storyId, {
				usage: session.usage,
				sessionCount: 1,
				epicId: session.epicId,
			});
		}
	}

	const storyAnalytics = Array.from(storyMap.entries())
		.map(([storyId, data]) => ({
			storyId,
			epicId: data.epicId,
			sessionCount: data.sessionCount,
			usage: data.usage,
		}))
		.sort((a, b) => a.storyId.localeCompare(b.storyId));

	// Aggregate by epic
	const epicMap = new Map<
		string,
		{
			usage: TokenUsageData;
			sessionCount: number;
			storyIds: Set<string>;
		}
	>();
	for (const session of sessionAnalytics) {
		if (!session.epicId) {
			continue;
		}
		const existing = epicMap.get(session.epicId);
		if (existing) {
			if (session.storyId) {
				existing.storyIds.add(session.storyId);
			}
			epicMap.set(session.epicId, {
				usage: addUsage(existing.usage, session.usage),
				sessionCount: existing.sessionCount + 1,
				storyIds: existing.storyIds,
			});
		} else {
			const storyIds = new Set<string>();
			if (session.storyId) {
				storyIds.add(session.storyId);
			}
			epicMap.set(session.epicId, {
				usage: session.usage,
				sessionCount: 1,
				storyIds,
			});
		}
	}

	const epicAnalytics = Array.from(epicMap.entries())
		.map(([epicId, data]) => ({
			epicId,
			storyCount: data.storyIds.size,
			sessionCount: data.sessionCount,
			usage: data.usage,
		}))
		.sort((a, b) => {
			const aNum = Number(a.epicId.replace("epic-", ""));
			const bNum = Number(b.epicId.replace("epic-", ""));
			return aNum - bNum;
		});

	// Project total
	const projectUsage = sessionAnalytics.reduce(
		(acc, session) => addUsage(acc, session.usage),
		zeroUsage(),
	);

	const costing = normalizeAnalyticsCosting(store.costing, projectUsage);

	return {
		sessions: sessionAnalytics,
		stories: storyAnalytics,
		epics: epicAnalytics,
		project: projectUsage,
		costing,
		quality: buildQualityAggregation(sessionAnalytics),
	};
}
