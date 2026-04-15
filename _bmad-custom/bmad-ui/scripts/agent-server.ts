import { type ChildProcess, execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import type { ViteDevServer } from "vite";
const execFileAsync = promisify(execFile);

type StoryStatus =
  | "backlog"
  | "ready-for-dev"
  | "in-progress"
  | "review"
  | "done";
type EpicStatus = "backlog" | "in-progress" | "done";
type StoryWorkflowStepSkill =
  | "bmad-create-story"
  | "bmad-dev-story"
  | "bmad-code-review";

type EpicWorkflowStepSkill =
  | "bmad-sprint-status"
  | "bmad-sprint-planning"
  | "bmad-retrospective";

type EpicLifecycleSteps = Record<EpicWorkflowStepSkill, WorkflowStepState>;

type WorkflowStepState = "not-started" | "running" | "completed" | "failed";

type RuntimeSession = {
  id: string;
  skill: string;
  model: string;
  storyId: string | null;

  status: string;
  startedAt: string;
  endedAt: string | null;
  command: string;
  promptPath: string;
  logPath: string;
  exitCode: number | null;
  error: string | null;
  userMessages: Array<{
    id: string;
    text: string;
    sentAt: string;
  }>;
};

type RuntimeState = {
  status: string;
  startedAt: string;
  updatedAt: string;
  currentStage: string;
  dryRun: boolean;
  execute: boolean;
  nonInteractive: boolean;
  targetStory: { id: string; status: StoryStatus } | null;
  parallelCandidate: { id: string; status: StoryStatus } | null;
  sessions: RuntimeSession[];
  notes: string[];
};

type SprintOverview = {
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
    status: EpicStatus;
    storyCount: number;
    byStoryStatus: Record<StoryStatus, number>;
    lifecycleSteps: EpicLifecycleSteps;
  }>;
};

type ExternalProcess = {
  pid: number;
  elapsed: string;
  command: string;
};

type SessionDetailResponse = {
  session: RuntimeSession;
  logContent: string | null;
  promptContent: string | null;
  logExists: boolean;
  promptExists: boolean;
  isRunning: boolean;
  canSendInput: boolean;
};

type DependencyTreeNode = {
  id: string;
  label: string;
  status: EpicStatus;
  storyCount: number;
  dependsOn: string[];
};

type ParsedEpicMarkdownRow = {
  id: string;
  number: number;
  label: string;
  dependsOn: string[];
};

type EpicConsistency = {
  hasMismatch: boolean;
  epicsMarkdownCount: number;
  sprintStatusCount: number;
  warning: string | null;
};

type AgentSession = {
  session_id?: string;
  storyId?: string | null;
  tool: string;
  model: string;
  premium: boolean;
  premium_requests: number;
  premium_multiplier: number;
  premium_cost_units: number;
  tokens: { input: number; output: number; total: number };
  agent: string;
  turns: number;
  status: "running" | "completed";
  start_date: string;
  end_date: string | null;
  notes?: string;
};

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const artifactsRoot = path.join(projectRoot, "_bmad-output");
const agentsDir = path.join(projectRoot, "_bmad-custom", "agents");
const runtimeStatePath = path.join(agentsDir, "runtime-state.json");
const runtimeLogsDir = path.join(agentsDir, "logs");
const analyticsStorePath = path.join(agentsDir, "agent-sessions.json");
const legacyAnalyticsStorePaths: string[] = [];
const agentSessionsPath = analyticsStorePath;


const sprintStatusFile = path.join(
  artifactsRoot,
  "implementation-artifacts",
  "sprint-status.yaml"
);
const epicsFile = path.join(artifactsRoot, "planning-artifacts", "epics.md");
const storyDependenciesFile = path.join(
  projectRoot,
  "_bmad-custom",
  "story-dependencies.yaml"
);

const STORY_WORKFLOW_STEPS: Array<{
  skill: StoryWorkflowStepSkill;
  label: string;
}> = [
  { skill: "bmad-create-story", label: "Create Story" },
  { skill: "bmad-dev-story", label: "Dev Story" },
  { skill: "bmad-code-review", label: "Code Review" },
];

const EPIC_WORKFLOW_STEPS: Array<{
  skill: EpicWorkflowStepSkill;
  label: string;
}> = [
  { skill: "bmad-sprint-status", label: "Sprint Status" },
  { skill: "bmad-sprint-planning", label: "Sprint Planning" },
  { skill: "bmad-retrospective", label: "Retrospective" },
];

const DEFAULT_STAGE_MODELS = {
  planning: "claude-haiku-4.5",
  retrospective: "claude-haiku-4.5",
} as const;
const DEFAULT_WORKFLOW_MODEL = "claude-haiku-4.5";

let runningProcess: ReturnType<typeof spawn> | null = null;
const runningSessionProcesses = new Map<string, ChildProcess>();
let runningProcessCanAcceptInput = false;
let runningProcessKind: "orchestrator" | "stage" | null = null;
let activeWorkflowSkill: string | null = null;

