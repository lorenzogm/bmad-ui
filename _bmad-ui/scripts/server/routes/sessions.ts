import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  analyticsToRuntimeSession,
  readAnalyticsStore,
  sessionToAnalyticsUpdate,
  upsertAnalyticsSession,
  persistSessionAnalytics,
} from "../analytics/index.js";
import {
  buildAgentCommand,
  markZombieAnalyticsSessionsFailed,
  runningProcess,
  runningSessionProcesses,
  resetRunningProcessState,
  startRuntimeSession,
  ensureRunningProcessStateIsFresh,
} from "../runtime/index.js";
import {
  buildSessionDetailPayload,
  readOptionalTextFile,
} from "../logs/index.js";
import { loadStoryDependencies } from "../epics/index.js";
import { agentsDir } from "../paths.js";
import { parseJsonBody } from "./utils.js";

const SESSION_DETAIL_PATH_REGEX = /^\/api\/session\/([^/]+)$/;
const SESSION_EVENTS_PATH_REGEX = /^\/api\/events\/session\/([^/]+)$/;
const SESSION_INPUT_PATH_REGEX = /^\/api\/session\/([^/]+)\/input$/;
const SESSION_START_PATH_REGEX = /^\/api\/session\/([^/]+)\/start$/;
const SESSION_ABORT_PATH_REGEX = /^\/api\/session\/([^/]+)\/abort$/;

const runtimeLogsDir = path.join(agentsDir, "logs");

const sessionInputSchema = z.object({ message: z.string().optional() });

