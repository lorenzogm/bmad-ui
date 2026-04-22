import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { agentsDir } from "../paths"

export const runtimeStatePath = path.join(agentsDir, "runtime-state.json")
export const runtimeLogsDir = path.join(agentsDir, "logs")

export type RuntimeSession = {
  id: string
  skill: string
  model: string
  storyId: string | null
  status: string
  startedAt: string
  endedAt: string | null
  command: string
  promptPath: string
  logPath: string
  worktreePath: string | null
  exitCode: number | null
  error: string | null
  userMessages: Array<{
    id: string
    text: string
    sentAt: string
  }>
}

export type RuntimeState = {
  status: string
  startedAt: string
  updatedAt: string
  currentStage: string
  dryRun: boolean
  execute: boolean
  nonInteractive: boolean
  targetStory: { id: string; status: string } | null
  parallelCandidate: { id: string; status: string } | null
  sessions: RuntimeSession[]
  notes: string[]
}

export async function persistRuntimeState(runtimeState: RuntimeState): Promise<void> {
	runtimeState.updatedAt = new Date().toISOString();
	await mkdir(path.dirname(runtimeStatePath), { recursive: true });
	await writeFile(
		runtimeStatePath,
		`${JSON.stringify(runtimeState, null, 2)}\n`,
		"utf8",
	);
}

export async function readRuntimeStateFile(): Promise<RuntimeState | null> {
	if (!existsSync(runtimeStatePath)) {
		return null;
	}

	return JSON.parse(await readFile(runtimeStatePath, "utf8")) as RuntimeState;
}

export function createEmptyRuntimeState(): RuntimeState {
	const now = new Date().toISOString();
	return {
		status: "running",
		startedAt: now,
		updatedAt: now,
		currentStage: "home",
		dryRun: false,
		execute: true,
		nonInteractive: true,
		targetStory: null,
		parallelCandidate: null,
		sessions: [],
		notes: ["Agent sessions run in the workspace root."],
	};
}

export async function loadOrCreateRuntimeState(): Promise<RuntimeState> {
	const existing = await readRuntimeStateFile();
	if (existing) {
		return existing;
	}

	const nextState = createEmptyRuntimeState();
	await persistRuntimeState(nextState);
	return nextState;
}

export function createRuntimeSession(params: {
	id: string;
	skill: string;
	model: string;
	storyId?: string | null;
	command: string;
	promptPath: string;
	logPath: string;
}): RuntimeSession {
	return {
		id: params.id,
		skill: params.skill,
		model: params.model,
		storyId: params.storyId || null,
		status: "planned",
		startedAt: new Date().toISOString(),
		endedAt: null,
		command: params.command,
		promptPath: params.promptPath,
		logPath: params.logPath,
		worktreePath: null,
		exitCode: null,
		error: null,
		userMessages: [],
	};
}

