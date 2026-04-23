import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildAnalyticsPayload,
  generateQualityConfigYaml,
  readAnalyticsStore,
} from "../analytics/index.js";
import {
  buildLogFromEvents,
  findAllCliEventsJsonl,
} from "../logs/index.js";

export async function handleAnalyticsRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname === "/api/analytics" && req.method === "GET") {
    try {
      const payload = await buildAnalyticsPayload();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (analyticsError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(analyticsError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/analytics/quality-config" && req.method === "GET") {
    try {
      const payload = await buildAnalyticsPayload();
      const qualityConfig = generateQualityConfigYaml(payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(qualityConfig));
    } catch (qualityConfigError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(qualityConfigError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/sessions/regenerate-logs" && req.method === "POST") {
    try {
      const regenStore = await readAnalyticsStore();
      const sessions = Object.values(regenStore.sessions).filter((s) => s.logPath);
      let regenerated = 0;
      let skipped = 0;

      for (const session of sessions) {
        const eventsPaths = await findAllCliEventsJsonl(
          session.sessionId,
          session.userMessages || [],
        );
        if (eventsPaths.length === 0) {
          skipped += 1;
          continue;
        }

        const parts: string[] = [];
        for (const ep of eventsPaths) {
          try {
            const eventsContent = await readFile(ep, "utf8");
            const built = buildLogFromEvents(eventsContent);
            if (built.trim().length > 0) {
              parts.push(built);
            }
          } catch {
            // skip unreadable event files
          }
        }

        if (parts.length > 0 && session.logPath) {
          await mkdir(path.dirname(session.logPath), { recursive: true });
          await writeFile(session.logPath, parts.join("\n\n"), "utf8");
          regenerated += 1;
        } else {
          skipped += 1;
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ regenerated, skipped, total: sessions.length }));
    } catch (regenError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(regenError) }));
    }
    return true;
  }

  return false;
}
