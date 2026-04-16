import { createRoute, Link, useParams } from "@tanstack/react-router"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import type { SessionDetailResponse } from "../types"
import { rootRoute } from "./__root"

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86_400
const MILLISECONDS_PER_SECOND = 1000
const USER_MESSAGE_PREFIX = "[user] "
const ORCHESTRATOR_PREFIX = "[orchestrator]"
const TOOL_MARKER = "● "
const TOOL_CONTENT_PREFIX = "  │"
const TOOL_END_PREFIX = "  └"
const AGENT_TEXT_COLLAPSE_THRESHOLD = 20

type ToolItem = {
  label: string
  details: string | null
}

type LogEntry = {
  id: string
  kind: "tool-group" | "text" | "user" | "system"
  summary: string
  details: string | null
  tools?: ToolItem[]
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) {
    return "-"
  }

  const startedMs = Date.parse(startedAt)
  if (Number.isNaN(startedMs)) {
    return "-"
  }

  const endMs = endedAt ? Date.parse(endedAt) : Date.now()
  if (Number.isNaN(endMs)) {
    return "-"
  }

  const totalSeconds = Math.max(0, Math.floor((endMs - startedMs) / MILLISECONDS_PER_SECOND))
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`)
  }
  parts.push(`${seconds}s`)

  return parts.join(" ")
}

type RawEntry = {
  kind: "tool" | "text" | "user" | "system"
  summary: string
  details: string | null
}

function classifyToolGroup(tools: ToolItem[]): string {
  let reads = 0
  let writes = 0
  let shells = 0
  let edits = 0
  let gits = 0
  let searches = 0

  for (const t of tools) {
    const lower = t.label.toLowerCase()
    if (lower.startsWith("read ") || lower.startsWith("list directory")) {
      reads += 1
    } else if (lower.startsWith("create ")) {
      writes += 1
    } else if (lower.startsWith("edit ")) {
      edits += 1
    } else if (lower.includes("(shell)")) {
      if (lower.includes("git ") || lower.includes("commit") || lower.includes("push")) {
        gits += 1
      } else {
        shells += 1
      }
    } else if (lower.startsWith("search") || lower.startsWith("find")) {
      searches += 1
    } else {
      reads += 1
    }
  }

  const total = tools.length
  if (gits > 0 && gits >= total / 2) {
    return "Git operations"
  }
  if (writes > 0 && writes >= total / 2) {
    return `Creating ${writes} file${writes > 1 ? "s" : ""}`
  }
  if (edits > 0 && edits >= total / 2) {
    return `Editing ${edits} file${edits > 1 ? "s" : ""}`
  }
  if (writes + edits > 0 && writes + edits >= total / 2) {
    return `Writing ${writes + edits} file${writes + edits > 1 ? "s" : ""}`
  }
  if (shells > 0 && shells >= total / 2) {
    return `Running ${shells} command${shells > 1 ? "s" : ""}`
  }
  if (reads + searches > 0 && reads + searches >= total / 2) {
    return "Reading context"
  }
  return `${total} operation${total > 1 ? "s" : ""}`
}

function groupEntries(raw: RawEntry[]): LogEntry[] {
  const entries: LogEntry[] = []
  let toolBuffer: ToolItem[] = []
  let entryIndex = 0

  const flushTools = () => {
    if (toolBuffer.length === 0) {
      return
    }
    if (toolBuffer.length === 1) {
      const t = toolBuffer[0]
      entries.push({
        id: `tool-${entryIndex}`,
        kind: "tool-group",
        summary: t.label,
        details: t.details,
        tools: undefined,
      })
    } else {
      const label = classifyToolGroup(toolBuffer)
      entries.push({
        id: `toolg-${entryIndex}`,
        kind: "tool-group",
        summary: label,
        details: null,
        tools: toolBuffer,
      })
    }
    entryIndex += 1
    toolBuffer = []
  }

  for (const r of raw) {
    if (r.kind === "tool") {
      toolBuffer.push({ label: r.summary, details: r.details })
    } else {
      flushTools()
      entries.push({ id: `${r.kind}-${entryIndex}`, kind: r.kind, summary: r.summary, details: r.details })
      entryIndex += 1
    }
  }

  flushTools()
  return entries
}

function parseLogIntoEntries(logContent: string | null): LogEntry[] {
  if (!logContent) {
    return []
  }

  const raw: RawEntry[] = []
  const lines = logContent.split("\n")
  let textBuffer: string[] = []
  let toolSummary: string | null = null
  let toolDetailLines: string[] = []
  let toolResult: string | null = null

  const flushText = () => {
    const text = textBuffer.join("\n").trim()
    if (text.length > 0) {
      const textLines = text.split("\n")
      if (textLines.length > AGENT_TEXT_COLLAPSE_THRESHOLD) {
        raw.push({
          kind: "text",
          summary: textLines[0],
          details: textLines.slice(1).join("\n"),
        })
      } else {
        raw.push({ kind: "text", summary: text, details: null })
      }
    }
    textBuffer = []
  }

  const flushTool = () => {
    if (toolSummary !== null) {
      const displaySummary = toolResult ? `${toolSummary} — ${toolResult}` : toolSummary
      const detailsText = toolDetailLines.join("\n").trim()
      raw.push({
        kind: "tool",
        summary: displaySummary,
        details: detailsText.length > 0 ? detailsText : null,
      })
    }
    toolSummary = null
    toolDetailLines = []
    toolResult = null
  }

  for (const line of lines) {
    if (line.startsWith(USER_MESSAGE_PREFIX)) {
      flushText()
      flushTool()
      const text = line.slice(USER_MESSAGE_PREFIX.length).trim()
      if (text.length > 0) {
        raw.push({ kind: "user", summary: text, details: null })
      }
    } else if (line.startsWith(ORCHESTRATOR_PREFIX)) {
      flushText()
      flushTool()
      const text = line.slice(ORCHESTRATOR_PREFIX.length).trim()
      if (text.length > 0) {
        raw.push({ kind: "system", summary: text, details: null })
      }
    } else if (line.startsWith(TOOL_MARKER)) {
      flushText()
      flushTool()
      toolSummary = line.slice(TOOL_MARKER.length)
    } else if (toolSummary !== null && line.startsWith(TOOL_END_PREFIX)) {
      const content = line.slice(TOOL_END_PREFIX.length).trim()
      toolResult = content
      toolDetailLines.push(content)
    } else if (toolSummary !== null && line.startsWith(TOOL_CONTENT_PREFIX)) {
      const content = line.slice(TOOL_CONTENT_PREFIX.length)
      toolDetailLines.push(content.startsWith(" ") ? content.slice(1) : content)
    } else if (toolSummary !== null && line.trim() === "") {
      flushTool()
    } else {
      flushTool()
      textBuffer.push(line)
    }
  }

  flushText()
  flushTool()
  return groupEntries(raw)
}

function ToolItemView(props: { item: ToolItem }) {
  const { item } = props

  if (!item.details) {
    return (
      <div className="log-tool-item">
        <span className="log-entry-tool-icon">●</span> {item.label}
      </div>
    )
  }

  return (
    <details className="log-tool-item log-tool-item-expandable">
      <summary>
        <span className="log-entry-tool-icon">●</span> {item.label}
      </summary>
      <pre className="log-entry-tool-body">{item.details}</pre>
    </details>
  )
}

function LogEntryView(props: { entry: LogEntry }) {
  const { entry } = props

  if (entry.kind === "system") {
    return (
      <div className="chat-bubble chat-bubble-system">
        <span className="chat-bubble-system-text">{entry.summary}</span>
      </div>
    )
  }

  if (entry.kind === "user") {
    return (
      <div className="chat-bubble chat-bubble-user">
        <div className="chat-bubble-avatar chat-bubble-avatar-user">U</div>
        <div className="chat-bubble-body">
          <p className="chat-bubble-role">You</p>
          <div className="chat-bubble-content">{entry.summary}</div>
        </div>
      </div>
    )
  }

  if (entry.kind === "tool-group") {
    if (entry.tools) {
      return (
        <details className="log-entry log-entry-group">
          <summary>
            <span className="log-group-label">{entry.summary}</span>
            <span className="log-group-count">{entry.tools.length}</span>
          </summary>
          <div className="log-group-items">
            {entry.tools.map((item, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable tool list
              <ToolItemView item={item} key={i} />
            ))}
          </div>
        </details>
      )
    }

    if (!entry.details) {
      return (
        <div className="log-entry log-entry-tool-inline">
          <span className="log-entry-tool-icon">●</span> {entry.summary}
        </div>
      )
    }

    return (
      <details className="log-entry log-entry-tool-single">
        <summary>
          <span className="log-entry-tool-icon">●</span> {entry.summary}
        </summary>
        <pre className="log-entry-tool-body">{entry.details}</pre>
      </details>
    )
  }

  if (entry.details) {
    return (
      <details className="log-entry log-entry-text-collapsible">
        <summary>{entry.summary}</summary>
        <pre className="log-entry-text-body">{entry.details}</pre>
      </details>
    )
  }

  return (
    <div className="log-entry log-entry-text">
      {entry.summary}
    </div>
  )
}

function SessionDetailPage() {
  const { sessionId } = useParams({ from: "/session/$sessionId" })
  const [data, setData] = useState<SessionDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sessionActionPending, setSessionActionPending] = useState<"start" | "abort" | null>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const streamContent = data?.logContent || ""
  const userMessageCount = data?.session.userMessages?.length || 0
  const entries = parseLogIntoEntries(data?.logContent ?? null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on content change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [streamContent, userMessageCount])

  // biome-ignore lint/correctness/useExhaustiveDependencies: SSE subscription on mount
  useEffect(() => {
    let mounted = true
    let eventSource: EventSource | null = null

    const applyPayload = (payload: SessionDetailResponse) => {
      if (!mounted) {
        return
      }

      setData(payload)
      setError(null)
      setLoading(false)
    }

    const load = async () => {
      try {
        const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}`)
        if (!response.ok) {
          throw new Error(`session detail request failed: ${response.status}`)
        }

        applyPayload((await response.json()) as SessionDetailResponse)
      } catch (sessionError) {
        if (mounted) {
          setError(String(sessionError))
          setLoading(false)
        }
      }
    }

    load()

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource(`/api/events/session/${encodeURIComponent(sessionId)}`)
      eventSource.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as SessionDetailResponse)
        } catch (parseError) {
          if (mounted) {
            setError(String(parseError))
          }
        }
      }
    }

    return () => {
      mounted = false
      eventSource?.close()
    }
  }, [sessionId])

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (sending) {
        return
      }

      const message = chatInput.trim()
      if (!message) {
        return
      }

      setSending(true)
      setSendError(null)

      try {
        const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        })

        if (!response.ok) {
          throw new Error(`session input request failed: ${response.status}`)
        }

        setChatInput("")
      } catch (sessionInputError) {
        setSendError(String(sessionInputError))
      } finally {
        setSending(false)
      }
    },
    [chatInput, sending, sessionId],
  )

  const handleStartSession = useCallback(async () => {
    setSessionActionPending("start")
    setSendError(null)
    try {
      const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}/start`, {
        method: "POST",
      })

      if (!response.ok && response.status !== 409) {
        throw new Error(`session start failed: ${response.status}`)
      }
    } catch (sessionStartError) {
      setSendError(String(sessionStartError))
    } finally {
      setSessionActionPending(null)
    }
  }, [sessionId])

  const handleAbortSession = useCallback(async () => {
    setSessionActionPending("abort")
    setSendError(null)
    try {
      const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}/abort`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`session abort failed: ${response.status}`)
      }
    } catch (sessionAbortError) {
      setSendError(String(sessionAbortError))
    } finally {
      setSessionActionPending(null)
    }
  }, [sessionId])

  if (loading) {
    return <main className="screen loading">Loading session detail...</main>
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Session not found"}</p>
        <Link to="/">Back to dashboard</Link>
      </main>
    )
  }

  const { session } = data

  return (
    <main className="chat-layout">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <Link className="chat-back-link" params={session.storyId ? { epicId: `epic-${session.storyId.split("-")[0]}` } : undefined} to={session.storyId ? "/epic/$epicId" : "/"}>← Back</Link>
          <span className="chat-topbar-skill">{session.skill}</span>
          {session.storyId ? (
            <span className="chat-topbar-story">{session.storyId}</span>
          ) : null}
          <span className={`step-badge step-${session.status}`}>{session.status}</span>
          <span className="chat-topbar-meta">
            {session.model} · {formatDuration(session.startedAt, session.endedAt)}
          </span>
        </div>
        <div className="chat-topbar-right">
          <button
            className="ghost chat-topbar-toggle"
            onClick={() => setShowMeta((v) => !v)}
            type="button"
          >
            {showMeta ? "Hide details" : "Details"}
          </button>
          <button
            className="ghost chat-topbar-toggle"
            onClick={() => setShowPrompt((v) => !v)}
            type="button"
          >
            {showPrompt ? "Hide prompt" : "Prompt"}
          </button>
          {/* biome-ignore lint/a11y/useSemanticElements: action group in session header */}
          <div className="session-actions" role="group">
            <button
              aria-label="Start session"
              className="icon-button icon-button-play"
              disabled={
                sessionActionPending !== null || session.status !== "planned" || data.isRunning
              }
              onClick={handleStartSession}
              title="Start session"
              type="button"
            >
              <span aria-hidden="true" className="icon-glyph">▶</span>
            </button>
            <button
              aria-label="Abort session"
              className="icon-button icon-button-delete"
              disabled={
                sessionActionPending !== null ||
                !(session.status === "planned" || session.status === "running")
              }
              onClick={handleAbortSession}
              title="Abort session"
              type="button"
            >
              <span aria-hidden="true" className="icon-glyph">✕</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Collapsible metadata panel ──────────────────── */}
      {showMeta ? (
        <section className="chat-meta-drawer">
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><th>Session ID</th><td className="mono">{session.id}</td></tr>
                <tr><th>Skill</th><td>{session.skill}</td></tr>
                <tr><th>Model</th><td>{session.model}</td></tr>
                <tr><th>Story</th><td>{session.storyId || "-"}</td></tr>
                <tr><th>Started</th><td>{formatDate(session.startedAt)}</td></tr>
                <tr><th>Duration</th><td>{formatDuration(session.startedAt, session.endedAt)}</td></tr>
                <tr><th>Exit Code</th><td>{session.exitCode ?? "-"}</td></tr>
                <tr><th>Error</th><td>{session.error || "-"}</td></tr>
                <tr><th>Log Path</th><td className="mono">{session.logPath}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Collapsible prompt panel ────────────────────── */}
      {showPrompt ? (
        <section className="chat-meta-drawer">
          <h3>Prompt</h3>
          <pre className="story-markdown">{data.promptContent || "No prompt content available."}</pre>
        </section>
      ) : null}

      {/* ── Messages area ───────────────────────────────── */}
      <div className="chat-messages-area">
        {entries.length === 0 && !data.isRunning ? (
          <div className="chat-empty-state">
            <p>No log output available for this session.</p>
            {!data.logExists ? <p className="muted">Log file not found at: {session.logPath}</p> : null}
          </div>
        ) : null}

        {entries.length === 0 && data.isRunning ? (
          <div className="chat-empty-state">
            <p>Waiting for agent output…</p>
            <div className="chat-typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        ) : null}

        {entries.map((entry) => (
          <LogEntryView entry={entry} key={entry.id} />
        ))}

        {data.isRunning && entries.length > 0 ? (
          <div className="chat-typing-indicator">
            <span /><span /><span />
          </div>
        ) : null}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────── */}
      <footer className="chat-input-footer">
        {sendError ? <p className="chat-error">{sendError}</p> : null}
        {data.isRunning ? (
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.85rem" }}>
            Agent is running — input disabled while processing.
          </p>
        ) : (
          <form className="chat-input-form" onSubmit={handleSend}>
            <textarea
              disabled={sending}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Send a follow-up message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              value={chatInput}
            />
            <button
              className="chat-send-btn"
              disabled={sending || chatInput.trim().length === 0}
              title="Send message"
              type="submit"
            >
              {sending ? "…" : "↑"}
            </button>
          </form>
        )}
      </footer>
    </main>
  )
}

export const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId",
  component: SessionDetailPage,
})
