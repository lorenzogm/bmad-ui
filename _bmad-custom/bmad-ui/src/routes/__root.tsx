import { useQuery } from "@tanstack/react-query"
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import type { AnalyticsResponse, SessionAnalytics } from "../types"

const TRAILING_SLASH_REGEX = /\/+$/
const HTTP_CONFLICT = 409
const DEFAULT_SKILL = "bmad-quick-dev"
const DEFAULT_MODEL = "claude-sonnet-4.6"
const SESSIONS_POLL_INTERVAL_MS = 10_000
const SESSION_SKILL_PREFIX = "bmad-"

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

const NAV_LINKS = [
  { label: "Dashboard", to: "/" },
  { label: "Sessions", to: "/sessions" },
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
  const [chatOpen, setChatOpen] = useState(false)

  const { data: runningSessions = [] } = useQuery<SessionAnalytics[]>({
    queryKey: ["running-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/analytics")
      if (!response.ok) return []
      const payload = (await response.json()) as AnalyticsResponse
      if (!Array.isArray(payload.sessions)) return []
      return payload.sessions
        .filter((s) => s.status === "running")
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    },
    refetchInterval: SESSIONS_POLL_INTERVAL_MS,
  })

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

          {runningSessions.length > 0 && (
            <div className="sidebar-sessions-section">
              <span className="sidebar-sessions-label">Running</span>
              <div className="sidebar-sessions-list">
                {runningSessions.map((session) => (
                  <Link
                    className={`sidebar-session-item ${currentPath === `/session/${session.sessionId}` ? "is-active" : ""}`}
                    key={session.sessionId}
                    params={{ sessionId: session.sessionId }}
                    to="/session/$sessionId"
                  >
                    <span className="step-badge step-running">●</span>
                    <span className="sidebar-session-skill">
                      {session.skill.startsWith(SESSION_SKILL_PREFIX)
                        ? session.skill.slice(SESSION_SKILL_PREFIX.length)
                        : session.skill}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

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