function isChildProcessAlive(processRef: ChildProcess): boolean {
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

function resetRunningProcessState(): void {
  runningProcess = null;
  runningProcessCanAcceptInput = false;
  runningProcessKind = null;
}

function ensureRunningProcessStateIsFresh(): void {
  if (!runningProcess) {
    return;
  }

  if (!isChildProcessAlive(runningProcess)) {
    resetRunningProcessState();
  }
}

const PS_LINE_REGEX = /^(\d+)\s+([^\s]+)\s+(.+)$/;
const SPRINT_STORY_STATUS_REGEX =
  /^([0-9]+-[0-9]+-[a-z0-9-]+):\s*(backlog|ready-for-dev|in-progress|review|done)$/;
const EPIC_STATUS_REGEX = /^epic-(\d+):\s*(backlog|in-progress|done)$/;
const EPIC_PLANNING_REGEX = /^epic-(\d+)-planning:\s*([a-z-]+)$/;
const EPIC_RETROSPECTIVE_REGEX = /^epic-(\d+)-retrospective:\s*([a-z-]+)$/;
const EPICS_MARKDOWN_ROW_REGEX =
  /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/;
const EPICS_STORY_HEADING_REGEX = /^###\s+Story\s+(\d+)\.(\d+):\s*(.*)$/i;
const EPICS_EPIC_HEADING_REGEX = /^##+\s+Epic\s+(\d+)\s*:/i;
const EPICS_EPIC_HEADING_WITH_NAME_REGEX = /^##+\s+Epic\s+(\d+)\s*:\s*(.+)$/i;
const EPICS_STORY_FALLBACK_LABEL = "story";
const EPIC_DEPENDENCY_NUMBER_REGEX = /\d+/g;
const SUMMARY_LINE_REGEX = /(?:^|\n)(?:summary|resumen)\s*:\s*(.+)$/im;
const SESSION_DETAIL_PATH_REGEX = /^\/api\/session\/([^/]+)$/;
const SESSION_EVENTS_PATH_REGEX = /^\/api\/events\/session\/([^/]+)$/;
const SESSION_INPUT_PATH_REGEX = /^\/api\/session\/([^/]+)\/input$/;
const SESSION_START_PATH_REGEX = /^\/api\/session\/([^/]+)\/start$/;
const SESSION_ABORT_PATH_REGEX = /^\/api\/session\/([^/]+)\/abort$/;
const ORCHESTRATOR_INPUT_PATH_REGEX = /^\/api\/orchestrator\/input$/;
const MARK_REVIEW_PATH_REGEX = /^\/api\/story\/([^/]+)\/mark-review$/;
const STORY_DETAIL_PATH_REGEX = /^\/api\/story\/([^/]+)$/;
const EPIC_DETAIL_PATH_REGEX = /^\/api\/epic\/epic-(\d+)$/;
const LAST_UPDATED_COMMENT_REGEX = /^#\s*last_updated:\s*.*$/m;
const YAML_COMMENT_REGEX = /#.*$/;
const YAML_STORY_HEADER_REGEX = /^ {2}(\d+-\d+-[a-z0-9-]+):$/;
const YAML_DEP_ITEM_REGEX = /^\s{4}- (\d+-\d+-[a-z0-9-]+)$/;
const ANALYTICS_REQUESTS_LINE_REGEX = /^Requests\s+([\d.]+)/m;
const ANALYTICS_TOKENS_LINE_REGEX =
  /^Tokens\s+\u2191\s*([\d.]+)([kmb]?)\s*\u2022\s*\u2193\s*([\d.]+)([kmb]?)\s*\u2022\s*([\d.]+)([kmb]?)\s*\(cached\)/m;
const ANALYTICS_OLD_STYLE_SESSION_REGEX = /^(\d+)-(\d+)-(.+)$/;
const ANALYTICS_EPIC_SESSION_REGEX = /^epic-(\d+)-(.+)$/;

function buildAgentCommand(model: string, promptFilePath: string): string {
  const template =
    process.env.BMAD_AGENT_COMMAND_TEMPLATE ||
    'copilot --model "{model}" --allow-all-tools --no-ask-user -p "$(cat "{promptFile}")"';

  return template
    .replaceAll("{model}", model)
    .replaceAll("{promptFile}", `${promptFilePath}`);
}

async function persistRuntimeState(runtimeState: RuntimeState): Promise<void> {
  runtimeState.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(runtimeStatePath), { recursive: true });
  await writeFile(
    runtimeStatePath,
    `${JSON.stringify(runtimeState, null, 2)}\n`,
    "utf8"
  );
}

async function readRuntimeStateFile(): Promise<RuntimeState | null> {
  if (!existsSync(runtimeStatePath)) {
    return null;
  }

  return JSON.parse(await readFile(runtimeStatePath, "utf8")) as RuntimeState;
}

async function readAgentSessionsFile(): Promise<AgentSession[]> {
  const candidatePath =
    [agentSessionsPath, ...legacyAnalyticsStorePaths].find((p) => existsSync(p)) ||
    null;
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

function normalizeToAgentSession(
  entry: Record<string, unknown>,
): AgentSession {
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
    session_id: (entry.sessionId as string) || (entry.session_id as string) || undefined,
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
    start_date: (entry.startedAt as string) || (entry.start_date as string) || "",
    end_date: (entry.endedAt as string) || (entry.end_date as string) || null,
  };
}

function createEmptyRuntimeState(): RuntimeState {
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

async function loadOrCreateRuntimeState(): Promise<RuntimeState> {
  const existing = await readRuntimeStateFile();
  if (existing) {
    return existing;
  }

  const nextState = createEmptyRuntimeState();
  await persistRuntimeState(nextState);
  return nextState;
}

function createRuntimeSession(params: {
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
    exitCode: null,
    error: null,
    userMessages: [],
  };
}

async function startRuntimeSession(
  runtimeState: RuntimeState,
  session: RuntimeSession
): Promise<void> {
  session.status = "running";
  session.startedAt = new Date().toISOString();
  session.endedAt = null;
  session.exitCode = null;
  session.error = null;
  await persistRuntimeState(runtimeState);

  const stageProcess = spawn(session.command, {
    cwd: projectRoot,
    shell: true,
    env: process.env,
  });
  runningProcess = stageProcess;
  runningProcessCanAcceptInput = false;
  runningProcessKind = "stage";
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
    await persistRuntimeState(runtimeState);
    await persistSessionAnalytics(session);
    resetRunningProcessState();
    runningSessionProcesses.delete(session.id);
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
    await persistRuntimeState(runtimeState);
    await persistSessionAnalytics(session);
    resetRunningProcessState();
    runningSessionProcesses.delete(session.id);
  });
}

