import { useQuery } from "@tanstack/react-query"
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import type { AnalyticsResponse, SessionAnalytics } from "../types"

const TRAILING_SLASH_REGEX = /\/+$/
const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/

function toSidebarStoryLabel(storyId: string | null | undefined): string | null {
  if (!storyId) return null
  const match = storyId.match(STORY_TICKET_REGEX)
  if (!match) return null
  return `${match[1]}.${match[2]}`
}
const HTTP_CONFLICT = 409
const DEFAULT_SKILL = "bmad-quick-dev"
const DEFAULT_MODEL = "claude-sonnet-4.6"

const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5" },
] as const

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

const SESSIONS_SIDEBAR_LIMIT = 10
const SESSIONS_REFETCH_INTERVAL_MS = 3_000
const RUNNING_STATUS = "running"
const WORKFLOW_SESSION_PREFIX = "workflow-"

const ANALYTICS_SUBMENU = [
  { label: "Overview", to: "/analytics" },
  { label: "Epics", to: "/analytics/epics" },
  { label: "Stories", to: "/analytics/stories" },
  { label: "Sessions", to: "/analytics/sessions" },
  { label: "Models", to: "/analytics/models" },
  { label: "Quality", to: "/analytics/quality" },
] as const

function NewChatFlyout(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const navigate = useNavigate()
  const [skill, setSkill] = useState(DEFAULT_SKILL)
  const [model, setModel] = useState(DEFAULT_MODEL)
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
        const body: { skill: string; model: string; prompt?: string } = {
          skill: trimmedSkill,
          model,
        }
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
        setModel(DEFAULT_MODEL)
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
    [skill, model, prompt, navigate, onClose]
  )

  if (!open) return null

  return (
    <div aria-label="New Chat" className="new-chat-flyout" id="new-chat-flyout" role="dialog">
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
        <label className="new-chat-label" htmlFor="new-chat-model">
          Model
        </label>
        <select
          className="new-chat-input"
          disabled={sending}
          id="new-chat-model"
          onChange={(e) => setModel(e.target.value)}
          value={model}
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
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
        <button className="cta new-chat-submit" disabled={sending} type="submit">
          {sending ? "Starting..." : "Run"}
        </button>
      </form>
    </div>
  )
}

function RootLayout() {
  const location = useLocation()
  const currentPath = location.pathname.replace(TRAILING_SLASH_REGEX, "") || "/"
  const isHomeActive = currentPath === "/"
  const isSetupActive =
    currentPath.startsWith("/setup") ||
    currentPath.startsWith("/workflow/analysis") ||
    currentPath.startsWith("/workflow/planning") ||
    currentPath.startsWith("/workflow/solutioning") ||
    currentPath.startsWith("/workflow/implementation") ||
    currentPath.startsWith("/epic.") ||
    currentPath.startsWith("/story.")
  const isDocsActive = currentPath.startsWith("/docs")
  const isAgentsActive =
    currentPath.startsWith("/agents") ||
    currentPath.startsWith("/sessions") ||
    currentPath.startsWith("/session/") ||
    currentPath.startsWith("/analytics")
  const [chatOpen, setChatOpen] = useState(false)

  const { data: sessionsData, isLoading: isSessionsLoading } = useQuery<SessionAnalytics[]>({
    queryKey: ["sidebar-sessions"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/analytics"))
      if (!response.ok) return []
      const payload = (await response.json()) as AnalyticsResponse
      if (!Array.isArray(payload.sessions)) return []
      return [...payload.sessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    },
    refetchInterval: SESSIONS_REFETCH_INTERVAL_MS,
  })

  const recentSessions = (sessionsData ?? [])
    .filter((s) => s.status === RUNNING_STATUS && s.sessionId.startsWith(WORKFLOW_SESSION_PREFIX))
    .slice(0, SESSIONS_SIDEBAR_LIMIT)

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-title-link">
            <h1 className="sidebar-title">BMAD UI</h1>
          </Link>
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {/* Home */}
          <Link className={`sidebar-link ${isHomeActive ? "is-section-active" : ""}`} to="/">
            Home
          </Link>

          {/* Setup */}
          <Link
            className={`sidebar-link sidebar-link-section ${isSetupActive ? "is-section-active" : ""}`}
            to="/setup"
          >
            Setup
          </Link>

          {/* Documentation */}
          <Link
            className={`sidebar-link sidebar-link-section ${isDocsActive ? "is-section-active" : ""}`}
            to="/docs"
          >
            Documentation
          </Link>

          {/* Agents */}
          <Link
            className={`sidebar-link sidebar-link-section ${isAgentsActive ? "is-section-active" : ""}`}
            to="/agents"
          >
            Agents
          </Link>
          <div className="sidebar-submenu">
            <Link
              activeOptions={{ exact: true }}
              activeProps={{ "aria-current": "page" as const }}
              className="sidebar-sublink"
              to="/sessions"
            >
              Sessions
            </Link>
            {isSessionsLoading ? (
              <span className="sidebar-sessions-empty">Loading sessions…</span>
            ) : recentSessions.length > 0 ? (
              recentSessions.map((session) => {
                const linkPath = `/session/${session.sessionId}`
                const isRunning = session.status === RUNNING_STATUS
                return (
                  <Link
                    aria-current={currentPath === linkPath ? "page" : undefined}
                    className={`sidebar-sublink${isRunning ? " session-link-running" : ""}`}
                    key={session.sessionId}
                    params={{ sessionId: session.sessionId }}
                    to="/session/$sessionId"
                  >
                    <span className="sidebar-session-status" data-status={session.status} />
                    {toSidebarStoryLabel(session.storyId) != null && (
                      <span className="sidebar-session-story">
                        {toSidebarStoryLabel(session.storyId)}
                      </span>
                    )}
                    {session.skill}
                  </Link>
                )
              })
            ) : null}
            <Link
              activeOptions={{ exact: true }}
              activeProps={{ "aria-current": "page" as const }}
              className="sidebar-sublink"
              to="/analytics"
            >
              Analytics
            </Link>
            {ANALYTICS_SUBMENU.filter((link) => link.to !== "/analytics").map((link) => (
              <Link
                activeProps={{ "aria-current": "page" as const }}
                className="sidebar-sublink"
                key={link.to}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="sidebar-spacer" />

          {!IS_LOCAL_MODE ? (
            <div className="sidebar-disclaimer">
              <span className="sidebar-disclaimer-icon" aria-hidden="true">
                ℹ
              </span>
              <span>{PROD_DISABLED_TITLE}</span>
            </div>
          ) : null}

          {IS_LOCAL_MODE ? (
            <button
              aria-controls="new-chat-flyout"
              aria-expanded={chatOpen}
              className="sidebar-link new-chat-trigger"
              onClick={() => setChatOpen((prev) => !prev)}
              type="button"
            >
              + New Chat
            </button>
          ) : null}
        </nav>

        {IS_LOCAL_MODE ? (
          <NewChatFlyout open={chatOpen} onClose={() => setChatOpen(false)} />
        ) : null}
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
