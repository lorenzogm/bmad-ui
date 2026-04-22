#!/usr/bin/env node
/**
 * sync-sessions.mjs
 *
 * Background daemon that scans Copilot CLI and VS Code Copilot debug logs
 * for sessions tied to this project and upserts them into agent-sessions.json.
 *
 * Sources:
 *   - Copilot CLI  → ~/.copilot/session-state/<sid>/events.jsonl
 *   - VS Code Chat → ~/Library/Application Support/Code - Insiders/User/workspaceStorage/<hash>/GitHub.copilot-chat/debug-logs/<sid>/main.jsonl
 *
 * Usage:
 *   node scripts/sync-sessions.mjs           # watch mode (every 5 s)
 *   node scripts/sync-sessions.mjs --once    # one-shot backfill and exit
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Paths ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, "..", "..");
const SESSIONS_FILE = join(
	PROJECT_ROOT,
	"_bmad-ui",
	"agents",
	"agent-sessions.json",
);
const CLI_BASE = join(homedir(), ".copilot", "session-state");
const VS_CODE_WS_BASE = join(
	homedir(),
	"Library",
	"Application Support",
	"Code - Insiders",
	"User",
	"workspaceStorage",
);

// ─── Constants ────────────────────────────────────────────────────────────────

const INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes → session is completed
const POLL_INTERVAL_MS = 5_000;
const PROJECT_PATH_FRAGMENT = "/lorenzogm/bmad-ui";

/** Cost multiplier per model family (matches custom instructions). */
const PREMIUM_MULTIPLIERS = new Map([
	["claude-haiku", 0.25],
	["claude-sonnet", 1],
	["claude-opus", 3],
	["gpt-4.1", 1],
	["gpt-5-mini", 0.5],
	["gpt-5.4-mini", 0.5],
	["gpt-5", 2],
]);

const SKILLS_CONFIG_PATH = join(
	__dirname,
	"..",
	"..",
	"_bmad-ui",
	"agents",
	"skills-config.json",
);

/** Default set of skills that never produce git commits by design. */
const DEFAULT_NON_COMMITTING_SKILLS = [
	"bmad-code-review",
	"bmad-sprint-planning",
	"bmad-sprint-status",
	"bmad-retrospective",
	"bmad-validate-prd",
	"bmad-review-adversarial-general",
	"bmad-review-edge-case-hunter",
	"bmad-check-implementation-readiness",
	"bmad-checkpoint-preview",
];

/**
 * Skills that never produce git commits by design — their output IS the
 * review / plan / analysis itself.  These get outcome "delivered" when
 * the session completes normally, instead of requiring a git commit/push.
 *
 * Loaded from skills-config.json; falls back to hardcoded defaults if
 * file is missing or malformed.
 */
function loadNonCommittingSkills() {
	try {
		if (existsSync(SKILLS_CONFIG_PATH)) {
			const cfg = JSON.parse(readFileSync(SKILLS_CONFIG_PATH, "utf8"));
			if (
				cfg &&
				Array.isArray(cfg.nonCommittingSkills) &&
				cfg.nonCommittingSkills.length > 0
			) {
				return new Set(cfg.nonCommittingSkills);
			}
		}
	} catch {
		// fall through to default
	}
	return new Set(DEFAULT_NON_COMMITTING_SKILLS);
}

const NON_COMMITTING_SKILLS = loadNonCommittingSkills();

/** Minimum characters of real human content after stripping auto-injected XML. */
const MIN_HUMAN_CONTENT_LEN = 10;

/** Regex to strip auto-injected XML wrappers from user messages. */
const AUTO_INJECTED_XML_RE =
	/<(?:skill-context|reminder|context|current_datetime|invoked_skills|userRequest|system_notification|summary|available_skills|plan_mode)[^>]*>[\s\S]*?<\/(?:skill-context|reminder|context|current_datetime|invoked_skills|userRequest|system_notification|summary|available_skills|plan_mode)>/g;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPremiumMultiplier(model) {
	if (!model) return 1;
	for (const [prefix, mult] of PREMIUM_MULTIPLIERS) {
		if (model.startsWith(prefix)) return mult;
	}
	return 1;
}