export async function handleSessionRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const sessionDetailMatch = SESSION_DETAIL_PATH_REGEX.exec(requestUrl.pathname);
  if (sessionDetailMatch && req.method === "GET") {
    try {
      const sessionId = decodeURIComponent(sessionDetailMatch[1]);
      const payload = await buildSessionDetailPayload(sessionId, {
        readAnalyticsStore,
        markZombiesFailed: markZombieAnalyticsSessionsFailed,
        upsertSession: upsertAnalyticsSession,
        analyticsToRuntimeSession,
      });
      if (!payload) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `session not found: ${sessionId}` }));
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (sessionError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(sessionError) }));
    }
    return true;
  }

  const sessionEventsMatch = SESSION_EVENTS_PATH_REGEX.exec(requestUrl.pathname);
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
        const payload = await buildSessionDetailPayload(sessionId, {
          readAnalyticsStore,
          markZombiesFailed: markZombieAnalyticsSessionsFailed,
          upsertSession: upsertAnalyticsSession,
          analyticsToRuntimeSession,
        });
        if (!payload) {
          res.write(
            `event: missing\ndata: ${JSON.stringify({ error: `session not found: ${sessionId}` })}\n\n`,
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
          `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
        );
      }
    };

    await push();
    const interval = setInterval(push, 1000);
    req.on("close", () => clearInterval(interval));

    return true;
  }

  const sessionInputMatch = SESSION_INPUT_PATH_REGEX.exec(requestUrl.pathname);
  if (sessionInputMatch && req.method === "POST") {
    try {
      const sessionId = decodeURIComponent(sessionInputMatch[1]);
      const rawBody = await parseJsonBody<unknown>(req);
      const body = sessionInputSchema.parse(rawBody);
      const message = body.message?.trim() || "";

      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "message is required" }));
        return true;
      }

      const inputStore = await readAnalyticsStore();
      const inputAnalyticsSession = inputStore.sessions[sessionId];

      if (!inputAnalyticsSession) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `session not found: ${sessionId}` }));
        return true;
      }

      const session = analyticsToRuntimeSession(inputAnalyticsSession);

      const processForSession = runningSessionProcesses.get(sessionId);
      if (!processForSession?.stdin || processForSession.stdin.destroyed) {
        const followUpPromptPath = (session.promptPath || "").replace(
          /\.md$/,
          `-followup-${Date.now()}.md`,
        );
        const originalPrompt = await readOptionalTextFile(session.promptPath);
        const followUpContent = [
          originalPrompt
            ? `Previous prompt context:\n${originalPrompt}\n\n---\n`
            : "",
          `Follow-up instruction:\n${message}`,
        ].join("");
        await mkdir(path.dirname(followUpPromptPath || runtimeLogsDir), {
          recursive: true,
        });
        await writeFile(followUpPromptPath, followUpContent, "utf8");

        const userMessage = {
          id: `msg-${Date.now()}`,
          text: message,
          sentAt: new Date().toISOString(),
        };
        session.userMessages = session.userMessages || [];
        session.userMessages.push(userMessage);

        session.promptPath = followUpPromptPath;
        session.command = buildAgentCommand(session.model, followUpPromptPath);
        session.status = "planned";
        session.exitCode = null;
        session.error = null;
        session.endedAt = null;
        await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));

        try {
          await startRuntimeSession(session, {
            upsertSession: upsertAnalyticsSession,
            toAnalyticsUpdate: sessionToAnalyticsUpdate,
            persistSessionAnalytics,
          });
        } catch (restartError) {
          session.status = "failed";
          session.error = `Failed to restart session: ${String(restartError)}`;
          session.endedAt = new Date().toISOString();
          await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: session.error }));
          return true;
        }

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "restarted", message: userMessage }));
        return true;
      }

      const userMessage = {
        id: `msg-${Date.now()}`,
        text: message,
        sentAt: new Date().toISOString(),
      };

      session.userMessages = session.userMessages || [];
      session.userMessages.push(userMessage);
      await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));

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
    return true;
  }

  const sessionStartMatch = SESSION_START_PATH_REGEX.exec(requestUrl.pathname);
  if (sessionStartMatch && req.method === "POST") {
    try {
      ensureRunningProcessStateIsFresh();

      const sessionId = decodeURIComponent(sessionStartMatch[1]);
      const startStore = await readAnalyticsStore();
      const startAnalyticsSession = startStore.sessions[sessionId];

      if (!startAnalyticsSession) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `session not found: ${sessionId}` }));
        return true;
      }

      const session = analyticsToRuntimeSession(startAnalyticsSession);

      if (runningSessionProcesses.size > 0) {
        const deps = loadStoryDependencies();
        const newStoryId = session.storyId ?? null;

        const runningStoryIds = new Set<string>();
        for (const [runId, runSess] of Object.entries(startStore.sessions)) {
          if (runningSessionProcesses.has(runId) && runSess.storyId) {
            runningStoryIds.add(runSess.storyId);
          }
        }

        const hasConflict =
          newStoryId !== null &&
          [...runningStoryIds].some((runningId) => {
            const newDeps = deps[newStoryId] ?? [];
            const runningDeps = deps[runningId] ?? [];
            return (
              newDeps.includes(runningId) || runningDeps.includes(newStoryId)
            );
          });

        if (hasConflict) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "another orchestrator task is running" }));
          return true;
        }
      }

      if (session.status !== "planned") {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `session cannot be started from status ${session.status}`,
          }),
        );
        return true;
      }

      try {
        await startRuntimeSession(session, {
          upsertSession: upsertAnalyticsSession,
          toAnalyticsUpdate: sessionToAnalyticsUpdate,
          persistSessionAnalytics,
        });
      } catch (worktreeError) {
        session.status = "failed";
        session.error = `Failed to start session: ${String(worktreeError)}`;
        session.endedAt = new Date().toISOString();
        await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: session.error }));
        return true;
      }

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "started", sessionId }));
    } catch (sessionStartError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(sessionStartError) }));
    }
    return true;
  }

  const sessionAbortMatch = SESSION_ABORT_PATH_REGEX.exec(requestUrl.pathname);
  if (sessionAbortMatch && req.method === "POST") {
    try {
      const sessionId = decodeURIComponent(sessionAbortMatch[1]);
      const abortStore = await readAnalyticsStore();
      const abortAnalyticsSession = abortStore.sessions[sessionId];

      if (!abortAnalyticsSession) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `session not found: ${sessionId}` }));
        return true;
      }

      const session = analyticsToRuntimeSession(abortAnalyticsSession);

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
      await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
      await persistSessionAnalytics(session);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "aborted", sessionId }));
    } catch (sessionAbortError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(sessionAbortError) }));
    }
    return true;
  }

  return false;
}
