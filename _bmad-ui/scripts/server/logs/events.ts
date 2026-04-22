import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const copilotSessionStateDir = path.join(os.homedir(), ".copilot", "session-state");
const SESSION_TIMESTAMP_REGEX = /(\d{13})$/;
const SESSION_MATCH_WINDOW_MS = 30_000;

export function stripAnsi(value: string): string {
	let cleaned = "";

	for (let index = 0; index < value.length; index += 1) {
		const current = value[index];

		if (current === "\u001b" && value[index + 1] === "[") {
			index += 2;

			while (index < value.length && value[index] !== "m") {
				index += 1;
			}

			continue;
		}

		cleaned += current;
	}

	return cleaned;
}

export function describeToolCall(toolName: string): string {
	const map: Record<string, string> = {
		read_file: "Reading file",
		grep_search: "Searching code",
		file_search: "Finding files",
		list_dir: "Listing directory",
		semantic_search: "Searching semantically",
		replace_string_in_file: "Editing file",
		multi_replace_string_in_file: "Editing files",
		create_file: "Creating file",
		run_in_terminal: "Running command",
		execution_subagent: "Running subagent",
		search_subagent: "Running search",
		runSubagent: "Running subagent",
		get_errors: "Checking errors",
		manage_todo_list: "Updating todos",
		memory: "Using memory",
		vscode_listCodeUsages: "Finding usages",
		vscode_renameSymbol: "Renaming symbol",
		fetch_webpage: "Fetching webpage",
	};
	return map[toolName] || toolName;
}

export async function findAllCliEventsJsonl(
	sessionId: string,
	userMessages: Array<{ sentAt: string }>,
): Promise<string[]> {
	const match = SESSION_TIMESTAMP_REGEX.exec(sessionId);
	if (!match) {
		return [];
	}

	// Collect all timestamps to match: the session ID ts + each userMessage sentAt
	const timestamps: number[] = [Number(match[1])];
	for (const msg of userMessages) {
		const ms = Date.parse(msg.sentAt);
		if (!Number.isNaN(ms)) {
			timestamps.push(ms);
		}
	}

	if (!existsSync(copilotSessionStateDir)) {
		return [];
	}

	let entries: string[];
	try {
		entries = await readdir(copilotSessionStateDir);
	} catch {
		return [];
	}

	// Build index of CLI session created_at timestamps
	const cliIndex: Array<{ createdMs: number; eventsPath: string }> = [];
	for (const entry of entries) {
		const wsPath = path.join(copilotSessionStateDir, entry, "workspace.yaml");
		if (!existsSync(wsPath)) {
			continue;
		}

		try {
			const wsContent = await readFile(wsPath, "utf8");
			const createdMatch = /created_at:\s*(\S+)/.exec(wsContent);
			if (!createdMatch) {
				continue;
			}

			const createdMs = Date.parse(createdMatch[1]);
			if (Number.isNaN(createdMs)) {
				continue;
			}

			const eventsPath = path.join(
				copilotSessionStateDir,
				entry,
				"events.jsonl",
			);
			if (existsSync(eventsPath)) {
				cliIndex.push({ createdMs, eventsPath });
			}
		} catch {}
	}

	// Match each timestamp to a CLI session
	const matched: Array<{ ts: number; eventsPath: string }> = [];
	for (const ts of timestamps) {
		for (const cli of cliIndex) {
			if (Math.abs(cli.createdMs - ts) <= SESSION_MATCH_WINDOW_MS) {
				matched.push({ ts, eventsPath: cli.eventsPath });
				break;
			}
		}
	}

	// Sort by timestamp to get chronological order
	matched.sort((a, b) => a.ts - b.ts);

	// Deduplicate paths (same CLI session could match multiple timestamps)
	const seen = new Set<string>();
	const result: string[] = [];
	for (const m of matched) {
		if (!seen.has(m.eventsPath)) {
			seen.add(m.eventsPath);
			result.push(m.eventsPath);
		}
	}

	return result;
}

export function buildLogFromEvents(eventsContent: string): string {
	const lines = eventsContent.split("\n").filter((l) => l.trim().length > 0);
	const output: string[] = [];

	for (const line of lines) {
		let event: Record<string, unknown>;
		try {
			event = JSON.parse(line) as Record<string, unknown>;
		} catch {
			continue;
		}

		const eventType = event.type as string | undefined;
		const eventData = (event.data ?? {}) as Record<string, unknown>;

		switch (eventType) {
			case "user.message": {
				const content =
					typeof eventData.content === "string" ? eventData.content.trim() : "";
				if (content) {
					output.push(`[user] ${content}`);
				}
				break;
			}

			case "assistant.message": {
				const content =
					typeof eventData.content === "string" ? eventData.content.trim() : "";
				if (content) {
					output.push(content);
				}

				const toolRequests = Array.isArray(eventData.toolRequests)
					? eventData.toolRequests
					: [];
				for (const req of toolRequests) {
					const name = (req as Record<string, unknown>).name || "unknown";
					const desc = describeToolCall(String(name));
					let detail = "";

					const rawArgs = (req as Record<string, unknown>).arguments;
					const args: Record<string, unknown> =
						typeof rawArgs === "string"
							? (() => {
									try {
										return JSON.parse(rawArgs) as Record<string, unknown>;
									} catch {
										return {};
									}
								})()
							: typeof rawArgs === "object" && rawArgs !== null
								? (rawArgs as Record<string, unknown>)
								: {};

					if (typeof args.filePath === "string") {
						detail = ` ${path.basename(args.filePath)}`;
					} else if (typeof args.query === "string") {
						const q = args.query.slice(0, 60);
						detail = q ? ` "${q}"` : "";
					} else if (typeof args.command === "string") {
						const cmd = args.command.slice(0, 80);
						detail = cmd ? ` \`${cmd}\`` : "";
					}

					output.push(`● ${desc}${detail}`);
				}
				break;
			}

			case "tool.execution_complete": {
				// result can be a string or an object with content/detailedContent
				const rawResult = eventData.result;
				let resultText = "";
				if (typeof rawResult === "string") {
					resultText = rawResult.trim();
				} else if (typeof rawResult === "object" && rawResult !== null) {
					const resultObj = rawResult as Record<string, unknown>;
					const content =
						typeof resultObj.content === "string" ? resultObj.content : "";
					const detailed =
						typeof resultObj.detailedContent === "string"
							? resultObj.detailedContent
							: "";
					resultText = (detailed || content).trim();
				}
				if (resultText.length > 0) {
					const resultLines = resultText.split("\n");
					for (const rl of resultLines) {
						output.push(`  │ ${rl}`);
					}
					output.push(`  └ done`);
				}
				break;
			}

			default:
				break;
		}
	}

	return output.join("\n");
}

export async function buildCleanLogContent(
	sessionId: string,
	userMessages: Array<{ sentAt: string }>,
	fallbackRawLog: string | null,
): Promise<string | null> {
	const eventsPaths = await findAllCliEventsJsonl(sessionId, userMessages);
	if (eventsPaths.length > 0) {
		try {
			const parts: string[] = [];
			for (const ep of eventsPaths) {
				const eventsContent = await readFile(ep, "utf8");
				const built = buildLogFromEvents(eventsContent);
				if (built.trim().length > 0) {
					parts.push(built);
				}
			}
			if (parts.length > 0) {
				return parts.join("\n\n");
			}
		} catch {
			// fall through to raw log
		}
	}
	return fallbackRawLog;
}
