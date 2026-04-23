import { readFileSync, readdirSync, existsSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { projectRoot } from "../paths.js"

export type DocListEntry = {
  id: string
  name: string
  path: string
  description: string
}

const DOCS_DIR = path.join(projectRoot, "docs")

const FIRST_HEADING_REGEX = /^#\s+(.+)$/m
const FIRST_PARAGRAPH_REGEX = /^(?!#|<!--|\[)([A-Za-z].{10,})/m

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function extractTitleAndDescription(
  content: string,
  filename: string,
): { name: string; description: string } {
  const headingMatch = FIRST_HEADING_REGEX.exec(content)
  const name = headingMatch
    ? headingMatch[1].trim()
    : slugToName(filename.replace(/\.md$/, ""))

  const paragraphMatch = FIRST_PARAGRAPH_REGEX.exec(
    content.slice(headingMatch ? (headingMatch.index + headingMatch[0].length) : 0),
  )
  const description = paragraphMatch ? paragraphMatch[1].trim() : ""

  return { name, description }
}

export function buildDocsListPayload(): { docs: DocListEntry[] } {
  const docs: DocListEntry[] = []

  // README.md at project root
  const readmePath = path.join(projectRoot, "README.md")
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, "utf8")
    const { name, description } = extractTitleAndDescription(content, "README.md")
    docs.push({ id: "README", name, path: "README.md", description })
  }

  // All .md files in docs/
  if (existsSync(DOCS_DIR)) {
    const files = readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()

    for (const file of files) {
      const id = file.replace(/\.md$/, "")
      const filePath = path.join(DOCS_DIR, file)
      const content = readFileSync(filePath, "utf8")
      const { name, description } = extractTitleAndDescription(content, file)
      docs.push({ id, name, path: `docs/${file}`, description })
    }
  }

  return { docs }
}

export function buildDocDetailPayload(
  docId: string,
): { doc: DocListEntry; content: string } | null {
  const { docs } = buildDocsListPayload()
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return null

  const fullPath = path.join(projectRoot, doc.path)
  if (!existsSync(fullPath)) return null

  const content = readFileSync(fullPath, "utf8")
  return { doc, content }
}

export async function handleDocsRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  // GET /api/docs — list all docs
  if (requestUrl.pathname === "/api/docs" && req.method === "GET") {
    try {
      const payload = buildDocsListPayload()
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(payload))
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: String(error) }))
    }
    return true
  }

  // GET /api/docs/:docId — single doc content
  const docDetailMatch = /^\/api\/docs\/([^/]+)$/.exec(requestUrl.pathname)
  if (docDetailMatch && req.method === "GET") {
    const docId = decodeURIComponent(docDetailMatch[1])
    try {
      const payload = buildDocDetailPayload(docId)
      if (!payload) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "document not found" }))
        return true
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(payload))
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: String(error) }))
    }
    return true
  }

  return false
}