async function buildOverviewPayload() {
  ensureRunningProcessStateIsFresh();
  const runtimeState = await readRuntimeStateFile();
  const sprintOverview = await loadSprintOverview(runtimeState);
  const externalProcesses = await getExternalCliProcesses();
  const epicsContent = existsSync(epicsFile)
    ? await readFile(epicsFile, "utf8")
    : "";
  const parsedEpicRows = parseEpicMarkdownRows(epicsContent);
  const dependencyTree = {
    nodes: buildDependencyTree(parsedEpicRows, sprintOverview),
  };
  const epicConsistency = summarizeEpicConsistency(
    parsedEpicRows,
    sprintOverview
  );
  const storyDependencies = loadStoryDependencies();

  const listArtifactDir = async (dir: string): Promise<string[]> => {
    const dirPath = path.join(artifactsRoot, dir);
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      return [];
    }
  };

  const [planningArtifactFiles, implementationArtifactFiles, agentSessions] =
    await Promise.all([
      listArtifactDir("planning-artifacts"),
      listArtifactDir("implementation-artifacts"),
      readAgentSessionsFile(),
    ]);

  // Derive activeWorkflowSkill from persisted runtime sessions — the in-memory
  // variable is the canonical source while a session is starting; once the
  // session is persisted as "running" we use that, and clear the in-memory
  // value so there is no stale data after the process exits.
  const runningSession = runtimeState?.sessions.find(
    (s) => s.status === "running"
  );
  if (runningSession) {
    activeWorkflowSkill = runningSession.skill;
  } else if (
    activeWorkflowSkill &&
    !runningSessionProcesses.size
  ) {
    activeWorkflowSkill = null;
  }

  return {
    steps: STORY_WORKFLOW_STEPS,
    epicSteps: summarizeEpicSteps(runtimeState),
    sprintOverview,
    runtimeState,
    agentRunner: {
      isRunning: runningProcess !== null,
      canSendInput: runningProcessCanAcceptInput,
      isNonInteractive: runtimeState?.nonInteractive ?? true,
    },
    externalProcesses,
    dependencyTree,
    epicConsistency,
    storyDependencies,
    planningArtifactFiles,
    implementationArtifactFiles,
    activeWorkflowSkill,
    agentSessions,
  };
}

function slugifyStoryLabel(value: string): string {
  const lowered = value.toLowerCase();
  const sanitized = lowered
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return sanitized || EPICS_STORY_FALLBACK_LABEL;
}

