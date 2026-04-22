import path from "node:path";
import { projectRoot } from "../paths.js";

export const notesFile = path.join(projectRoot, "_bmad-ui", "artifacts", "notes.json");

export type NoteItem = {
  id: string;
  text: string;
  color: string;
  createdAt: string;
};