function readExistingSessions() {
	if (!existsSync(SESSIONS_FILE)) return {};
	try {
		const parsed = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
		return parsed.sessions ?? {};
	} catch {
		return {};
	}
}

function writeSessions(sessions) {
	writeFileSync(
		SESSIONS_FILE,
		JSON.stringify({ sessions }, null, 2) + "\n",
		"utf8",
	);
}

function parseIsoTimestamp(value) {
	if (!value || typeof value !== "string") return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function normalizeMergedSession(session) {
	const next = { ...session };
	const startTs = next.start_date ?? next.startedAt ?? null;
	const endTs = next.end_date ?? next.endedAt ?? null;
	const parsedStart = parseIsoTimestamp(startTs);
	const parsedEnd = parseIsoTimestamp(endTs);

	// Guard against impossible timelines introduced by mixed source updates.
	if (parsedStart !== null && parsedEnd !== null && parsedEnd < parsedStart) {
		next.end_date = null;
		next.endedAt = null;
		if (next.status === "completed") {
			next.status = "running";
		}
	}

	const hasFailureSignal =
		(typeof next.exitCode === "number" && next.exitCode !== 0) ||
		Boolean(next.error);
	if (hasFailureSignal) {
		next.status = "failed";
		if (!next.end_date && !next.endedAt) {
			const fallbackEnd = next.start_date ?? next.startedAt ?? null;
			next.end_date = fallbackEnd;
			next.endedAt = fallbackEnd;
		}
	}

	return next;
}

/** Determine if a timestamp (ISO string) means the session is still running. */
function isActive(isoTs) {
	if (!isoTs) return false;
	const ms = Date.parse(isoTs);
	return !Number.isNaN(ms) && Date.now() - ms < INACTIVE_TIMEOUT_MS;
}

// ─── VS Code workspace hash discovery ────────────────────────────────────────

let _cachedWsHash = null;

function findBmadWorkspaceHash() {
	if (_cachedWsHash) return _cachedWsHash;
	if (!existsSync(VS_CODE_WS_BASE)) return null;
	try {
		for (const hash of readdirSync(VS_CODE_WS_BASE)) {
			const wsJson = join(VS_CODE_WS_BASE, hash, "workspace.json");
			if (!existsSync(wsJson)) continue;
			try {
				const { folder } = JSON.parse(readFileSync(wsJson, "utf8"));
				if (
					typeof folder === "string" &&
					folder.includes(PROJECT_PATH_FRAGMENT)
				) {
					_cachedWsHash = hash;
					return hash;
				}
			} catch {
				// ignore malformed workspace.json
			}
		}
	} catch {
		// ignore readdir errors
	}
	return null;
}

// ─── Copilot CLI parser ───────────────────────────────────────────────────────

/**
 * Pure parser: takes the raw events.jsonl content as a string.
 * Returns an AgentSession-format object or null if not a bmad-ui session.
 * Exported for unit testing.
 */
export function parseCLISessionContent(sessionId, content, nonCommittingSkills) {
	const skillSet = nonCommittingSkills ?? NON_COMMITTING_SKILLS;

	let model = "unknown";
	let startDate = null;
	let lastTs = null;
	let skill = "general";
	let turns = 0;
	let cwd = null;

	// Rich outcome & complexity counters
	let humanTurns = 0;
	let agentTurns = 0;
	let gitCommits = 0;
	let gitPushes = 0;
	let aborted = false;
	let contextCompactions = 0;
	let subagentCount = 0;
	let subagentTokens = 0;
	let errorCount = 0;

	// agent_active_minutes: sum of per-turn time (user.message → assistant.turn_end)
	let agentActiveMs = 0;
	let pendingUserMessageTs = null;

	for (const raw of content.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		let obj;
		try {
			obj = JSON.parse(line);
		} catch {
			continue;
		}

		const ts = obj.timestamp ?? obj.data?.startTime ?? null;
		if (ts) {
			if (!lastTs || ts > lastTs) lastTs = ts;
		}

		switch (obj.type) {
			case "session.start":
				model = obj.data?.selectedModel ?? model;
				startDate = obj.data?.startTime ?? startDate;
				cwd = obj.data?.context?.cwd ?? cwd;
				break;
			case "session.model_change":
				model = obj.data?.model ?? model;
				break;
			case "user.message": {
				turns++;
				const msgContent = obj.data?.content ?? "";
				const stripped = msgContent
					.replace(AUTO_INJECTED_XML_RE, "")
					.trim();
				if (stripped.length > MIN_HUMAN_CONTENT_LEN) {
					humanTurns++;
				}
				// Record timestamp for agent_active_minutes tracking
				if (ts) pendingUserMessageTs = Date.parse(ts);
				break;
			}
			case "assistant.turn_end": {
				agentTurns++;
				// Accumulate active turn time
				if (pendingUserMessageTs !== null && ts) {
					const turnEndMs = Date.parse(ts);
					if (!Number.isNaN(turnEndMs) && turnEndMs > pendingUserMessageTs) {
						agentActiveMs += turnEndMs - pendingUserMessageTs;
					}
					pendingUserMessageTs = null;
				}
				break;
			}
			case "skill.invoked":
				if (obj.data?.name) skill = obj.data.name;
				break;
			case "tool.execution_start": {
				const toolName = obj.data?.toolName ?? "";
				const args = JSON.stringify(obj.data?.arguments ?? "");
				if (toolName === "bash" || toolName === "shell") {
					if (args.includes("git commit") || args.includes("git -c"))
						gitCommits++;
					if (args.includes("git push")) gitPushes++;
				}
				break;
			}
			case "abort":
				aborted = true;
				break;
			case "session.error":
				errorCount++;
				break;
			case "session.compaction_start":
				contextCompactions++;
				break;
			case "subagent.started":
				subagentCount++;
				break;
			case "subagent.completed":
				subagentTokens += obj.data?.totalTokens ?? 0;
				break;
		}
	}

	// Only include sessions for this project
	if (!cwd || !cwd.includes(PROJECT_PATH_FRAGMENT)) return null;
	if (!startDate) return null;

	const status = isActive(lastTs) ? "running" : "completed";
	const multiplier = getPremiumMultiplier(model);

	// Duration in minutes (1 decimal place)
	let durationMinutes = 0;
	if (startDate && lastTs) {
		const diffMs = Date.parse(lastTs) - Date.parse(startDate);
		if (diffMs > 0) durationMinutes = Math.round((diffMs / 60_000) * 10) / 10;
	}

	// agent_active_minutes: sum of per-turn active time (rounded to 1 decimal)
	const agentActiveMinutes =
		agentActiveMs > 0 ? Math.round((agentActiveMs / 60_000) * 10) / 10 : 0;

	// Skill-aware outcome derivation
	// Non-committing skills (code-review, planning, etc.) count as "delivered"
	// when the session completes normally — they never produce git commits by design.
	const isNonCommitting = skillSet.has(skill);
	let outcome = "no-output";
	if (aborted) {
		outcome = "aborted";
	} else if (errorCount > 0) {
		outcome = "error";
	} else if (gitPushes > 0) {
		outcome = "pushed";
	} else if (gitCommits > 0) {
		outcome = "committed";
	} else if (isNonCommitting && agentTurns > 0) {
		outcome = "delivered";
	}

	return {
		session_id: sessionId,
		storyId: null,
		tool: "copilot-cli",
		model,
		premium: true,
		premium_requests: turns,
		premium_multiplier: multiplier,
		premium_cost_units: turns * multiplier,
		tokens: { input: 0, output: 0, total: 0 },
		agent: skill,
		turns,
		human_turns: humanTurns,
		agent_turns: agentTurns,
		git_commits: gitCommits,
		git_pushes: gitPushes,
		aborted,
		context_compactions: contextCompactions,
		subagent_count: subagentCount,
		subagent_tokens: subagentTokens,
		error_count: errorCount,
		duration_minutes: durationMinutes,
		agent_active_minutes: agentActiveMinutes,
		outcome,
		status,
		start_date: startDate,
		end_date: status === "completed" ? (lastTs ?? startDate) : null,
	};
}

/**
 * Parses ~/.copilot/session-state/<sid>/events.jsonl
 * Returns an AgentSession-format object or null if not a bmad-ui session.
 */
function parseCLISession(sessionId, eventsPath) {
	let content;
	try {
		content = readFileSync(eventsPath, "utf8");
	} catch {
		return null;
	}
	return parseCLISessionContent(sessionId, content);
}

// ─── VS Code debug log parser ─────────────────────────────────────────────────

/**
 * Parses <ws-storage>/<hash>/GitHub.copilot-chat/debug-logs/<sid>/main.jsonl
 * Returns an AgentSession-format object or null if the session had no LLM activity.
 */
function parseVSCodeSession(sessionId, logPath) {
	let content;
	try {
		content = readFileSync(logPath, "utf8");
	} catch {
		return null;
	}

	let model = "unknown";
	let startDate = null;
	let lastTs = null;
	let tokensIn = 0;
	let tokensOut = 0;
	let llmRequests = 0;
	let turns = 0;
	let skill = "general";

	for (const raw of content.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		let obj;
		try {
			obj = JSON.parse(line);
		} catch {
			continue;
		}

		const tsMs = typeof obj.ts === "number" ? obj.ts : null;
		if (tsMs) {
			const iso = new Date(tsMs).toISOString();
			if (!startDate) startDate = iso;
			lastTs = iso;
		}

		switch (obj.type) {
			case "llm_request": {
				const attrs = obj.attrs ?? {};
				if (model === "unknown" && attrs.model) model = attrs.model;
				tokensIn += attrs.inputTokens ?? 0;
				tokensOut += attrs.outputTokens ?? 0;
				llmRequests++;
				break;
			}
			case "user_message":
				turns++;
				break;
			case "discovery": {
				// Extract the first loaded skill name (e.g. "Load Skills" discovery event)
				if ((obj.name ?? "").includes("Skills")) {
					const details = obj.attrs?.details ?? "";
					const match = /loaded:\s*\[([^\]]+)\]/.exec(details);
					if (match) {
						const firstSkill = match[1].split(",")[0].trim();
						if (firstSkill) skill = firstSkill;
					}
				}
				break;
			}
		}
	}

	// Skip sessions with no LLM activity (e.g. opened-but-never-used sessions)
	if (llmRequests === 0 || !startDate) return null;

	const status = isActive(lastTs) ? "running" : "completed";
	const multiplier = getPremiumMultiplier(model);
	const totalTokens = tokensIn + tokensOut;

	return {
		session_id: sessionId,
		storyId: null,
		tool: "vscode",
		model,
		premium: true,
		premium_requests: llmRequests,
		premium_multiplier: multiplier,
		premium_cost_units: llmRequests * multiplier,
		tokens: { input: tokensIn, output: tokensOut, total: totalTokens },
		agent: skill,
		turns,
		status,
		start_date: startDate,
		end_date: status === "completed" ? lastTs : null,
	};
}