function summarizeSprintFromEpics(
  epicsContent: string,
  runtimeState: RuntimeState | null
): SprintOverview {
  const stories: Array<{
    id: string;
    status: StoryStatus;
    steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
  }> = [];

  const seenStoryIds = new Set<string>();
  const mentionedEpicNumbers = new Set<number>();

  for (const line of epicsContent.split("\n")) {
    const raw = line.trim();
    const epicMatch = raw.match(EPICS_EPIC_HEADING_REGEX);
    if (epicMatch) {
      const epicNumber = Number(epicMatch[1]);
      if (Number.isFinite(epicNumber)) {
        mentionedEpicNumbers.add(epicNumber);
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

  if (runtimeState?.sessions) {
    for (const story of stories) {
      for (const step of STORY_WORKFLOW_STEPS) {
        const history = runtimeState.sessions
          .filter(
            (session) =>
              session.storyId === story.id && session.skill === step.skill
          )
          .filter((session) => session.status !== "planned")
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

        if (history[0]) {
          story.steps[step.skill] = toStepState(history[0].status);
        }
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
      status: EpicStatus;
      storyCount: number;
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
      status: "backlog",
      storyCount: 0,
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
    if (epic.storyCount > 0 && epic.byStoryStatus.done === epic.storyCount) {
      epic.status = "done";
      epic.lifecycleSteps["bmad-sprint-status"] = "completed";
      epic.lifecycleSteps["bmad-sprint-planning"] = "completed";
      epic.lifecycleSteps["bmad-retrospective"] = "completed";
      continue;
    }

    if (
      epic.byStoryStatus["ready-for-dev"] > 0 ||
      epic.byStoryStatus["in-progress"] > 0 ||
      epic.byStoryStatus.review > 0 ||
      epic.byStoryStatus.done > 0
    ) {
      epic.status = "in-progress";
      epic.lifecycleSteps["bmad-sprint-status"] = "completed";
      continue;
    }
  }

  const epics = Array.from(epicMap.values()).sort(
    (a, b) => a.number - b.number
  );

  return {
    totalStories: stories.length,
    storiesByStatus,
    stories,
    epics,
  };
}

async function loadSprintOverview(
  runtimeState: RuntimeState | null
): Promise<SprintOverview> {
  if (existsSync(sprintStatusFile)) {
    const sprintContent = await readFile(sprintStatusFile, "utf8");
    return summarizeSprint(sprintContent, runtimeState);
  }

  let epicsContent = "";
  if (existsSync(epicsFile)) {
    try {
      epicsContent = await readFile(epicsFile, "utf8");
    } catch {
      epicsContent = "";
    }
  }

  return summarizeSprintFromEpics(epicsContent, runtimeState);
}

async function buildSessionDetailPayload(
  sessionId: string
): Promise<SessionDetailResponse | null> {
  const runtimeState = await readRuntimeStateFile();
  const session =
    runtimeState?.sessions.find((candidate) => candidate.id === sessionId) ||
    null;

  if (!session) {
    return null;
  }

  const logContent = await readOptionalTextFile(session.logPath);
  const promptContent = await readOptionalTextFile(session.promptPath);

  return {
    session,
    logContent,
    promptContent,
    logExists: Boolean(session.logPath && existsSync(session.logPath)),
    promptExists: Boolean(session.promptPath && existsSync(session.promptPath)),
    isRunning:
      session.status === "running" || runningSessionProcesses.has(session.id),
    canSendInput: runningSessionProcesses.has(session.id),
  };
}

async function parseJsonBody<T>(
  req: AsyncIterable<Buffer | string>
): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return (rawBody.length > 0 ? JSON.parse(rawBody) : {}) as T;
}

async function getExternalCliProcesses(): Promise<ExternalProcess[]> {
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
      keywords.some((keyword) => item.command.toLowerCase().includes(keyword))
    )
    .slice(0, 12);
}

function toStepState(sessionStatus: string): WorkflowStepState {
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

function deriveStoryStepStateFromStatus(
  storyStatus: StoryStatus,
  step: StoryWorkflowStepSkill
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

function summarizeSprint(
  content: string,
  runtimeState: RuntimeState | null
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
          retrospectiveMatch[2]
        );
      }
      continue;
    }

    const storyStatus = match[2] as StoryStatus;
    stories.push({
      id: match[1],
      status: storyStatus,
      steps: {
        "bmad-create-story": deriveStoryStepStateFromStatus(storyStatus, "bmad-create-story"),
        "bmad-dev-story": deriveStoryStepStateFromStatus(storyStatus, "bmad-dev-story"),
        "bmad-code-review": deriveStoryStepStateFromStatus(storyStatus, "bmad-code-review"),
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

  if (runtimeState?.sessions) {
    for (const story of stories) {
      for (const step of STORY_WORKFLOW_STEPS) {
        const history = runtimeState.sessions
          .filter(
            (session) =>
              session.storyId === story.id && session.skill === step.skill
          )
          .filter((session) => session.status !== "planned")
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

        if (history[0]) {
          const sessionState = toStepState(history[0].status);
          // Only override for transient states (running/failed); the YAML
          // story status is the source of truth for completed steps.
          if (sessionState === "running" || sessionState === "failed") {
            story.steps[step.skill] = sessionState;
          }
        }
      }
    }
  }

  const epicMap = new Map<
    number,
    {
      id: string;
      number: number;
      status: EpicStatus;
      storyCount: number;
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
        status: explicitEpicStatus.get(storyNumber) || "backlog",
        storyCount: 0,
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
        status,
        storyCount: 0,
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

function summarizeEpicSteps(runtimeState: RuntimeState | null): Array<{
  skill: EpicWorkflowStepSkill;
  label: string;
  state: WorkflowStepState;
}> {
  return EPIC_WORKFLOW_STEPS.map((step) => {
    const latest = (runtimeState?.sessions || [])
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

function parseEpicMarkdownRows(
  epicsContent: string
): ParsedEpicMarkdownRow[] {
  const rows: ParsedEpicMarkdownRow[] = [];
  const seen = new Set<string>();

  for (const line of epicsContent.split("\n")) {
    const trimmed = line.trim();

    // Try markdown table row first: | 1 | Name | ... | deps |
    const tableRow = trimmed.match(EPICS_MARKDOWN_ROW_REGEX);
    if (tableRow) {
      const epicNumber = Number(tableRow[1]);
      if (!Number.isFinite(epicNumber)) {
        continue;
      }
      const id = `epic-${epicNumber}`;
      if (seen.has(id)) {
        continue;
      }
      const label = tableRow[2].trim();
      const dependenciesCell = tableRow[4].trim();
      const dependencyNumbers =
        dependenciesCell.match(EPIC_DEPENDENCY_NUMBER_REGEX) || [];
      const dependsOn = dependencyNumbers.map(
        (value) => `epic-${Number(value)}`
      );
      rows.push({ id, number: epicNumber, label, dependsOn });
      seen.add(id);
      continue;
    }

    // Fallback: heading format ## Epic N: Name
    const headingRow = trimmed.match(EPICS_EPIC_HEADING_WITH_NAME_REGEX);
    if (headingRow) {
      const epicNumber = Number(headingRow[1]);
      if (!Number.isFinite(epicNumber)) {
        continue;
      }
      const id = `epic-${epicNumber}`;
      if (seen.has(id)) {
        continue;
      }
      const label = headingRow[2].trim();
      rows.push({ id, number: epicNumber, label, dependsOn: [] });
      seen.add(id);
    }
  }

  return rows.sort((a, b) => a.number - b.number);
}

function summarizeEpicConsistency(
  parsedEpicRows: ParsedEpicMarkdownRow[],
  sprintOverview: SprintOverview
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

function buildDependencyTree(
  parsedEpicRows: ParsedEpicMarkdownRow[],
  sprintOverview: SprintOverview
): DependencyTreeNode[] {
  const sprintEpicMap = new Map(
    sprintOverview.epics.map((epic) => [
      epic.id,
      { status: epic.status, storyCount: epic.storyCount },
    ])
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

/**
 * Load story-level dependencies from the YAML file.
 * Returns Record<storyId, string[]> for all stories with explicit dependencies.
 */
function loadStoryDependencies(): Record<string, string[]> {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnsi(value: string): string {
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

function extractGeneratedSummary(logContent: string): string | null {
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

async function getCompletedSessionSummary(
  sessions: RuntimeSession[],
  storyId: string,
  skill: StoryWorkflowStepSkill
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

function fallbackSummary(
  skill: StoryWorkflowStepSkill,
  state: WorkflowStepState,
  markdownPath: string | null
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

function findStoryMarkdown(
  storyId: string
): Promise<{ path: string; content: string } | null> {
  const root = path.join(artifactsRoot, "implementation-artifacts");

  async function walk(
    dirPath: string
  ): Promise<{ path: string; content: string } | null> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const nested = await walk(absolutePath);
        if (nested) {
          return nested;
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!entry.name.endsWith(".md")) {
        continue;
      }

      if (!entry.name.startsWith(storyId)) {
        continue;
      }

      const content = await readFile(absolutePath, "utf8");
      return {
        path: path.relative(projectRoot, absolutePath),
        content,
      };
    }

    return null;
  }

  if (!existsSync(root)) {
    return Promise.resolve(null);
  }

  return walk(root);
}

async function readOptionalTextFile(
  filePath: string | null
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

type TokenUsageData = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  totalTokens: number;
};

type SessionAnalyticsData = {
  sessionId: string;
  storyId: string | null;
  epicId: string | null;
  skill: string;
  model: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  usage: TokenUsageData;
};

type AnalyticsRatesUsdData = {
  premiumRequest: number | null;
  inputPer1MTokens: number | null;
  outputPer1MTokens: number | null;
  cachedInputPer1MTokens: number | null;
};

type AnalyticsEstimatedCostUsdData = {
  seatCostPerUserPerMonth: number | null;
  fromPremiumRequests: number | null;
  fromTokens: number | null;
  totalWithKnownRates: number | null;
};

type AnalyticsCostingData = {
  version: number;
  copilotBilling: {
    primaryUnit: string;
    notes: string;
    source: string;
  };
  subscription: {
    plan: string;
    seatUsdPerUserPerMonth: number;
    seatPriceSource: string;
  } | null;
  totals: {
    premiumRequests: number;
    tokensIn: number;
    tokensOut: number;
    tokensCached: number;
    totalTokens: number;
  };
  ratesUsd: AnalyticsRatesUsdData;
  estimatedCostUsd: AnalyticsEstimatedCostUsdData;
};

function zeroUsage(): TokenUsageData {
  return {
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensCached: 0,
    totalTokens: 0,
  };
}

function addUsage(a: TokenUsageData, b: TokenUsageData): TokenUsageData {
  return {
    requests: a.requests + b.requests,
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    tokensCached: a.tokensCached + b.tokensCached,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeAnalyticsCosting(
  rawCosting: unknown,
  projectUsage: TokenUsageData
): AnalyticsCostingData {
  const fallbackRates: AnalyticsRatesUsdData = {
    premiumRequest: null,
    inputPer1MTokens: null,
    outputPer1MTokens: null,
    cachedInputPer1MTokens: null,
  };

  const raw =
    rawCosting && typeof rawCosting === "object"
      ? (rawCosting as Record<string, unknown>)
      : {};

  const rawRates =
    raw.ratesUsd && typeof raw.ratesUsd === "object"
      ? (raw.ratesUsd as Record<string, unknown>)
      : {};

  const rates: AnalyticsRatesUsdData = {
    premiumRequest: toNullableNumber(rawRates.premiumRequest),
    inputPer1MTokens: toNullableNumber(rawRates.inputPer1MTokens),
    outputPer1MTokens: toNullableNumber(rawRates.outputPer1MTokens),
    cachedInputPer1MTokens: toNullableNumber(rawRates.cachedInputPer1MTokens),
  };

  const rawSubscription =
    raw.subscription && typeof raw.subscription === "object"
      ? (raw.subscription as Record<string, unknown>)
      : null;

  const subscription = rawSubscription
    ? {
        plan:
          typeof rawSubscription.plan === "string"
            ? rawSubscription.plan
            : "copilot_enterprise_standard",
        seatUsdPerUserPerMonth:
          toNullableNumber(rawSubscription.seatUsdPerUserPerMonth) ?? 39,
        seatPriceSource:
          typeof rawSubscription.seatPriceSource === "string"
            ? rawSubscription.seatPriceSource
            : "https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/choosing-your-enterprises-plan-for-github-copilot",
      }
    : {
        plan: "copilot_enterprise_standard",
        seatUsdPerUserPerMonth: 39,
        seatPriceSource:
          "https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/choosing-your-enterprises-plan-for-github-copilot",
      };

  const fromPremiumRequests =
    rates.premiumRequest === null
      ? null
      : Number((projectUsage.requests * rates.premiumRequest).toFixed(4));

  const billableInput = Math.max(
    projectUsage.tokensIn - projectUsage.tokensCached,
    0
  );
  const canEstimateTokens =
    rates.inputPer1MTokens !== null &&
    rates.outputPer1MTokens !== null &&
    rates.cachedInputPer1MTokens !== null;
  const inputRate = rates.inputPer1MTokens ?? 0;
  const outputRate = rates.outputPer1MTokens ?? 0;
  const cachedInputRate = rates.cachedInputPer1MTokens ?? 0;
  const fromTokens = canEstimateTokens
    ? Number(
        (
          (billableInput / 1_000_000) * inputRate +
          (projectUsage.tokensOut / 1_000_000) * outputRate +
          (projectUsage.tokensCached / 1_000_000) * cachedInputRate
        ).toFixed(4)
      )
    : null;

  const seatCostPerUserPerMonth =
    toNullableNumber(
      raw.estimatedCostUsd &&
        typeof raw.estimatedCostUsd === "object" &&
        (raw.estimatedCostUsd as Record<string, unknown>)
          .seatCostPerUserPerMonth
    ) ?? subscription.seatUsdPerUserPerMonth;

  const usageEstimate = fromPremiumRequests ?? fromTokens;

  return {
    version: toNullableNumber(raw.version) ?? 1,
    copilotBilling: {
      primaryUnit:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).primaryUnit ===
          "string"
          ? ((raw.copilotBilling as Record<string, unknown>)
              .primaryUnit as string)
          : "premium_requests",
      notes:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).notes ===
          "string"
          ? ((raw.copilotBilling as Record<string, unknown>).notes as string)
          : "GitHub Copilot subscriptions are primarily billed via premium requests. Token counters are retained for analytics and optional estimation.",
      source:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).source ===
          "string"
          ? ((raw.copilotBilling as Record<string, unknown>).source as string)
          : "https://docs.github.com/en/copilot/concepts/copilot-billing/requests-in-github-copilot",
    },
    subscription,
    totals: {
      premiumRequests: projectUsage.requests,
      tokensIn: projectUsage.tokensIn,
      tokensOut: projectUsage.tokensOut,
      tokensCached: projectUsage.tokensCached,
      totalTokens: projectUsage.totalTokens,
    },
    ratesUsd: rates || fallbackRates,
    estimatedCostUsd: {
      seatCostPerUserPerMonth,
      fromPremiumRequests,
      fromTokens,
      totalWithKnownRates:
        usageEstimate === null
          ? seatCostPerUserPerMonth
          : Number((seatCostPerUserPerMonth + usageEstimate).toFixed(4)),
    },
  };
}

function parseTokenCount(value: string, unit: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  const u = unit.toLowerCase();
  if (u === "k") {
    return Math.round(n * 1000);
  }
  if (u === "m") {
    return Math.round(n * 1_000_000);
  }
  if (u === "b") {
    return Math.round(n * 1_000_000_000);
  }
  return Math.round(n);
}

function parseTokenUsageFromLog(rawLogContent: string): TokenUsageData {
  const clean = stripAnsi(rawLogContent).replace(/\r/g, "");

  const reqMatch = clean.match(ANALYTICS_REQUESTS_LINE_REGEX);
  const parsedRequests = reqMatch ? Number.parseFloat(reqMatch[1]) : 0;
  const requests = Number.isFinite(parsedRequests) ? parsedRequests : 0;

  const tokMatch = clean.match(ANALYTICS_TOKENS_LINE_REGEX);
  if (!tokMatch) {
    return {
      requests,
      tokensIn: 0,
      tokensOut: 0,
      tokensCached: 0,
      totalTokens: 0,
    };
  }

  const tokensIn = parseTokenCount(tokMatch[1], tokMatch[2]);
  const tokensOut = parseTokenCount(tokMatch[3], tokMatch[4]);
  const tokensCached = parseTokenCount(tokMatch[5], tokMatch[6]);
  const totalTokens = tokensIn + tokensOut;

  return { requests, tokensIn, tokensOut, tokensCached, totalTokens };
}

function getEpicIdFromStoryId(storyId: string | null): string | null {
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

function inferSkillFromLogFilename(filename: string): string {
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

function inferStoryIdFromLogFilename(
  filename: string,
  sprintStoryIds: string[]
): string | null {
  const epicMatch = filename.match(ANALYTICS_EPIC_SESSION_REGEX);
  if (epicMatch) {
    return `epic-${epicMatch[1]}`;
  }

  const oldMatch = filename.match(ANALYTICS_OLD_STYLE_SESSION_REGEX);
  if (oldMatch) {
    const prefix = `${oldMatch[1]}-${oldMatch[2]}`;
    const full = sprintStoryIds.find((id) => id.startsWith(`${prefix}-`));
    return full || prefix;
  }

  return null;
}

async function parseRuntimeStateRobust(): Promise<RuntimeState | null> {
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

// ── Analytics Store ────────────────────────────────────────────────────────
// Persists extracted token usage per session to analytics.json so full logs
// can be deleted without losing analytics data.

type AnalyticsStore = {
  sessions: Record<string, SessionAnalyticsData>;
  costing?: AnalyticsCostingData;
};

async function readAnalyticsStore(): Promise<AnalyticsStore> {
  const candidatePath =
    [analyticsStorePath, ...legacyAnalyticsStorePaths].find((p) => existsSync(p)) ||
    null;
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
        agentEntry.session_id || (entry as Record<string, string>).sessionId || key;
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

async function persistAnalyticsStore(store: AnalyticsStore): Promise<void> {
  await mkdir(path.dirname(analyticsStorePath), { recursive: true });
  await writeFile(
    analyticsStorePath,
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8"
  );
}

async function persistSessionAnalytics(session: RuntimeSession): Promise<void> {
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
    const store = await readAnalyticsStore();
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
    };
    await persistAnalyticsStore(store);
  } catch {
    // ignore — analytics persistence is best-effort
  }
}

async function backfillAnalyticsStore(): Promise<void> {
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
    allSessions.map((s) => s.logPath).filter(Boolean)
  );

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
    if (knownLogPaths.has(logPath) && existing?.usage.requests && existing.usage.requests > 0) {
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
      const storyId = inferStoryIdFromLogFilename(sessionId, sprintStoryIds);
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

async function buildAnalyticsPayload() {
  // Backfill any sessions/logs not yet in the store (idempotent)
  await backfillAnalyticsStore();

  const store = await readAnalyticsStore();
  const sessionAnalytics = Object.values(store.sessions).sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
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
    zeroUsage()
  );

  const costing = normalizeAnalyticsCosting(store.costing, projectUsage);

  return {
    sessions: sessionAnalytics,
    stories: storyAnalytics,
    epics: epicAnalytics,
    project: projectUsage,
    costing,
  };
}

function attachApi(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    const requestPromise = (async () => {
      if (!req.url?.startsWith("/api/")) {
        next();
        return;
      }

      const requestUrl = new URL(req.url, "http://localhost");

      if (requestUrl.pathname === "/api/overview" && req.method === "GET") {
        try {
          const payload = await buildOverviewPayload();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error) }));
        }
        return;
      }

      if (
        requestUrl.pathname === "/api/events/overview" &&
        req.method === "GET"
      ) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });

        let lastPayload = "";

        const push = async () => {
          try {
            const payload = await buildOverviewPayload();
            const nextPayload = JSON.stringify(payload);
            if (nextPayload !== lastPayload) {
              lastPayload = nextPayload;
              res.write(`data: ${nextPayload}\n\n`);
            }
          } catch (error) {
            res.write(
              `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`
            );
          }
        };

        await push();
        const interval = setInterval(push, 1000);

        req.on("close", () => {
          clearInterval(interval);
        });

        return;
      }

      const sessionDetailMatch = requestUrl.pathname.match(
        SESSION_DETAIL_PATH_REGEX
      );
      if (sessionDetailMatch && req.method === "GET") {
        try {
          const sessionId = decodeURIComponent(sessionDetailMatch[1]);
          const payload = await buildSessionDetailPayload(sessionId);
          if (!payload) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: `session not found: ${sessionId}` })
            );
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        } catch (sessionError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(sessionError) }));
        }
        return;
      }

      const sessionEventsMatch = requestUrl.pathname.match(
        SESSION_EVENTS_PATH_REGEX
      );
      if (sessionEventsMatch && req.method === "GET") {
        const sessionId = decodeURIComponent(sessionEventsMatch[1]);

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });

        let lastPayload = "";

        const push = async () => {
          try {
            const payload = await buildSessionDetailPayload(sessionId);
            if (!payload) {
              res.write(
                `event: missing\ndata: ${JSON.stringify({ error: `session not found: ${sessionId}` })}\n\n`
              );
              return;
            }

            const nextPayload = JSON.stringify(payload);
            if (nextPayload !== lastPayload) {
              lastPayload = nextPayload;
              res.write(`data: ${nextPayload}\n\n`);
            }
          } catch (error) {
            res.write(
              `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`
            );
          }
        };

        await push();
        const interval = setInterval(push, 1000);

        req.on("close", () => {
          clearInterval(interval);
        });

        return;
      }

      const sessionInputMatch = requestUrl.pathname.match(
        SESSION_INPUT_PATH_REGEX
      );
      if (sessionInputMatch && req.method === "POST") {
        try {
          const sessionId = decodeURIComponent(sessionInputMatch[1]);
          const body = await parseJsonBody<{ message?: string }>(req);
          const message = body.message?.trim() || "";

          if (!message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "message is required" }));
            return;
          }

          const runtimeState = await loadOrCreateRuntimeState();
          const session = runtimeState.sessions.find(
            (candidate) => candidate.id === sessionId
          );

          if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: `session not found: ${sessionId}` })
            );
            return;
          }

          const processForSession = runningSessionProcesses.get(sessionId);
          if (!processForSession?.stdin || processForSession.stdin.destroyed) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "session is not accepting input" })
            );
            return;
          }

          const userMessage = {
            id: `msg-${Date.now()}`,
            text: message,
            sentAt: new Date().toISOString(),
          };

          session.userMessages = session.userMessages || [];
          session.userMessages.push(userMessage);
          await persistRuntimeState(runtimeState);

          await writeFile(session.logPath, `\n[user] ${message}\n`, {
            encoding: "utf8",
            flag: "a",
          });

          processForSession.stdin.write(`${message}\n`);

          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "sent", message: userMessage }));
        } catch (sessionInputError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(sessionInputError) }));
        }

        return;
      }

      const sessionStartMatch = requestUrl.pathname.match(
        SESSION_START_PATH_REGEX
      );
      if (sessionStartMatch && req.method === "POST") {
        try {
          ensureRunningProcessStateIsFresh();

          if (runningProcess) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "another orchestrator task is running" })
            );
            return;
          }

          const sessionId = decodeURIComponent(sessionStartMatch[1]);
          const runtimeState = await loadOrCreateRuntimeState();
          const session = runtimeState.sessions.find(
            (candidate) => candidate.id === sessionId
          );

          if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: `session not found: ${sessionId}` })
            );
            return;
          }

          if (session.status !== "planned") {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: `session cannot be started from status ${session.status}`,
              })
            );
            return;
          }

          try {
            await startRuntimeSession(runtimeState, session);
          } catch (startError) {
            session.status = "failed";
            session.error = `Failed to start session: ${String(startError)}`;
            session.endedAt = new Date().toISOString();
            await persistRuntimeState(runtimeState);
            await persistSessionAnalytics(session);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: session.error }));
            return;
          }

          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "started", sessionId }));
        } catch (sessionStartError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(sessionStartError) }));
        }

        return;
      }

      const sessionAbortMatch = requestUrl.pathname.match(
        SESSION_ABORT_PATH_REGEX
      );
      if (sessionAbortMatch && req.method === "POST") {
        try {
          const sessionId = decodeURIComponent(sessionAbortMatch[1]);
          const runtimeState = await loadOrCreateRuntimeState();
          const session = runtimeState.sessions.find(
            (candidate) => candidate.id === sessionId
          );

          if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: `session not found: ${sessionId}` })
            );
            return;
          }

          const processForSession = runningSessionProcesses.get(sessionId);
          if (processForSession) {
            runningSessionProcesses.delete(sessionId);
            if (runningProcess === processForSession) {
              resetRunningProcessState();
            }
            processForSession.kill();
          }

          session.status = "cancelled";
          session.error = "Cancelled by user";
          session.endedAt = new Date().toISOString();
          session.exitCode = session.exitCode ?? -1;
          await persistRuntimeState(runtimeState);
          await persistSessionAnalytics(session);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "aborted", sessionId }));
        } catch (sessionAbortError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(sessionAbortError) }));
        }

        return;
      }

      if (
        requestUrl.pathname === "/api/orchestrator/run" &&
        req.method === "POST"
      ) {
        ensureRunningProcessStateIsFresh();

        if (runningProcess) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "orchestrator already running" }));
          return;
        }

        const commandArgs = ["bmad:orchestrate", "--"];

        runningProcess = spawn("pnpm", commandArgs, {
          cwd: projectRoot,
          shell: true,
          env: process.env,
          stdio: ["pipe", "ignore", "ignore"],
        });
        runningProcessCanAcceptInput = false;
        runningProcessKind = "orchestrator";

        runningProcess.on("close", () => {
          runningProcess = null;
          runningProcessCanAcceptInput = false;
          runningProcessKind = null;
        });

        runningProcess.on("error", () => {
          runningProcess = null;
          runningProcessCanAcceptInput = false;
          runningProcessKind = null;
        });

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "planned" }));
        return;
      }

      if (
        ORCHESTRATOR_INPUT_PATH_REGEX.test(requestUrl.pathname) &&
        req.method === "POST"
      ) {
        try {
          ensureRunningProcessStateIsFresh();
          const body = await parseJsonBody<{ message?: string }>(req);
          const message = body.message?.trim() || "";

          if (!message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "message is required" }));
            return;
          }

          if (
            runningProcessKind !== "orchestrator" ||
            !runningProcessCanAcceptInput ||
            !runningProcess?.stdin ||
            runningProcess.stdin.destroyed
          ) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "orchestrator is not accepting input" })
            );
            return;
          }

          runningProcess.stdin.write(`${message}\n`);
          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "sent" }));
        } catch (orchestratorInputError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(orchestratorInputError) }));
        }

        return;
      }

      if (
        requestUrl.pathname === "/api/orchestrator/run-stage" &&
        req.method === "POST"
      ) {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          const rawBody = Buffer.concat(chunks).toString("utf8");
          const parsed =
            rawBody.length > 0
              ? (JSON.parse(rawBody) as {
                  stage?: string;
                  epicId?: string;
                  epicNumber?: number;
                })
              : {};

          const stage =
            parsed.stage === "planning" || parsed.stage === "retrospective"
              ? parsed.stage
              : null;
          if (!stage) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid stage" }));
            return;
          }

          const skillName =
            stage === "planning" ? "gds-sprint-planning" : "gds-retrospective";
          const model = DEFAULT_STAGE_MODELS[stage];
          const epicLabel =
            parsed.epicId ||
            (Number.isFinite(parsed.epicNumber)
              ? `epic-${parsed.epicNumber}`
              : "unknown-epic");

          await mkdir(runtimeLogsDir, { recursive: true });

          const timestamp = Date.now();
          const sessionId = `${stage}-${timestamp}`;
          const promptPath = path.join(
            runtimeLogsDir,
            `${sessionId}.prompt.txt`
          );
          const logPath = path.join(runtimeLogsDir, `${sessionId}.log`);

          const prompt = [
            `/${skillName} ${epicLabel}`,
            "Follow GDS strictly.",
            "Start this in a brand new agent session.",
            "This run is non-interactive: never wait for user input.",
            "If a workflow asks for approval/checkpoint, assume approval and continue automatically.",
            "Do not end your output with a question for the user.",
            "Run only the requested skill in this session.",
            `Skill: ${skillName}`,
            `Model: ${model}`,
            `Epic: ${epicLabel}`,
          ].join("\n");

          await writeFile(promptPath, `${prompt}\n`, "utf8");
          await writeFile(logPath, "", "utf8");

          const command = buildAgentCommand(model, promptPath);
          const runtimeState = await loadOrCreateRuntimeState();
          const session = createRuntimeSession({
            id: sessionId,
            skill: skillName,
            model,
            storyId: epicLabel,
            command,
            promptPath,
            logPath,
          });

          runtimeState.status = "running";
          runtimeState.currentStage = skillName;
          runtimeState.sessions.push(session);
          await persistRuntimeState(runtimeState);

          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "queued",
              stage,
              skillName,
              sessionId,
            })
          );
        } catch (stageRunError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(stageRunError) }));
        }

        return;
      }

      if (
        requestUrl.pathname === "/api/orchestrator/stop" &&
        req.method === "POST"
      ) {
        ensureRunningProcessStateIsFresh();

        if (!runningProcess) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "idle" }));
          return;
        }

        runningProcess.kill();
        runningProcess = null;
        runningProcessCanAcceptInput = false;
        runningProcessKind = null;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "stopped" }));
        return;
      }

      const markReviewMatch = requestUrl.pathname.match(MARK_REVIEW_PATH_REGEX);
      if (markReviewMatch && req.method === "POST") {
        const storyId = decodeURIComponent(markReviewMatch[1]);

        if (!existsSync(sprintStatusFile)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "sprint status file not found" }));
          return;
        }

        const sprintContent = await readFile(sprintStatusFile, "utf8");
        const linePattern = new RegExp(
          `^(${escapeRegExp(storyId)}:\\s*)(backlog|ready-for-dev|in-progress|review|done)$`,
          "m"
        );

        if (!linePattern.test(sprintContent)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "story not found in sprint status" })
          );
          return;
        }

        let nextContent = sprintContent.replace(linePattern, "$1review");
        const today = new Date().toISOString().slice(0, 10);
        nextContent = nextContent.replace(
          LAST_UPDATED_COMMENT_REGEX,
          `# last_updated: ${today}`
        );
        await writeFile(sprintStatusFile, nextContent, "utf8");

        const orchestratorStarted = false;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "updated", storyId, orchestratorStarted })
        );
        return;
      }

      const storyDetailMatch = requestUrl.pathname.match(
        STORY_DETAIL_PATH_REGEX
      );
      if (storyDetailMatch && req.method === "GET") {
        const storyId = decodeURIComponent(storyDetailMatch[1]);
        const runtimeState = existsSync(runtimeStatePath)
          ? (JSON.parse(
              await readFile(runtimeStatePath, "utf8")
            ) as RuntimeState)
          : null;

        const overview = await loadSprintOverview(runtimeState);
        const story = overview.stories.find((item) => item.id === storyId);

        if (!story) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "story not found" }));
          return;
        }

        const markdown = await findStoryMarkdown(storyId);
        const sessions = (runtimeState?.sessions || [])
          .filter((session) => session.storyId === storyId)
          .filter((session) => session.status !== "planned")
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
        const externalProcesses = await getExternalCliProcesses();

        const payload = {
          story: {
            id: story.id,
            status: story.status,
            markdownPath: markdown?.path || null,
            markdownContent: markdown?.content || null,
          },
          steps: await Promise.all(
            STORY_WORKFLOW_STEPS.map(async (step) => {
              const state = deriveStoryStepStateFromStatus(
                story.status,
                step.skill
              );
              const generatedSummary = await getCompletedSessionSummary(
                runtimeState?.sessions || [],
                story.id,
                step.skill
              );

              return {
                skill: step.skill,
                label: step.label,
                state,
                summary:
                  generatedSummary ||
                  fallbackSummary(step.skill, state, markdown?.path || null),
              };
            })
          ),
          sessions,
          externalProcesses,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }

      const epicDetailMatch = requestUrl.pathname.match(EPIC_DETAIL_PATH_REGEX);
      if (epicDetailMatch && req.method === "GET") {
        const epicNumber = Number(epicDetailMatch[1]);
        if (!Number.isFinite(epicNumber)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid epic id" }));
          return;
        }

        const runtimeState = existsSync(runtimeStatePath)
          ? (JSON.parse(
              await readFile(runtimeStatePath, "utf8")
            ) as RuntimeState)
          : null;

        const overview = await loadSprintOverview(runtimeState);
        const epic = overview.epics.find((item) => item.number === epicNumber);

        if (!epic) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "epic not found" }));
          return;
        }

        const stories = overview.stories
          .filter((story) => Number(story.id.split("-")[0]) === epicNumber)
          .sort((a, b) => (a.id > b.id ? 1 : -1));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            epic: {
              id: epic.id,
              number: epic.number,
              status: epic.status,
            },
            stories,
          })
        );
        return;
      }

      if (requestUrl.pathname === "/api/analytics" && req.method === "GET") {
        try {
          const payload = await buildAnalyticsPayload();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
        } catch (analyticsError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(analyticsError) }));
        }
        return;
      }

      if (
        requestUrl.pathname === "/api/artifacts/files" &&
        req.method === "GET"
      ) {
        const dir = requestUrl.searchParams.get("dir") ?? "planning";
        const dirPath = path.join(
          artifactsRoot,
          dir === "implementation"
            ? "implementation-artifacts"
            : "planning-artifacts"
        );
        try {
          const files = existsSync(dirPath)
            ? (await readdir(dirPath)).filter((f) => !f.startsWith("."))
            : [];
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(files));
        } catch (filesError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(filesError) }));
        }
        return;
      }

      if (
        requestUrl.pathname === "/api/workflow/run-skill" &&
        req.method === "POST"
      ) {
        try {
          ensureRunningProcessStateIsFresh();

          if (runningProcess) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "another orchestrator task is running" })
            );
            return;
          }

          const body = await parseJsonBody<{
            skill?: string;
            storyId?: string;
          }>(req);
          const skill = body.skill?.trim();
          const storyId = body.storyId?.trim() || null;
          if (!skill) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "skill is required" }));
            return;
          }

          const isValidSkill = /^[a-z0-9-]+$/.test(skill);
          if (!isValidSkill) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid skill" }));
            return;
          }

          await mkdir(runtimeLogsDir, { recursive: true });

          const timestamp = Date.now();
          const sessionId = `workflow-${skill}-${timestamp}`;
          const promptPath = path.join(runtimeLogsDir, `${sessionId}.prompt.txt`);
          const logPath = path.join(runtimeLogsDir, `${sessionId}.log`);

          const prompt = [
            storyId ? `/${skill} ${storyId}` : `/${skill}`,
            `Model: ${DEFAULT_WORKFLOW_MODEL}`,
            ...(storyId ? [`Story: ${storyId}`] : []),
          ].join("\n");

          await writeFile(promptPath, `${prompt}\n`, "utf8");
          await writeFile(logPath, "", "utf8");

          const command = buildAgentCommand(DEFAULT_WORKFLOW_MODEL, promptPath);
          const runtimeState = await loadOrCreateRuntimeState();
          const session = createRuntimeSession({
            id: sessionId,
            skill,
            model: DEFAULT_WORKFLOW_MODEL,
            storyId,
            command,
            promptPath,
            logPath,
          });

          runtimeState.status = "running";
          runtimeState.currentStage = skill;
          runtimeState.sessions.push(session);

          await startRuntimeSession(runtimeState, session);
          activeWorkflowSkill = skill;

          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "started", sessionId }));
        } catch (runSkillError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(runSkillError) }));
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    })();

    requestPromise.catch((error) => {
      if (res.headersSent) {
        return;
      }

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
    });
  });
}


export { attachApi };
