// biome-ignore lint/performance/noBarrelFile: attachApi coordinator — not a pure re-export barrel
import type { ViteDevServer } from "vite";
import { handleOverviewRoutes } from "./overview.js";
import { handleSessionRoutes } from "./sessions.js";
import { handleOrchestratorRoutes } from "./orchestrator.js";
import { handleStoriesRoutes } from "./stories.js";
import { handleEpicsRoutes } from "./epics.js";
import { handleAnalyticsRoutes } from "./analytics.js";
import { handleWorkflowRoutes } from "./workflow.js";
import { handleDocsRoutes } from "./docs.js";
import { handleLinksRoutes } from "./links.js";
import { handleNotesRoutes } from "./notes.js";

export function attachApi(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    const requestPromise = (async () => {
      if (!req.url?.startsWith("/api/")) {
        next();
        return;
      }

      const requestUrl = new URL(req.url, "http://localhost");

      if (await handleOverviewRoutes(requestUrl, req, res)) return;
      if (await handleSessionRoutes(requestUrl, req, res)) return;
      if (await handleOrchestratorRoutes(requestUrl, req, res)) return;
      if (await handleStoriesRoutes(requestUrl, req, res)) return;
      if (await handleEpicsRoutes(requestUrl, req, res)) return;
      if (await handleAnalyticsRoutes(requestUrl, req, res)) return;
      if (await handleWorkflowRoutes(requestUrl, req, res)) return;
      if (await handleDocsRoutes(requestUrl, req, res)) return;
      if (await handleLinksRoutes(requestUrl, req, res)) return;
      if (await handleNotesRoutes(requestUrl, req, res)) return;

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    })();

    requestPromise.catch((error) => {
      if (res.headersSent) return;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
    });
  });
}

export { buildDocDetailPayload, buildDocsListPayload } from "./docs.js";
export { buildOverviewPayload } from "./overview.js";
export { buildWorkflowStepDetailPayload } from "./workflow.js";
