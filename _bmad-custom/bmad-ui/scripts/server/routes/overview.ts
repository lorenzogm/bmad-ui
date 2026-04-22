import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeState } from "../runtime/index.js";
import {
  activeWorkflowSkill,
  ensureRunningProcessStateIsFresh,
  markZombieAnalyticsSessionsFailed,
  runningProcess,
  runningProcessCanAcceptInput,
  runningSessionProcesses,
  setActiveWorkflowSkill,
} from "../runtime/index.js";
import {
  STORY_WORKFLOW_STEPS,
  loadSprintOverview,
  summarizeEpicSteps,
} from "../sprint/index.js";
import {
  buildDependencyTree,
  epicsFile,
  loadStoryDependencies,
  parseEpicMarkdownRows,
  summarizeEpicConsistency,
} from "../epics/index.js";
import { getExternalCliProcesses } from "../logs/index.js";
import {
  analyticsToRuntimeSession,
  readAnalyticsStore,
  upsertAnalyticsSession,
} from "../analytics/index.js";
import { readAgentSessionsFile } from "../analytics/index.js";
import { artifactsRoot } from "../paths.js";

export async function buildOverviewPayload() {
  ensureRunningProcessStateIsFresh();
  const store = await readAnalyticsStore();
  const analyticsSessions = Object.values(store.sessions);
  await markZombieAnalyticsSessionsFailed(analyticsSessions, upsertAnalyticsSession);
  const sprintOverview = await loadSprintOverview(analyticsSessions);
  const externalProcesses = await getExternalCliProcesses();
  const epicsContent = existsSync(epicsFile)
    ? await readFile(epicsFile, "utf8")
    : "";
  const parsedEpicRows = parseEpicMarkdownRows(epicsContent);
  const dependencyTree = {
    nodes: buildDependencyTree(parsedEpicRows, sprintOverview),
  };
  const epicConsistency = summarizeEpicConsistency(parsedEpicRows, sprintOverview);
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

  const runningSession = analyticsSessions.find((s) => s.status === "running");
  if (runningSession) {
    setActiveWorkflowSkill(runningSession.skill);
  } else if (activeWorkflowSkill && !runningSessionProcesses.size) {
    setActiveWorkflowSkill(null);
  }

  const runtimeSessions = analyticsSessions.map(analyticsToRuntimeSession);
  const pseudoRuntimeState: RuntimeState = {
    status: "idle",
    startedAt: "",
    updatedAt: "",
    currentStage: "",
    dryRun: false,
    execute: true,
    nonInteractive: true,
    targetStory: null,
    parallelCandidate: null,
    sessions: runtimeSessions,
    notes: [],
  };

  return {
    steps: STORY_WORKFLOW_STEPS,
    epicSteps: summarizeEpicSteps(analyticsSessions),
    sprintOverview,
    runtimeState: pseudoRuntimeState,
    agentRunner: {
      isRunning: runningProcess !== null,
      canSendInput: runningProcessCanAcceptInput,
      isNonInteractive: true,
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

export async function handleOverviewRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname === "/api/overview" && req.method === "GET") {
    try {
      const payload = await buildOverviewPayload();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/events/overview" && req.method === "GET") {
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
          `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
        );
      }
    };

    await push();
    const interval = setInterval(push, 1000);
    req.on("close", () => clearInterval(interval));

    return true;
  }

  return false;
}
