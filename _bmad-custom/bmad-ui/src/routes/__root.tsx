import { useQuery } from "@tanstack/react-query"
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import type { AnalyticsResponse, SessionAnalytics } from "../types"

const TRAILING_SLASH_REGEX = /\/+$/
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

const WORKFLOW_SUBMENU = [
  { label: "Overview", phaseId: null },
  { label: "Analysis", phaseId: "analysis" },
  { label: "Planning", phaseId: "planning" },
  { label: "Solutioning", phaseId: "solutioning" },
  { label: "Implementation", phaseId: "implementation" },
] as const

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
  const isAnalyticsSection = currentPath.startsWith("/analytics")
  const isWorkflowSection = currentPath.startsWith("/workflow")
  const isSessionsSection =
    currentPath.startsWith("/sessions") || currentPath.startsWith("/session/")
  const [chatOpen, setChatOpen] = useState(false)

  const { data: sessionsData } = useQuery<SessionAnalytics[]>({
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
    .filter((s) => s.status === RUNNING_STATUS)
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
          <Link
            aria-current={currentPath.startsWith("/workflow") ? "page" : undefined}
            className={`sidebar-link sidebar-link-section ${isWorkflowSection ? "is-section-active" : ""}`}
            to="/workflow"
          >
            Workflow
          </Link>

          <div className="sidebar-submenu">
            {WORKFLOW_SUBMENU.map((link) => {
              const linkPath = link.phaseId ? `/workflow/${link.phaseId}` : "/workflow"
              return link.phaseId ? (
                <Link
                  aria-current={currentPath === linkPath ? "page" : undefined}
                  className="sidebar-sublink"
                  key={link.label}
                  params={{ phaseId: link.phaseId }}
                  to="/workflow/$phaseId"
                >
                  {link.label}
                </Link>
              ) : (
                <Link
                  activeOptions={{ exact: true }}
                  aria-current={currentPath === linkPath ? "page" : undefined}
                  className="sidebar-sublink"
                  key={link.label}
                  to="/workflow"
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <Link
            aria-current={currentPath === "/sessions" ? "page" : undefined}
            className={`sidebar-link sidebar-link-section ${isSessionsSection ? "is-section-active" : ""}`}
            to="/sessions"
          >
            Sessions
          </Link>

          {recentSessions.length > 0 ? (
            <div className="sidebar-submenu">
              {recentSessions.map((session) => {
                const linkPath = `/session/${session.sessionId}`
                const label =
                  session.sessionId.length > 22
                    ? `${session.sessionId.slice(0, 22)}…`
                    : session.sessionId
                return (
                  <Link
                    aria-current={currentPath === linkPath ? "page" : undefined}
                    className="sidebar-sublink"
                    key={session.sessionId}
                    params={{ sessionId: session.sessionId }}
                    to="/session/$sessionId"
                  >
                    <span className="sidebar-session-status" data-status={session.status} />
                    {label}
                  </Link>
                )
              })}
            </div>
          ) : null}

          <Link
            aria-current={currentPath === "/analytics" ? "page" : undefined}
            className={`sidebar-link sidebar-link-section ${isAnalyticsSection ? "is-section-active" : ""}`}
            to="/analytics"
          >
            Analytics
          </Link>

          <div className="sidebar-submenu">
            {ANALYTICS_SUBMENU.map((link) => (
              <Link
                activeOptions={link.to === "/analytics" ? { exact: true } : undefined}
                aria-current={currentPath === link.to ? "page" : undefined}
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
