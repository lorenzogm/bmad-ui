import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { notesFile } from "../links-notes/notes.js";
import type { NoteItem } from "../links-notes/notes.js";
import { readRequestBody } from "./utils.js";

export async function handleNotesRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname !== "/api/notes") {
    return false;
  }

  if (req.method === "GET") {
    try {
      let notes: NoteItem[] = [];
      if (existsSync(notesFile)) {
        const raw = readFileSync(notesFile, "utf8");
        const parsed = JSON.parse(raw) as { notes: NoteItem[] };
        notes = parsed.notes ?? [];
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ notes }));
    } catch (notesError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(notesError) }));
    }
    return true;
  }

  if (req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const { text, color } = JSON.parse(rawBody) as {
        text: string;
        color?: string;
      };
      if (!text) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "text is required" }));
        return true;
      }
      let notes: NoteItem[] = [];
      if (existsSync(notesFile)) {
        const raw = readFileSync(notesFile, "utf8");
        const parsed = JSON.parse(raw) as { notes: NoteItem[] };
        notes = parsed.notes ?? [];
      }
      const id = `note-${Date.now()}`;
      notes.push({ id, text, color: color || "teal", createdAt: new Date().toISOString() });
      await writeFile(notesFile, JSON.stringify({ notes }, null, 2), "utf8");
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ notes }));
    } catch (addNoteError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(addNoteError) }));
    }
    return true;
  }

  if (req.method === "PUT") {
    try {
      const rawBody = await readRequestBody(req);
      const { id, text, color } = JSON.parse(rawBody) as {
        id: string;
        text?: string;
        color?: string;
      };
      if (!id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "id is required" }));
        return true;
      }
      let notes: NoteItem[] = [];
      if (existsSync(notesFile)) {
        const raw = readFileSync(notesFile, "utf8");
        const parsed = JSON.parse(raw) as { notes: NoteItem[] };
        notes = parsed.notes ?? [];
      }
      const idx = notes.findIndex((n) => n.id === id);
      if (idx === -1) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "note not found" }));
        return true;
      }
      if (text !== undefined) notes[idx].text = text;
      if (color !== undefined) notes[idx].color = color;
      await writeFile(notesFile, JSON.stringify({ notes }, null, 2), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ notes }));
    } catch (updateNoteError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(updateNoteError) }));
    }
    return true;
  }

  if (req.method === "DELETE") {
    try {
      const noteId = requestUrl.searchParams.get("id");
      if (!noteId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "id query param required" }));
        return true;
      }
      let notes: NoteItem[] = [];
      if (existsSync(notesFile)) {
        const raw = readFileSync(notesFile, "utf8");
        const parsed = JSON.parse(raw) as { notes: NoteItem[] };
        notes = parsed.notes ?? [];
      }
      notes = notes.filter((n) => n.id !== noteId);
      await writeFile(notesFile, JSON.stringify({ notes }, null, 2), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ notes }));
    } catch (deleteNoteError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(deleteNoteError) }));
    }
    return true;
  }

  return false;
}