// ─── Deduplication helpers ────────────────────────────────────────────────────

/** Max time diff (ms) to consider a UUID session a duplicate of a workflow session. */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Check if a parsed session (UUID-keyed) overlaps with any existing
 * workflow-* session having the same skill and a close start time.
 * If so, inherit the workflow session's completed status rather than
 * showing a stale "running" duplicate.
 */
function findMatchingWorkflowSession(parsed, existing) {
	const parsedStart = Date.parse(parsed.start_date);
	if (Number.isNaN(parsedStart)) return null;

	for (const [id, entry] of Object.entries(existing)) {
		if (!id.startsWith("workflow-")) continue;

		const wfStart = Date.parse(
			entry.start_date ?? entry.startedAt ?? "",
		);
		if (Number.isNaN(wfStart)) continue;

		const timeDiff = Math.abs(parsedStart - wfStart);
		const wfSkill = entry.agent ?? entry.skill ?? "";
		const parsedSkill = parsed.agent ?? "";
		const sameSkill =
			parsedSkill === wfSkill ||
			parsedSkill === "general" ||
			wfSkill === "general";

		if (timeDiff <= DEDUP_WINDOW_MS && sameSkill) {
			return { id, entry };
		}
	}
	return null;
}

// ─── Core sync ────────────────────────────────────────────────────────────────

