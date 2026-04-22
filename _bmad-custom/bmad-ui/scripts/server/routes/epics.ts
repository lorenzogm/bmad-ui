import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  readAnalyticsStore,
} from "../analytics/index.js";
import {
  loadSprintOverview,
} from "../sprint/index.js";
import {
  epicsFile,
  getEpicMetadataFromMarkdown,
  getPlannedStoriesFromEpics,
} from "../epics/index.js";

const EPIC_DETAIL_PATH_REGEX = /^\/api\/epic\/epic-(\d+)$/;

export async function handleEpicsRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const epicDetailMatch = EPIC_DETAIL_PATH_REGEX.exec(requestUrl.pathname);
  if (epicDetailMatch && req.method === "GET") {
    const epicNumber = Number(epicDetailMatch[1]);
    if (!Number.isFinite(epicNumber)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid epic id" }));
      return true;
    }

    const epicDetailStore = await readAnalyticsStore();
    const epicDetailSessions = Object.values(epicDetailStore.sessions);

    const overview = await loadSprintOverview(epicDetailSessions);
    const epic = overview.epics.find((item) => item.number === epicNumber);

    if (!epic) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "epic not found" }));
      return true;
    }

    const stories = overview.stories
      .filter((story) => Number(story.id.split("-")[0]) === epicNumber)
      .sort((a, b) => (a.id > b.id ? 1 : -1));

    let epicMeta = { name: "", description: "" };
    let plannedStories: string[] = [];
    let parseWarning: string | null = null;
    if (existsSync(epicsFile)) {
      try {
        const epicsContent = await readFile(epicsFile, "utf8");
        epicMeta = getEpicMetadataFromMarkdown(epicsContent, epicNumber);
        plannedStories = getPlannedStoriesFromEpics(
          epicsContent,
          epicNumber,
          overview.stories,
        );
      } catch (parseErr) {
        parseWarning = `Could not read epics.md: ${String(parseErr)}`;
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        epic: {
          id: epic.id,
          number: epic.number,
          name: epicMeta.name,
          description: epicMeta.description,
          status: epic.status,
          storyCount: epic.storyCount,
          plannedStoryCount: epic.plannedStoryCount,
          storiesToCreate: epic.storiesToCreate,
          byStoryStatus: epic.byStoryStatus,
        },
        stories,
        plannedStories,
        parseWarning,
      }),
    );
    return true;
  }

  return false;
}
