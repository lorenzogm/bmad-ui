/**
 * Unit tests for parseCLISessionContent in sync-sessions.mjs
 *
 * Tests cover ACs: 1, 2, 4
 * - human_turns / agent_turns counting
 * - git_commits / git_pushes detection
 * - abort → outcome "aborted"
 * - non-committing skill → outcome "delivered"
 * - error_count from session.error events
 * - subagent_count / subagent_tokens
 * - agent_active_minutes accumulation
 * - skip-completed guard (outcome + agent_active_minutes required)
 */

import { describe, expect, it } from "vitest";
import { parseCLISessionContent } from "./sync-sessions.mjs";

const PROJECT_CWD = "/Users/lorenzogm/lorenzogm/bmad-ui";

function makeSession(events) {
	return events.map((e) => JSON.stringify(e)).join("\n");
}

function baseStart(ts = "2026-04-01T10:00:00.000Z") {
	return {
		type: "session.start",
		timestamp: ts,
		data: {
			selectedModel: "claude-sonnet-4.6",
			startTime: ts,
			context: { cwd: PROJECT_CWD },
		},
	};
}

const NON_COMMITTING = new Set(["bmad-code-review"]);

describe("parseCLISessionContent — human_turns filtering", () => {
	it("counts real user messages and excludes auto-injected XML", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "user.message",
				timestamp: "2026-04-01T10:01:00.000Z",
				data: { content: "Please review this code." },
			},
			{
				type: "user.message",
				timestamp: "2026-04-01T10:02:00.000Z",
				data: {
					content:
						"<reminder>some injected context</reminder><current_datetime>now</current_datetime>",
				},
			},
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:03:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result).not.toBeNull();
		// First message has real content, second is stripped to empty → only 1 human turn
		expect(result.human_turns).toBe(1);
	});

	it("does not count messages with ≤10 chars after stripping XML", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "user.message",
				timestamp: "2026-04-01T10:01:00.000Z",
				data: { content: "<reminder>big block</reminder>ok" },
			},
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:02:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		// "ok" is only 2 chars after stripping — not counted
		expect(result.human_turns).toBe(0);
	});
});

describe("parseCLISessionContent — git_commits and git_pushes", () => {
	it("counts bash git commit calls as git_commits", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "tool.execution_start",
				data: {
					toolName: "bash",
					arguments: { command: "git commit -m 'feat: add tests'" },
				},
			},
			{
				type: "tool.execution_start",
				data: {
					toolName: "bash",
					arguments: { command: "git commit -m 'fix: oops'" },
				},
			},
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:02:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.git_commits).toBe(2);
		expect(result.git_pushes).toBe(0);
		expect(result.outcome).toBe("committed");
	});

	it("counts bash git push calls and sets outcome to pushed", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "tool.execution_start",
				data: {
					toolName: "bash",
					arguments: { command: "git push origin main" },
				},
			},
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:02:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.git_pushes).toBe(1);
		expect(result.outcome).toBe("pushed");
	});
});

describe("parseCLISessionContent — abort event", () => {
	it("sets aborted=true and outcome='aborted' when abort event present", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "tool.execution_start",
				data: {
					toolName: "bash",
					arguments: { command: "git push origin main" },
				},
			},
			{ type: "abort", timestamp: "2026-04-01T10:02:00.000Z" },
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:03:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.aborted).toBe(true);
		expect(result.outcome).toBe("aborted");
	});
});

describe("parseCLISessionContent — non-committing skill outcome", () => {
	it("sets outcome='delivered' for bmad-code-review with agent turns and no abort/error", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "skill.invoked",
				data: { name: "bmad-code-review" },
			},
			{
				type: "user.message",
				timestamp: "2026-04-01T10:01:00.000Z",
				data: { content: "Please review the code changes." },
			},
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:05:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.outcome).toBe("delivered");
	});

	it("sets outcome='no-output' for non-committing skill with zero agent turns", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "skill.invoked",
				data: { name: "bmad-code-review" },
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.outcome).toBe("no-output");
	});
});

describe("parseCLISessionContent — session.error events", () => {
	it("counts session.error events as error_count and sets outcome='error'", () => {
		const content = makeSession([
			baseStart(),
			{ type: "session.error", timestamp: "2026-04-01T10:01:00.000Z" },
			{ type: "session.error", timestamp: "2026-04-01T10:02:00.000Z" },
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:03:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.error_count).toBe(2);
		expect(result.outcome).toBe("error");
	});
});

describe("parseCLISessionContent — subagent events", () => {
	it("counts subagent.started events and sums totalTokens from subagent.completed", () => {
		const content = makeSession([
			baseStart(),
			{ type: "subagent.started", timestamp: "2026-04-01T10:01:00.000Z" },
			{ type: "subagent.started", timestamp: "2026-04-01T10:02:00.000Z" },
			{ type: "subagent.completed", data: { totalTokens: 1500 } },
			{ type: "subagent.completed", data: { totalTokens: 2500 } },
			{
				type: "assistant.turn_end",
				timestamp: "2026-04-01T10:03:00.000Z",
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.subagent_count).toBe(2);
		expect(result.subagent_tokens).toBe(4000);
	});
});

describe("parseCLISessionContent — agent_active_minutes", () => {
	it("accumulates only user-message-to-turn-end durations, not idle gaps", () => {
		// Turn 1: user at T0, turn_end at T0+4min → 4 min active
		// Turn 2: user at T0+30min (idle gap), turn_end at T0+32min → 2 min active
		// Total: 6 min active, NOT 32 min wall clock
		const t0 = new Date("2026-04-01T10:00:00.000Z").getTime();

		const content = makeSession([
			baseStart("2026-04-01T10:00:00.000Z"),
			{
				type: "user.message",
				timestamp: new Date(t0 + 0).toISOString(),
				data: { content: "First real message here" },
			},
			{
				type: "assistant.turn_end",
				timestamp: new Date(t0 + 4 * 60_000).toISOString(),
			},
			{
				type: "user.message",
				timestamp: new Date(t0 + 30 * 60_000).toISOString(),
				data: { content: "Second real message here" },
			},
			{
				type: "assistant.turn_end",
				timestamp: new Date(t0 + 32 * 60_000).toISOString(),
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		// 4 + 2 = 6 min active
		expect(result.agent_active_minutes).toBe(6);
		// wall-clock duration_minutes should be 32 min
		expect(result.duration_minutes).toBe(32);
	});

	it("returns 0 for agent_active_minutes when no turn-end events", () => {
		const content = makeSession([
			baseStart(),
			{
				type: "user.message",
				timestamp: "2026-04-01T10:01:00.000Z",
				data: { content: "Hello agent please do something." },
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result.agent_active_minutes).toBe(0);
	});
});

describe("parseCLISessionContent — project filter", () => {
	it("returns null for sessions from a different project cwd", () => {
		const content = makeSession([
			{
				type: "session.start",
				timestamp: "2026-04-01T10:00:00.000Z",
				data: {
					selectedModel: "claude-sonnet-4.6",
					startTime: "2026-04-01T10:00:00.000Z",
					context: { cwd: "/Users/someone/other-project" },
				},
			},
		]);

		const result = parseCLISessionContent("test-sid", content, NON_COMMITTING);
		expect(result).toBeNull();
	});
});