function syncSessions() {
	const existing = readExistingSessions();
	let changed = 0;

	function upsert(id, parsed) {
		const prev = existing[id];

		// Never downgrade a completed session back to running due to stale file reads
		if (
			prev?.status === "completed" &&
			prev?.end_date &&
			parsed.status === "running"
		) {
			parsed = { ...parsed, status: "completed", end_date: prev.end_date };
		}

		// If this UUID session duplicates a workflow session, inherit its status.
		// This prevents showing "running" on the UUID entry when the workflow
		// session already completed.
		if (!id.startsWith("workflow-") && parsed.status === "running") {
			const match = findMatchingWorkflowSession(parsed, existing);
			if (match) {
				const wfStatus = match.entry.status ?? "completed";
				if (wfStatus === "completed" || wfStatus === "failed" || wfStatus === "cancelled") {
					parsed = {
						...parsed,
						status: wfStatus,
						end_date: parsed.end_date || match.entry.end_date || match.entry.endedAt || parsed.start_date,
					};
				}
			}
		}

		const next = normalizeMergedSession({ ...(prev ?? {}), ...parsed });
		if (JSON.stringify(existing[id]) !== JSON.stringify(next)) {
			existing[id] = next;
			changed++;
		}
	}

	// ── 1. Copilot CLI sessions ──────────────────────────────────────────────────
	if (existsSync(CLI_BASE)) {
		let entries;
		try {
			entries = readdirSync(CLI_BASE);
		} catch {
			entries = [];
		}
		for (const sid of entries) {
			const eventsPath = join(CLI_BASE, sid, "events.jsonl");
			if (!existsSync(eventsPath)) continue;

			// Skip already-completed sessions that have all outcome fields populated
			const prev = existing[sid];
			if (
				prev?.tool === "copilot-cli" &&
				prev?.status === "completed" &&
				prev?.end_date &&
				prev?.outcome &&
				prev?.agent_active_minutes != null
			)
				continue;

			const session = parseCLISession(sid, eventsPath);
			if (session) upsert(sid, session);
		}
	}

	// ── 2. VS Code sessions ──────────────────────────────────────────────────────
	const wsHash = findBmadWorkspaceHash();
	if (wsHash) {
		const debugBase = join(
			VS_CODE_WS_BASE,
			wsHash,
			"GitHub.copilot-chat",
			"debug-logs",
		);
		if (existsSync(debugBase)) {
			let entries;
			try {
				entries = readdirSync(debugBase);
			} catch {
				entries = [];
			}
			for (const sid of entries) {
				const logPath = join(debugBase, sid, "main.jsonl");
				if (!existsSync(logPath)) continue;

				const prev = existing[sid];
				if (
					prev?.tool === "vscode" &&
					prev?.status === "completed" &&
					prev?.end_date
				)
					continue;

				const session = parseVSCodeSession(sid, logPath);
				if (session) upsert(sid, session);
			}
		}
	}

	for (const [id, entry] of Object.entries(existing)) {
		const normalized = normalizeMergedSession(entry);
		if (JSON.stringify(entry) !== JSON.stringify(normalized)) {
			existing[id] = normalized;
			changed++;
		}
	}

	if (changed > 0) {
		writeSessions(existing);
		const total = Object.keys(existing).length;
		console.log(
			`[sync-sessions] +${changed} updated  (${total} total sessions)`,
		);
	}
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const isOnce = process.argv.includes("--once");

console.log(
	"[sync-sessions] Starting — scanning Copilot CLI + VS Code sessions…",
);
syncSessions();

if (isOnce) {
	console.log("[sync-sessions] Done.");
} else {
	setInterval(syncSessions, POLL_INTERVAL_MS);
	console.log(`[sync-sessions] Watching every ${POLL_INTERVAL_MS / 1000}s`);
}
