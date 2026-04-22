import { type ChildProcess, execFile, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";
import { projectRoot } from "../paths.js";
import { updateSprintStoryStatus } from "../epics/index.js";
import { persistRuntimeState, type RuntimeSession, type RuntimeState } from "./state.js";

const execFileAsync = promisify(execFile);

export let buildMode = false;

export function setBuildMode(value: boolean): void {
	buildMode = value;
}

export let runningProcess: ReturnType<typeof spawn> | null = null;
export const runningSessionProcesses = new Map<string, ChildProcess>();
export let runningProcessCanAcceptInput = false;
export let runningProcessKind: "orchestrator" | "stage" | null = null;
export let activeWorkflowSkill: string | null = null;
export let sessionIdCounter = 0;

export function setActiveWorkflowSkill(skill: string | null): void {
	activeWorkflowSkill = skill;
}

export function incrementSessionIdCounter(): number {
	sessionIdCounter += 1;
	return sessionIdCounter;
}

export function setRunningProcess(p: ReturnType<typeof spawn> | null): void {
	runningProcess = p;
}

export function setRunningProcessCanAcceptInput(v: boolean): void {
	runningProcessCanAcceptInput = v;
}

export function setRunningProcessKind(k: "orchestrator" | "stage" | null): void {
	runningProcessKind = k;
}

export function isChildProcessAlive(processRef: ChildProcess): boolean {
	if (processRef.exitCode !== null || processRef.killed) {
		return false;
	}

	if (!processRef.pid) {
		return false;
	}

	try {
		process.kill(processRef.pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function resetRunningProcessState(): void {
	runningProcess = null;
	runningProcessCanAcceptInput = false;
	runningProcessKind = null;
}

export function ensureRunningProcessStateIsFresh(): void {
	if (!runningProcess) {
		return;
	}

	if (!isChildProcessAlive(runningProcess)) {
		resetRunningProcessState();
	}
}

export async function markZombieSessionsAsFailed(
	runtimeState: RuntimeState | null,
): Promise<boolean> {
	if (buildMode) {
		return false;
	}
	if (!runtimeState?.sessions) {
		return false;
	}

	let mutated = false;

	for (const session of runtimeState.sessions) {
		if (session.status !== "running") {
			continue;
		}

		if (runningSessionProcesses.has(session.id)) {
			continue;
		}

		const logEmpty =
			!session.logPath ||
			!existsSync(session.logPath) ||
			statSync(session.logPath).size === 0;

		if (logEmpty) {
			session.status = "failed";
			session.error = "Agent process produced no output (0-byte log)";
			session.endedAt = session.endedAt || new Date().toISOString();
			session.exitCode = session.exitCode ?? -1;
			mutated = true;
		} else {
			session.status = "completed";
			session.endedAt = session.endedAt || new Date().toISOString();
			session.exitCode = session.exitCode ?? 0;
			mutated = true;
		}
	}

	if (mutated) {
		await persistRuntimeState(runtimeState);
	}

	return mutated;
}

// TODO Story 11.5: replace local type alias with import from ../analytics
type ZombieAnalyticsSession = {
	sessionId: string;
	status?: string;
	logPath?: string | null;
	endedAt?: string | null;
	exitCode?: number | null;
};

type UpsertSessionFn = (update: {
	sessionId: string;
	status?: string;
	error?: string;
	endedAt?: string | null;
	exitCode?: number | null;
}) => Promise<void>;

export async function markZombieAnalyticsSessionsFailed(
	sessions: ZombieAnalyticsSession[],
	upsertSession: UpsertSessionFn,
): Promise<boolean> {
	if (buildMode) {
		return false;
	}

	let mutated = false;

	for (const session of sessions) {
		if (session.status !== "running") {
			continue;
		}

		if (runningSessionProcesses.has(session.sessionId)) {
			continue;
		}

		const logEmpty =
			!session.logPath ||
			!existsSync(session.logPath) ||
			statSync(session.logPath).size === 0;

		const update: {
			sessionId: string;
			status?: string;
			error?: string;
			endedAt?: string | null;
			exitCode?: number | null;
		} = {
			sessionId: session.sessionId,
		};

		if (logEmpty) {
			update.status = "failed";
			update.error = "Agent process produced no output (0-byte log)";
			update.endedAt = session.endedAt || new Date().toISOString();
			update.exitCode = session.exitCode ?? -1;
		} else {
			update.status = "completed";
			update.endedAt = session.endedAt || new Date().toISOString();
			update.exitCode = session.exitCode ?? 0;
		}

		await upsertSession(update);
		mutated = true;
	}

	return mutated;
}

export function buildAutoResolveInstructions(skill: string): string | null {
	if (skill === "bmad-code-review") {
		return [
			"AUTOMATED ORCHESTRATION MODE — do NOT halt or wait for user input at any checkpoint.",
			"- For decision-needed findings: use your best technical judgment to resolve each one as a patch (apply the fix) or defer (if pre-existing). Never leave them unresolved.",
			"- For patch findings: batch-apply ALL fixes automatically (equivalent to option 0). Do not ask the user to choose.",
			"- After applying fixes, run the build (`npm run build` or `tsc --noEmit`) and fix any new errors before finishing.",
			"- Mark all resolved findings as checked off in the story file.",
			"- Update the story status to done only if every finding was resolved. Otherwise keep it in-progress.",
			"- Complete the entire review-and-fix cycle within this single session.",
		].join("\n");
	}

	if (skill === "bmad-retrospective") {
		return [
			"AUTOMATED ORCHESTRATION MODE — do NOT halt or wait for user input at any checkpoint.",
			"- Set {{non_interactive}} = true for the entire workflow.",
			"- Auto-detect the epic number from sprint-status.yaml (highest epic with all stories done). Do not ask for confirmation.",
			"- If the epic is incomplete, proceed with a partial retrospective automatically.",
			"- Generate the full retrospective report and write it to the implementation artifacts folder.",
			"- Do not ask the user any questions — make all decisions autonomously.",
			"- Complete every step of the retrospective workflow without stopping.",
		].join("\n");
	}

	return null;
}

export function buildAgentCommand(model: string, promptFilePath: string): string {
	const template =
		process.env.BMAD_AGENT_COMMAND_TEMPLATE ||
		'copilot --model "{model}" --allow-all-tools --no-ask-user --no-color --plain-diff -p "$(cat "{promptFile}")"';

	return template
		.replaceAll("{model}", model)
		.replaceAll("{promptFile}", `${promptFilePath}`);
}

// TODO Story 11.5: replace local type alias with import from ../analytics
type SessionAnalyticsHandlers = {
	upsertSession: (update: { sessionId: string; [key: string]: unknown }) => Promise<void>;
	toAnalyticsUpdate: (session: RuntimeSession) => { sessionId: string; [key: string]: unknown };
	persistSessionAnalytics: (session: RuntimeSession) => Promise<void>;
};

export async function startRuntimeSession(session: RuntimeSession, analytics: SessionAnalyticsHandlers): Promise<void> {
	session.status = "running";
	session.startedAt = new Date().toISOString();
	session.endedAt = null;
	session.exitCode = null;
	session.error = null;
	await analytics.upsertSession(analytics.toAnalyticsUpdate(session));

	// Auto-update sprint-status.yaml when a dev-story session starts
	if (session.skill === "bmad-dev-story" && session.storyId) {
		await updateSprintStoryStatus(session.storyId, "in-progress");
	}

	const stageProcess = spawn(session.command, {
		cwd: projectRoot,
		shell: true,
		env: process.env,
	});
	// Only set runningProcess if nothing is currently tracked (legacy single-
	// process APIs: stdin forwarding and /kill). With parallel sessions the
	// first started process is the one that "owns" those APIs.
	if (!runningProcess) {
		runningProcess = stageProcess;
		runningProcessKind = "stage";
	}
	runningProcessCanAcceptInput = false;
	runningSessionProcesses.set(session.id, stageProcess);

	stageProcess.stdout?.on("data", async (chunk: Buffer | string) => {
		await writeFile(session.logPath, chunk.toString(), {
			encoding: "utf8",
			flag: "a",
		});
	});

	stageProcess.stderr?.on("data", async (chunk: Buffer | string) => {
		await writeFile(session.logPath, chunk.toString(), {
			encoding: "utf8",
			flag: "a",
		});
	});

	stageProcess.on("close", async (code: number | null) => {
		const isCancelled = session.status === "cancelled";
		session.exitCode = session.exitCode ?? code ?? null;
		if (!isCancelled) {
			session.status = code === 0 ? "completed" : "failed";
		}
		if (session.endedAt === null) {
			session.endedAt = new Date().toISOString();
		}
		if (!isCancelled && code !== 0 && !session.error) {
			session.error = `Agent command exited with code ${code}`;
		}
		await analytics.upsertSession(analytics.toAnalyticsUpdate(session));
		await analytics.persistSessionAnalytics(session);
		// Only reset the single-process handle if this session owns it
		if (runningProcess === stageProcess) {
			resetRunningProcessState();
		}
		runningSessionProcesses.delete(session.id);

		// Auto-update sprint-status.yaml when a dev-story or code-review session ends
		if (!isCancelled && session.storyId) {
			if (session.skill === "bmad-dev-story" && code === 0) {
				await updateSprintStoryStatus(session.storyId, "review");
			} else if (session.skill === "bmad-code-review" && code === 0) {
				await updateSprintStoryStatus(session.storyId, "done");
			}
		}

		// Merge worktree branch into main and clean up
		if (code === 0 && !isCancelled && session.worktreePath) {
			let mergeSucceeded = false;

			// Step 1: Ensure we're on main branch
			try {
				await execFileAsync("git", ["checkout", "main"], { cwd: projectRoot });
				await writeFile(
					session.logPath,
					`\n[orchestrator] switched to main branch\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			} catch (checkoutError) {
				await writeFile(
					session.logPath,
					`\n[orchestrator] failed to checkout main: ${String(checkoutError)}\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			}

			// Step 2: Fetch latest changes
			try {
				await execFileAsync("git", ["fetch", "origin", "main"], {
					cwd: projectRoot,
				});
				await writeFile(
					session.logPath,
					`\n[orchestrator] fetched latest changes from origin\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			} catch (fetchError) {
				await writeFile(
					session.logPath,
					`\n[orchestrator] fetch warning: ${String(fetchError)}\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			}

			// Step 3: Try merge with conflict resolution strategy (prefer worktree changes)
			try {
				await execFileAsync(
					"git",
					["merge", "--no-edit", "-X", "theirs", session.id],
					{
						cwd: projectRoot,
					},
				);
				mergeSucceeded = true;
				await writeFile(
					session.logPath,
					`\n[orchestrator] ✓ successfully merged branch ${session.id} into main\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			} catch (_mergeError) {
				// Try to resolve conflicts automatically by taking their version (worktree)
				try {
					await execFileAsync(
						"git",
						["diff", "--name-only", "--diff-filter=U"],
						{
							cwd: projectRoot,
						},
					);
					// If there are conflicts, try to resolve them
					await execFileAsync("git", ["checkout", "--theirs", "."], {
						cwd: projectRoot,
					});
					await execFileAsync("git", ["add", "-A"], { cwd: projectRoot });
					await execFileAsync(
						"git",
						[
							"commit",
							"--no-edit",
							"-m",
							`Merge branch '${session.id}' with conflict resolution`,
						],
						{ cwd: projectRoot },
					);
					mergeSucceeded = true;
					await writeFile(
						session.logPath,
						`\n[orchestrator] ✓ merged with automatic conflict resolution (accepted worktree changes)\n`,
						{
							encoding: "utf8",
							flag: "a",
						},
					);
				} catch (conflictError) {
					// Last resort: abort merge and continue cleanup
					await writeFile(
						session.logPath,
						`\n[orchestrator] merge conflict resolution failed: ${String(conflictError)}\n`,
						{
							encoding: "utf8",
							flag: "a",
						},
					);
					try {
						await execFileAsync("git", ["merge", "--abort"], {
							cwd: projectRoot,
						});
						await writeFile(
							session.logPath,
							`\n[orchestrator] aborted merge attempt\n`,
							{
								encoding: "utf8",
								flag: "a",
							},
						);
					} catch (abortError) {
						await writeFile(
							session.logPath,
							`\n[orchestrator] merge abort failed: ${String(abortError)}\n`,
							{
								encoding: "utf8",
								flag: "a",
							},
						);
					}
				}
			}

			// Step 4: Push changes to remote if merge succeeded
			if (mergeSucceeded) {
				try {
					await execFileAsync("git", ["push", "origin", "main"], {
						cwd: projectRoot,
					});
					await writeFile(
						session.logPath,
						`\n[orchestrator] ✓ pushed changes to origin/main\n`,
						{
							encoding: "utf8",
							flag: "a",
						},
					);
				} catch (pushError) {
					await writeFile(
						session.logPath,
						`\n[orchestrator] push to remote failed: ${String(pushError)}\n`,
						{
							encoding: "utf8",
							flag: "a",
						},
					);
				}
			}

			// Step 5: Clean up worktree and branch (always attempt, even if merge failed)
			try {
				await execFileAsync(
					"git",
					["worktree", "remove", "--force", session.worktreePath],
					{
						cwd: projectRoot,
					},
				);
				await writeFile(
					session.logPath,
					`\n[orchestrator] removed worktree directory\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			} catch (cleanupError) {
				await writeFile(
					session.logPath,
					`\n[orchestrator] worktree removal failed: ${String(cleanupError)}\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			}

			try {
				await execFileAsync("git", ["branch", "-D", session.id], {
					cwd: projectRoot,
				});
				await writeFile(
					session.logPath,
					`\n[orchestrator] deleted branch ${session.id}\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			} catch (branchError) {
				await writeFile(
					session.logPath,
					`\n[orchestrator] branch deletion failed: ${String(branchError)}\n`,
					{
						encoding: "utf8",
						flag: "a",
					},
				);
			}
		}
	});

	stageProcess.on("error", async (err: Error) => {
		const isCancelled = session.status === "cancelled";
		if (!isCancelled) {
			session.status = "failed";
			session.error = String(err);
		}
		session.endedAt = new Date().toISOString();
		if (!isCancelled) {
			await writeFile(session.logPath, `\n${String(err)}\n`, {
				encoding: "utf8",
				flag: "a",
			});
		}
		await analytics.upsertSession(analytics.toAnalyticsUpdate(session));
		await analytics.persistSessionAnalytics(session);
		if (runningProcess === stageProcess) {
			resetRunningProcessState();
		}
		runningSessionProcesses.delete(session.id);
	});
}

