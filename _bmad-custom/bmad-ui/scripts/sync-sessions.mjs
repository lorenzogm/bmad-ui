#!/usr/bin/env node
/**
 * sync-sessions.mjs
 *
 * Background daemon that scans Copilot CLI and VS Code Copilot debug logs
 * for sessions tied to this project and upserts them into agent-sessions.json.
 *
 * Sources:
 *   - Copilot CLI  → ~/.copilot/session-state/<sid>/events.jsonl
 *   - VS Code Chat → ~/Library/Application Support/Code - Insiders/User/workspaceStorage/<hash>/GitHub.copilot-chat/debug-logs/<sid>/main.jsonl
 *
 * Usage:
 *   node scripts/sync-sessions.mjs           # watch mode (every 5 s)
 *   node scripts/sync-sessions.mjs --once    # one-shot backfill and exit
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Paths ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, "..", "..", "..")
const SESSIONS_FILE = join(PROJECT_ROOT, "_bmad-custom", "agents", "agent-sessions.json")
const CLI_BASE = join(homedir(), ".copilot", "session-state")
const VS_CODE_WS_BASE = join(
  homedir(),
  "Library",
  "Application Support",
  "Code - Insiders",
  "User",
  "workspaceStorage",
)

// ─── Constants ────────────────────────────────────────────────────────────────

const INACTIVE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes → session is completed
const POLL_INTERVAL_MS = 5_000
const PROJECT_PATH_FRAGMENT = "/lorenzogm/bmad-ui"

/** Cost multiplier per model family (matches custom instructions). */
const PREMIUM_MULTIPLIERS = new Map([
  ["claude-haiku", 0.25],
  ["claude-sonnet", 1],
  ["claude-opus", 3],
  ["gpt-4.1", 1],
  ["gpt-5-mini", 0.5],
  ["gpt-5.4-mini", 0.5],
  ["gpt-5", 2],
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPremiumMultiplier(model) {
  if (!model) return 1
  for (const [prefix, mult] of PREMIUM_MULTIPLIERS) {
    if (model.startsWith(prefix)) return mult
  }
  return 1
}

function readExistingSessions() {
  if (!existsSync(SESSIONS_FILE)) return {}
  try {
    const parsed = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"))
    return parsed.sessions ?? {}
  } catch {
    return {}
  }
}

function writeSessions(sessions) {
  writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions }, null, 2) + "\n", "utf8")
}

/** Determine if a timestamp (ISO string) means the session is still running. */
function isActive(isoTs) {
  if (!isoTs) return false
  const ms = Date.parse(isoTs)
  return !Number.isNaN(ms) && Date.now() - ms < INACTIVE_TIMEOUT_MS
}

// ─── VS Code workspace hash discovery ────────────────────────────────────────

let _cachedWsHash = null

function findBmadWorkspaceHash() {
  if (_cachedWsHash) return _cachedWsHash
  if (!existsSync(VS_CODE_WS_BASE)) return null
  try {
    for (const hash of readdirSync(VS_CODE_WS_BASE)) {
      const wsJson = join(VS_CODE_WS_BASE, hash, "workspace.json")
      if (!existsSync(wsJson)) continue
      try {
        const { folder } = JSON.parse(readFileSync(wsJson, "utf8"))
        if (typeof folder === "string" && folder.includes(PROJECT_PATH_FRAGMENT)) {
          _cachedWsHash = hash
          return hash
        }
      } catch {
        // ignore malformed workspace.json
      }
    }
  } catch {
    // ignore readdir errors
  }
  return null
}

// ─── Copilot CLI parser ───────────────────────────────────────────────────────

/**
 * Parses ~/.copilot/session-state/<sid>/events.jsonl
 * Returns an AgentSession-format object or null if not a bmad-ui session.
 */
function parseCLISession(sessionId, eventsPath) {
  let content
  try {
    content = readFileSync(eventsPath, "utf8")
  } catch {
    return null
  }

  let model = "unknown"
  let startDate = null
  let lastTs = null
  let skill = "general"
  let turns = 0
  let cwd = null

  for (const raw of content.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }

    const ts = obj.timestamp ?? obj.data?.startTime ?? null
    if (ts) {
      if (!lastTs || ts > lastTs) lastTs = ts
    }

    switch (obj.type) {
      case "session.start":
        model = obj.data?.selectedModel ?? model
        startDate = obj.data?.startTime ?? startDate
        cwd = obj.data?.context?.cwd ?? cwd
        break
      case "session.model_change":
        model = obj.data?.model ?? model
        break
      case "user.message":
        turns++
        break
      case "skill.invoked":
        if (obj.data?.name) skill = obj.data.name
        break
    }
  }

  // Only include sessions for this project
  if (!cwd || !cwd.includes(PROJECT_PATH_FRAGMENT)) return null
  if (!startDate) return null

  const status = isActive(lastTs) ? "running" : "completed"
  const multiplier = getPremiumMultiplier(model)

  return {
    session_id: sessionId,
    storyId: null,
    tool: "copilot-cli",
    model,
    premium: true,
    premium_requests: turns,
    premium_multiplier: multiplier,
    premium_cost_units: turns * multiplier,
    tokens: { input: 0, output: 0, total: 0 },
    agent: skill,
    turns,
    status,
    start_date: startDate,
    end_date: status === "completed" ? (lastTs ?? startDate) : null,
  }
}

