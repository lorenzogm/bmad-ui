import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { projectRoot } from "../paths.js"

export type DocListEntry = {
  id: string
  name: string
  path: string
  description: string
}

export type DocTreeNode = {
  name: string
  type: "file" | "folder"
  doc?: DocListEntry
  children?: DocTreeNode[]
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
  filename: string
): { name: string; description: string } {
  const headingMatch = FIRST_HEADING_REGEX.exec(content)
  const name = headingMatch ? headingMatch[1].trim() : slugToName(filename.replace(/\.md$/, ""))

  const paragraphMatch = FIRST_PARAGRAPH_REGEX.exec(
    content.slice(headingMatch ? headingMatch.index + headingMatch[0].length : 0)
  )
  const description = paragraphMatch ? paragraphMatch[1].trim() : ""

  return { name, description }
}

function scanDocsRecursive(dir: string, relativeBase: string): DocListEntry[] {
  const entries: DocListEntry[] = []
  if (!existsSync(dir)) return entries

  const items = readdirSync(dir).sort()
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      entries.push(...scanDocsRecursive(fullPath, `${relativeBase}/${item}`))
    } else if (item.endsWith(".md")) {
      const relativePath = `${relativeBase}/${item}`
      const id = relativePath.slice(1).replace(/\.md$/, "").replaceAll("/", "--")
      const content = readFileSync(fullPath, "utf8")
      const { name, description } = extractTitleAndDescription(content, item)
      entries.push({ id, name, path: relativePath.slice(1), description })
    }
  }

  return entries
}

function buildTreeFromDocs(docs: DocListEntry[]): DocTreeNode[] {
  const root: DocTreeNode[] = []

  for (const doc of docs) {
    const parts = doc.path.split("/")

    if (parts.length === 1) {
      root.push({ name: doc.name, type: "file", doc })
      continue
    }

    let currentLevel = root
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = slugToName(parts[i])
      let folder = currentLevel.find((n) => n.type === "folder" && n.name === folderName)
      if (!folder) {
        folder = { name: folderName, type: "folder", children: [] }
        currentLevel.push(folder)
      }
      currentLevel = folder.children ?? []
    }

    currentLevel.push({ name: doc.name, type: "file", doc })
  }

  return root
}

export function buildDocsListPayload(): { docs: DocListEntry[]; tree: DocTreeNode[] } {
  const docs: DocListEntry[] = []

  // README.md at project root
  const readmePath = path.join(projectRoot, "README.md")
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, "utf8")
    const { name, description } = extractTitleAndDescription(content, "README.md")
    docs.push({ id: "README", name, path: "README.md", description })
  }

  // All .md files in docs/ (recursive)
  docs.push(...scanDocsRecursive(DOCS_DIR, "/docs"))

  const tree = buildTreeFromDocs(docs)
  return { docs, tree }
}

export function buildDocDetailPayload(
  docId: string
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
  res: ServerResponse
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
