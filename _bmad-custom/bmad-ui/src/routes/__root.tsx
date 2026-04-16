import { createRootRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import type { OverviewResponse } from "../types"

const SIDEBAR_SESSIONS_LIMIT = 20
const SIDEBAR_SESSIONS_POLL_MS = 5000

type SidebarSessionItem = {
  id: string
  skill: string
  status: string
  startedAt: string
  isRuntime: boolean
}

function useSidebarSessions(): SidebarSessionItem[] {
  const [sessions, setSessions] = useState<SidebarSessionItem[]>([])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch("/api/overview")
        if (!response.ok || !mounted) return

        const data = (await response.json()) as OverviewResponse

        const runtime: SidebarSessionItem[] = data.agentRunHistory
          .flatMap((g) => g.sessions)
          .map((s) => ({
            id: s.id,
            skill: s.skill,
            status: s.status,
            startedAt: s.startedAt,
            isRuntime: true,
          }))

        const copilot: SidebarSessionItem[] = data.agentSessions
          .filter((s) => !!s.session_id)
          .map((s) => ({
            id: s.session_id as string,
            skill: s.agent,
            status: s.status,
            startedAt: s.start_date,
            isRuntime: false,
          }))

        const seen = new Set<string>()
        const merged = [...runtime, ...copilot]
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .filter((s) => {
            if (seen.has(s.id)) return false
            seen.add(s.id)
            return true
          })

        if (mounted) setSessions(merged)
      } catch {
        // ignore fetch errors silently
      }
    }

    load()
    const interval = setInterval(load, SIDEBAR_SESSIONS_POLL_MS)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return sessions
}

