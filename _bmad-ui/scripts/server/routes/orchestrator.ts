import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  DEFAULT_STAGE_MODELS,
  getEpicIdFromStoryId,
  upsertAnalyticsSession,
  zeroUsage,
} from "../analytics/index.js";
import {
  buildAgentCommand,
  createRuntimeSession,
  ensureRunningProcessStateIsFresh,
  incrementSessionIdCounter,
  runningProcess,
  runningProcessCanAcceptInput,
  runningProcessKind,
  setRunningProcess,
  setRunningProcessCanAcceptInput,
  setRunningProcessKind,
} from "../runtime/index.js";
import { agentsDir, projectRoot } from "../paths.js";
import { parseJsonBody } from "./utils.js";

const ORCHESTRATOR_INPUT_PATH_REGEX = /^\/api\/orchestrator\/input$/;

const runtimeLogsDir = path.join(agentsDir, "logs");

const orchestratorInputSchema = z.object({ message: z.string().optional() });
const orchestratorRunSchema = z.object({
  skill: z.string().optional(),
  storyId: z.string().optional(),
  epicId: z.string().optional(),
  prompt: z.string().optional(),
  autoResolve: z.boolean().optional(),
  stage: z.string().optional(),
  epicNumber: z.number().optional(),
});

export async function handleOrchestratorRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname === "/api/orchestrator/run" && req.method === "POST") {
    ensureRunningProcessStateIsFresh();

    if (runningProcess) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "orchestrator already running" }));
      return true;
    }

    const orchestratorProcess = spawn("pnpm", ["bmad:orchestrate", "--"], {
      cwd: projectRoot,
      shell: true,
      env: process.env,
      stdio: ["pipe", "ignore", "ignore"],
    });
    setRunningProcess(orchestratorProcess);
    setRunningProcessCanAcceptInput(false);
    setRunningProcessKind("orchestrator");

    orchestratorProcess.on("close", () => {
      setRunningProcess(null);
      setRunningProcessCanAcceptInput(false);
      setRunningProcessKind(null);
    });

    orchestratorProcess.on("error", () => {
      setRunningProcess(null);
      setRunningProcessCanAcceptInput(false);
      setRunningProcessKind(null);
    });

    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "planned" }));
    return true;
  }

  if (ORCHESTRATOR_INPUT_PATH_REGEX.test(requestUrl.pathname) && req.method === "POST") {
    try {
      ensureRunningProcessStateIsFresh();
      const rawBody = await parseJsonBody<unknown>(req);
      const body = orchestratorInputSchema.parse(rawBody);
      const message = body.message?.trim() || "";

      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "message is required" }));
        return true;
      }

      if (
        runningProcessKind !== "orchestrator" ||
        !runningProcessCanAcceptInput ||
        !runningProcess?.stdin ||
        runningProcess.stdin.destroyed
      ) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "orchestrator is not accepting input" }));
        return true;
      }

      runningProcess.stdin.write(`${message}\n`);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "sent" }));
    } catch (orchestratorInputError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(orchestratorInputError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/orchestrator/run-stage" && req.method === "POST") {
    try {
      const rawBody = await parseJsonBody<unknown>(req);
      const parsed = orchestratorRunSchema.parse(rawBody);

      const stage =
        parsed.stage === "planning" || parsed.stage === "retrospective"
          ? parsed.stage
          : null;
      if (!stage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid stage" }));
        return true;
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
      const sessionId = `${stage}-${timestamp}-${incrementSessionIdCounter()}`;
      const promptPath = path.join(runtimeLogsDir, `${sessionId}.prompt.txt`);
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
      const session = createRuntimeSession({
        id: sessionId,
        skill: skillName,
        model,
        storyId: epicLabel,
        command,
        promptPath,
        logPath,
      });

      await upsertAnalyticsSession({
        sessionId: session.id,
        storyId: session.storyId,
        epicId: getEpicIdFromStoryId(session.storyId),
        skill: session.skill,
        model: session.model,
        status: "planned",
        startedAt: session.startedAt,
        endedAt: null,
        usage: zeroUsage(),
        logPath: session.logPath,
        promptPath: session.promptPath,
        command: session.command,
        worktreePath: session.worktreePath,
      });

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "queued", stage, skillName, sessionId }));
    } catch (stageRunError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(stageRunError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/orchestrator/stop" && req.method === "POST") {
    ensureRunningProcessStateIsFresh();

    if (!runningProcess) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "idle" }));
      return true;
    }

    runningProcess.kill();
    setRunningProcess(null);
    setRunningProcessCanAcceptInput(false);
    setRunningProcessKind(null);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "stopped" }));
    return true;
  }

  return false;
}
