import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  analyticsToRuntimeSession,
  readAnalyticsStore,
} from "../analytics/index.js";
import {
  STORY_WORKFLOW_STEPS,
  deriveStoryStepStateFromStatus,
  loadSprintOverview,
} from "../sprint/index.js";
import {
  epicsFile,
  escapeRegExp,
  getStoryContentFromEpics,
  syncEpicStatusInSprintContent,
  findStoryMarkdown,
} from "../epics/index.js";
import {
  fallbackSummary,
  getCompletedSessionSummary,
  getExternalCliProcesses,
} from "../logs/index.js";
import { sprintStatusFile } from "../paths.js";

const MARK_REVIEW_PATH_REGEX = /^\/api\/story\/([^/]+)\/mark-review$/;
const STORY_DETAIL_PATH_REGEX = /^\/api\/story\/([^/]+)$/;
const STORY_PREVIEW_PATH_REGEX = /^\/api\/story-preview\/([^/]+)$/;
const LAST_UPDATED_COMMENT_REGEX = /^#\s*last_updated:\s*.*$/m;

export async function handleStoriesRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const markReviewMatch = MARK_REVIEW_PATH_REGEX.exec(requestUrl.pathname);
  if (markReviewMatch && req.method === "POST") {
    const storyId = decodeURIComponent(markReviewMatch[1]);

    if (!existsSync(sprintStatusFile)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "sprint status file not found" }));
      return true;
    }

    const sprintContent = await readFile(sprintStatusFile, "utf8");
    const linePattern = new RegExp(
      `^(${escapeRegExp(storyId)}:\\s*)(backlog|ready-for-dev|in-progress|review|done)$`,
      "m",
    );

    if (!linePattern.test(sprintContent)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "story not found in sprint status" }));
      return true;
    }

    let nextContent = sprintContent.replace(linePattern, "$1review");
    const epicNumber = Number(storyId.split("-")[0]);
    if (Number.isFinite(epicNumber)) {
      nextContent = syncEpicStatusInSprintContent(nextContent, epicNumber);
    }
    const today = new Date().toISOString().slice(0, 10);
    nextContent = nextContent.replace(
      LAST_UPDATED_COMMENT_REGEX,
      `# last_updated: ${today}`,
    );
    await writeFile(sprintStatusFile, nextContent, "utf8");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "updated", storyId, orchestratorStarted: false }));
    return true;
  }

  const storyDetailMatch = STORY_DETAIL_PATH_REGEX.exec(requestUrl.pathname);
  if (storyDetailMatch && req.method === "GET") {
    const storyId = decodeURIComponent(storyDetailMatch[1]);
    const storyDetailStore = await readAnalyticsStore();
    const storyDetailSessions = Object.values(storyDetailStore.sessions);

    const overview = await loadSprintOverview(storyDetailSessions);
    const story = overview.stories.find((item) => item.id === storyId);

    if (!story) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "story not found" }));
      return true;
    }

    const markdown = await findStoryMarkdown(storyId);
    const sessions = storyDetailSessions
      .filter((session) => session.storyId === storyId)
      .filter((session) => session.status !== "planned")
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .map(analyticsToRuntimeSession);
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
          const state = deriveStoryStepStateFromStatus(story.status, step.skill);
          const generatedSummary = await getCompletedSessionSummary(
            storyDetailSessions,
            story.id,
            step.skill,
          );

          return {
            skill: step.skill,
            label: step.label,
            state,
            summary:
              generatedSummary ||
              fallbackSummary(step.skill, state, markdown?.path || null),
          };
        }),
      ),
      sessions,
      externalProcesses,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
    return true;
  }

  const storyPreviewMatch = STORY_PREVIEW_PATH_REGEX.exec(requestUrl.pathname);
  if (storyPreviewMatch && req.method === "GET") {
    const storyId = decodeURIComponent(storyPreviewMatch[1]);

    let planningContent: { title: string; content: string } | null = null;
    if (existsSync(epicsFile)) {
      try {
        const epicsContent = await readFile(epicsFile, "utf8");
        planningContent = getStoryContentFromEpics(epicsContent, storyId);
      } catch {
        // ignore parse errors
      }
    }

    const implMarkdown = await findStoryMarkdown(storyId);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        storyId,
        planning: planningContent
          ? { title: planningContent.title, content: planningContent.content }
          : null,
        implementation: implMarkdown
          ? { path: implMarkdown.path, content: implMarkdown.content }
          : null,
      }),
    );
    return true;
  }

  return false;
}
