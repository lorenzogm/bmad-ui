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

type ChatBubble = {
  id: string
  role: "agent" | "user" | "system"
  content: string
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

function parseLogIntoBubbles(logContent: string | null): ChatBubble[] {
  if (!logContent) {
    return []
  }

  const bubbles: ChatBubble[] = []
  const lines = logContent.split("\n")
  let agentBuffer: string[] = []
  let bubbleIndex = 0

  const flushAgent = () => {
    const text = agentBuffer.join("\n").trim()
    if (text.length > 0) {
      bubbles.push({ id: `agent-${bubbleIndex}`, role: "agent", content: text })
      bubbleIndex += 1
    }
    agentBuffer = []
  }

  for (const line of lines) {
    if (line.startsWith(USER_MESSAGE_PREFIX)) {
      flushAgent()
      const text = line.slice(USER_MESSAGE_PREFIX.length).trim()
      if (text.length > 0) {
        bubbles.push({ id: `user-${bubbleIndex}`, role: "user", content: text })
        bubbleIndex += 1
      }
    } else if (line.startsWith(ORCHESTRATOR_PREFIX)) {
      flushAgent()
      const text = line.slice(ORCHESTRATOR_PREFIX.length).trim()
      if (text.length > 0) {
        bubbles.push({ id: `sys-${bubbleIndex}`, role: "system", content: text })
        bubbleIndex += 1
      }
    } else {
      agentBuffer.push(line)
    }
  }

  flushAgent()
  return bubbles
}

function ChatBubbleView(props: { bubble: ChatBubble }) {
  const { bubble } = props

  if (bubble.role === "system") {
    return (
      <div className="chat-bubble chat-bubble-system">
        <span className="chat-bubble-system-text">{bubble.content}</span>
      </div>
    )
  }

  if (bubble.role === "user") {
    return (
      <div className="chat-bubble chat-bubble-user">
        <div className="chat-bubble-avatar chat-bubble-avatar-user">U</div>
        <div className="chat-bubble-body">
          <p className="chat-bubble-role">You</p>
          <div className="chat-bubble-content">{bubble.content}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-bubble chat-bubble-agent">
      <div className="chat-bubble-avatar chat-bubble-avatar-agent">A</div>
      <div className="chat-bubble-body">
        <p className="chat-bubble-role">Copilot Agent</p>
        <pre className="chat-bubble-content">{bubble.content}</pre>
      </div>
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
  const bubbles = parseLogIntoBubbles(data?.logContent ?? null)

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
      if (!data?.canSendInput || sending) {
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
    [chatInput, data?.canSendInput, sending, sessionId],
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
        {bubbles.length === 0 && !data.isRunning ? (
          <div className="chat-empty-state">
            <p>No log output available for this session.</p>
            {!data.logExists ? <p className="muted">Log file not found at: {session.logPath}</p> : null}
          </div>
        ) : null}

        {bubbles.length === 0 && data.isRunning ? (
          <div className="chat-empty-state">
            <p>Waiting for agent output…</p>
            <div className="chat-typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        ) : null}

        {bubbles.map((bubble) => (
          <ChatBubbleView bubble={bubble} key={bubble.id} />
        ))}

        {data.isRunning && bubbles.length > 0 ? (
          <div className="chat-typing-indicator">
            <span /><span /><span />
          </div>
        ) : null}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────── */}
      <footer className="chat-input-footer">
        {sendError ? <p className="chat-error">{sendError}</p> : null}
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
            placeholder={
              data.canSendInput
                ? "Send a message to the agent… (Enter to send, Shift+Enter for newline)"
                : "This session is not accepting input."
            }
            rows={1}
            value={chatInput}
          />
          <button
            className="chat-send-btn"
            disabled={!data.canSendInput || sending || chatInput.trim().length === 0}
            title="Send message"
            type="submit"
          >
            {sending ? "…" : "↑"}
          </button>
        </form>
      </footer>
    </main>
  )
}

export const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId",
  component: SessionDetailPage,
})