// ─── VS Code debug log parser ─────────────────────────────────────────────────

/**
 * Parses <ws-storage>/<hash>/GitHub.copilot-chat/debug-logs/<sid>/main.jsonl
 * Returns an AgentSession-format object or null if the session had no LLM activity.
 */
function parseVSCodeSession(sessionId, logPath) {
  let content
  try {
    content = readFileSync(logPath, "utf8")
  } catch {
    return null
  }

  let model = "unknown"
  let startDate = null
  let lastTs = null
  let tokensIn = 0
  let tokensOut = 0
  let llmRequests = 0
  let turns = 0
  let skill = "general"

  for (const raw of content.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }

    const tsMs = typeof obj.ts === "number" ? obj.ts : null
    if (tsMs) {
      const iso = new Date(tsMs).toISOString()
      if (!startDate) startDate = iso
      lastTs = iso
    }

    switch (obj.type) {
      case "llm_request": {
        const attrs = obj.attrs ?? {}
        if (model === "unknown" && attrs.model) model = attrs.model
        tokensIn += attrs.inputTokens ?? 0
        tokensOut += attrs.outputTokens ?? 0
        llmRequests++
        break
      }
      case "user_message":
        turns++
        break
      case "discovery": {
        // Extract the first loaded skill name (e.g. "Load Skills" discovery event)
        if ((obj.name ?? "").includes("Skills")) {
          const details = obj.attrs?.details ?? ""
          const match = /loaded:\s*\[([^\]]+)\]/.exec(details)
          if (match) {
            const firstSkill = match[1].split(",")[0].trim()
            if (firstSkill) skill = firstSkill
          }
        }
        break
      }
    }
  }

  // Skip sessions with no LLM activity (e.g. opened-but-never-used sessions)
  if (llmRequests === 0 || !startDate) return null

  const status = isActive(lastTs) ? "running" : "completed"
  const multiplier = getPremiumMultiplier(model)
  const totalTokens = tokensIn + tokensOut

  return {
    session_id: sessionId,
    storyId: null,
    tool: "vscode",
    model,
    premium: true,
    premium_requests: llmRequests,
    premium_multiplier: multiplier,
    premium_cost_units: llmRequests * multiplier,
    tokens: { input: tokensIn, output: tokensOut, total: totalTokens },
    agent: skill,
    turns,
    status,
    start_date: startDate,
    end_date: status === "completed" ? lastTs : null,
  }
}

// ─── Core sync ────────────────────────────────────────────────────────────────

function syncSessions() {
  const existing = readExistingSessions()
  let changed = 0

  function upsert(id, parsed) {
    const prev = existing[id]

    // Never downgrade a completed session back to running due to stale file reads
    if (prev?.status === "completed" && prev?.end_date && parsed.status === "running") {
      parsed = { ...parsed, status: "completed", end_date: prev.end_date }
    }

    const next = { ...(prev ?? {}), ...parsed }
    if (JSON.stringify(existing[id]) !== JSON.stringify(next)) {
      existing[id] = next
      changed++
    }
  }

  // ── 1. Copilot CLI sessions ──────────────────────────────────────────────────
  if (existsSync(CLI_BASE)) {
    let entries
    try {
      entries = readdirSync(CLI_BASE)
    } catch {
      entries = []
    }
    for (const sid of entries) {
      const eventsPath = join(CLI_BASE, sid, "events.jsonl")
      if (!existsSync(eventsPath)) continue

      // Skip already-completed sessions to avoid re-parsing large files on every poll
      const prev = existing[sid]
      if (prev?.tool === "copilot-cli" && prev?.status === "completed" && prev?.end_date) continue

      const session = parseCLISession(sid, eventsPath)
      if (session) upsert(sid, session)
    }
  }

  // ── 2. VS Code sessions ──────────────────────────────────────────────────────
  const wsHash = findBmadWorkspaceHash()
  if (wsHash) {
    const debugBase = join(VS_CODE_WS_BASE, wsHash, "GitHub.copilot-chat", "debug-logs")
    if (existsSync(debugBase)) {
      let entries
      try {
        entries = readdirSync(debugBase)
      } catch {
        entries = []
      }
      for (const sid of entries) {
        const logPath = join(debugBase, sid, "main.jsonl")
        if (!existsSync(logPath)) continue

        const prev = existing[sid]
        if (prev?.tool === "vscode" && prev?.status === "completed" && prev?.end_date) continue

        const session = parseVSCodeSession(sid, logPath)
        if (session) upsert(sid, session)
      }
    }
  }

  if (changed > 0) {
    writeSessions(existing)
    const total = Object.keys(existing).length
    console.log(`[sync-sessions] +${changed} updated  (${total} total sessions)`)
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const isOnce = process.argv.includes("--once")

console.log("[sync-sessions] Starting — scanning Copilot CLI + VS Code sessions…")
syncSessions()

if (isOnce) {
  console.log("[sync-sessions] Done.")
} else {
  setInterval(syncSessions, POLL_INTERVAL_MS)
  console.log(`[sync-sessions] Watching every ${POLL_INTERVAL_MS / 1000}s`)
}
