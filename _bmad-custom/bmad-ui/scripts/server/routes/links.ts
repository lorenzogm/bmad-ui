import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  linksFile,
  parseSimpleYamlList,
  serializeLinksYaml,
} from "../links-notes/links.js";
import type { LinkItem } from "../links-notes/links.js";
import { readRequestBody } from "./utils.js";

const linksPostSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  url: z.string(),
  icon: z.string().optional(),
});

const linksPutSchema = z.object({
  index: z.number(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  url: z.string().optional(),
  icon: z.string().optional(),
});

const linksDeleteSchema = z.object({ index: z.number() });

export async function handleLinksRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname !== "/api/links") {
    return false;
  }

  if (req.method === "GET") {
    try {
      let links: LinkItem[] = [];
      if (existsSync(linksFile)) {
        const raw = readFileSync(linksFile, "utf8");
        const parsed = parseSimpleYamlList(raw, "links");
        links = parsed as LinkItem[];
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ links }));
    } catch (linksError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(linksError) }));
    }
    return true;
  }

  if (req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const { title, subtitle, url, icon } = linksPostSchema.parse(
        JSON.parse(rawBody),
      );
      if (!title || !url) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "title and url are required" }));
        return true;
      }
      let links: LinkItem[] = [];
      if (existsSync(linksFile)) {
        const raw = readFileSync(linksFile, "utf8");
        links = parseSimpleYamlList(raw, "links") as LinkItem[];
      }
      links.push({ title, subtitle: subtitle || "", url, icon: icon || "link" });
      await writeFile(linksFile, serializeLinksYaml(links), "utf8");
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ links }));
    } catch (addLinkError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(addLinkError) }));
    }
    return true;
  }

  if (req.method === "PUT") {
    try {
      const rawBody = await readRequestBody(req);
      const { index, title, subtitle, url, icon } = linksPutSchema.parse(
        JSON.parse(rawBody),
      );
      let links: LinkItem[] = [];
      if (existsSync(linksFile)) {
        const raw = readFileSync(linksFile, "utf8");
        links = parseSimpleYamlList(raw, "links") as LinkItem[];
      }
      if (index < 0 || index >= links.length) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid index" }));
        return true;
      }
      if (title !== undefined) links[index].title = title;
      if (subtitle !== undefined) links[index].subtitle = subtitle;
      if (url !== undefined) links[index].url = url;
      if (icon !== undefined) links[index].icon = icon;
      await writeFile(linksFile, serializeLinksYaml(links), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ links }));
    } catch (updateLinkError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(updateLinkError) }));
    }
    return true;
  }

  if (req.method === "DELETE") {
    try {
      const indexParam = requestUrl.searchParams.get("index");
      if (indexParam === null) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "index query param required" }));
        return true;
      }
      const { index } = linksDeleteSchema.parse({
        index: Number.parseInt(indexParam, 10),
      });
      let links: LinkItem[] = [];
      if (existsSync(linksFile)) {
        const raw = readFileSync(linksFile, "utf8");
        links = parseSimpleYamlList(raw, "links") as LinkItem[];
      }
      if (index < 0 || index >= links.length) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid index" }));
        return true;
      }
      links.splice(index, 1);
      await writeFile(linksFile, serializeLinksYaml(links), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ links }));
    } catch (deleteLinkError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(deleteLinkError) }));
    }
    return true;
  }

  return false;
}