function SidebarSessions() {
  const sessions = useSidebarSessions()
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div className="sidebar-sessions-section">
      <span className="sidebar-sessions-label">Sessions</span>
      {sessions.length === 0 ? (
        <span className="sidebar-sessions-empty">No sessions yet</span>
      ) : (
        <div className="sidebar-sessions-list">
          {sessions.slice(0, SIDEBAR_SESSIONS_LIMIT).map((session) => {
            const to = `/session/${session.id}`
            const isActive = currentPath === to
            if (session.isRuntime) {
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`sidebar-session-item${isActive ? " is-active" : ""}`}
                  key={session.id}
                  params={{ sessionId: session.id }}
                  to="/session/$sessionId"
                >
                  <span className={`step-badge step-${session.status}`} />
                  <span className="sidebar-session-skill">{session.skill}</span>
                </Link>
              )
            }
            return (
              <div className="sidebar-session-item sidebar-session-item--static" key={session.id}>
                <span className={`step-badge step-${session.status}`} />
                <span className="sidebar-session-skill">{session.skill}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const TRAILING_SLASH_REGEX = /\/+$/
const HTTP_CONFLICT = 409
const DEFAULT_SKILL = "bmad-quick-dev"

const AVAILABLE_SKILLS = [
  "bmad-quick-dev",
  "bmad-dev-story",
  "bmad-create-story",
  "bmad-code-review",
  "bmad-correct-course",
  "bmad-create-architecture",
  "bmad-create-epics-and-stories",
  "bmad-create-prd",
  "bmad-create-ux-design",
  "bmad-edit-prd",
  "bmad-validate-prd",
  "bmad-check-implementation-readiness",
  "bmad-generate-project-context",
  "bmad-sprint-planning",
  "bmad-sprint-status",
  "bmad-retrospective",
  "bmad-brainstorming",
  "bmad-domain-research",
  "bmad-market-research",
  "bmad-technical-research",
  "bmad-document-project",
  "bmad-product-brief",
  "bmad-prfaq",
  "bmad-qa-generate-e2e-tests",
  "bmad-checkpoint-preview",
  "bmad-advanced-elicitation",
  "bmad-distillator",
  "bmad-editorial-review-prose",
  "bmad-editorial-review-structure",
  "bmad-review-adversarial-general",
  "bmad-review-edge-case-hunter",
  "bmad-shard-doc",
  "bmad-index-docs",
  "bmad-help",
  "bmad-party-mode",
  "bmad-agent-analyst",
  "bmad-agent-architect",
  "bmad-agent-dev",
  "bmad-agent-pm",
  "bmad-agent-tech-writer",
  "bmad-agent-ux-designer",
] as const

const NAV_LINKS = [{ label: "Dashboard", to: "/" }] as const

const ANALYTICS_SUBMENU = [
  { label: "Overview", to: "/analytics" },
  { label: "Epics", to: "/analytics/epics" },
  { label: "Stories", to: "/analytics/stories" },
  { label: "Sessions", to: "/analytics/sessions" },
  { label: "Models", to: "/analytics/models" },
] as const

function NewChatFlyout(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const navigate = useNavigate()
  const [skill, setSkill] = useState(DEFAULT_SKILL)
  const [prompt, setPrompt] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmedSkill = skill.trim()
      if (!trimmedSkill) return

      setSending(true)
      setError(null)

      try {
        const body: { skill: string; prompt?: string } = { skill: trimmedSkill }
        const trimmedPrompt = prompt.trim()
        if (trimmedPrompt) {
          body.prompt = trimmedPrompt
        }

        const response = await fetch("/api/workflow/run-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (response.status === HTTP_CONFLICT) {
          throw new Error("Another workflow is already running.")
        }

        if (!response.ok) {
          let errorMessage = `Request failed: ${response.status}`
          try {
            const data = (await response.json()) as { error?: string }
            if (data.error) errorMessage = data.error
          } catch (_parseError) {
            // non-JSON response — use status code message
          }
          throw new Error(errorMessage)
        }

        const result = (await response.json()) as { sessionId: string }
        if (!result.sessionId) {
          throw new Error("Server did not return a session ID")
        }

        setSkill(DEFAULT_SKILL)
        setPrompt("")
        onClose()

        void navigate({
          to: "/session/$sessionId",
          params: { sessionId: result.sessionId },
        })
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : String(submitError))
      } finally {
        setSending(false)
      }
    },
    [skill, prompt, navigate, onClose]
  )

  if (!open) return null

  return (
    <div
      aria-label="New Chat"
      className="new-chat-flyout"
      id="new-chat-flyout"
      role="dialog"
    >
      <div className="new-chat-header">
        <span className="new-chat-title">New Chat</span>
        <button
          aria-label="Close new chat panel"
          className="new-chat-close"
          onClick={onClose}
          title="Close"
          type="button"
        >
          ✕
        </button>
      </div>
      <form className="new-chat-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="new-chat-label" htmlFor="new-chat-skill">
          Skill
        </label>
        <select
          className="new-chat-input"
          disabled={sending}
          id="new-chat-skill"
          onChange={(e) => setSkill(e.target.value)}
          value={skill}
        >
          {AVAILABLE_SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="new-chat-label" htmlFor="new-chat-prompt">
          Prompt <span className="new-chat-optional">(optional)</span>
        </label>
        <textarea
          className="new-chat-textarea"
          disabled={sending}
          id="new-chat-prompt"
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Custom prompt text..."
          rows={5}
          value={prompt}
        />
        {error ? <p className="new-chat-error">{error}</p> : null}
        <button
          className="cta new-chat-submit"
          disabled={sending}
          type="submit"
        >
          {sending ? "Starting..." : "Run"}
        </button>
      </form>
    </div>
  )
}

function RootLayout() {
  const location = useLocation()
  const currentPath = location.pathname.replace(TRAILING_SLASH_REGEX, "") || "/"
  const isAnalyticsSection = currentPath.startsWith("/analytics")
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <h1 className="sidebar-title">BMAD UI</h1>
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              aria-current={currentPath === link.to ? "page" : undefined}
              className="sidebar-link"
              key={link.to}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}

          <SidebarSessions />

          <Link
            aria-current={currentPath === "/analytics" ? "page" : undefined}
            aria-expanded={isAnalyticsSection}
            className={`sidebar-link ${isAnalyticsSection ? "is-section-active" : ""}`}
            to="/analytics"
          >
            Analytics
          </Link>

          {isAnalyticsSection && (
            <div className="sidebar-submenu">
              {ANALYTICS_SUBMENU.map((link) => (
                <Link
                  aria-current={currentPath === link.to ? "page" : undefined}
                  className="sidebar-sublink"
                  key={link.to}
                  to={link.to}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="sidebar-spacer" />

          <button
            aria-controls="new-chat-flyout"
            aria-expanded={chatOpen}
            className="sidebar-link new-chat-trigger"
            onClick={() => setChatOpen((prev) => !prev)}
            type="button"
          >
            + New Chat
          </button>
        </nav>

        <NewChatFlyout open={chatOpen} onClose={() => setChatOpen(false)} />
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}

export const rootRoute = createRootRoute({
  component: RootLayout,
})
