import { createRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { AnalyticsResponse, SessionAnalytics } from "../types"
import { rootRoute } from "./__root"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SessionsPage() {
  const [sessions, setSessions] = useState<SessionAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await fetch("/api/analytics")
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const payload = (await response.json()) as AnalyticsResponse
        if (mounted) {
          const sorted = [...payload.sessions].sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
          setSessions(sorted)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(String(err))
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <main className="screen loading">Loading sessions...</main>
  if (error) return <main className="screen loading"><p>{error}</p></main>

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Workspace</p>
        <h2>Sessions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Skill</th>
                <th>Model</th>
                <th>Story</th>
                <th>Status</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>
                    <Link
                      className="mono session-id"
                      params={{ sessionId: session.sessionId }}
                      style={{ color: "var(--highlight)", textDecoration: "none" }}
                      title={session.sessionId}
                      to="/session/$sessionId"
                    >
                      {session.sessionId.length > 24
                        ? `${session.sessionId.slice(0, 24)}…`
                        : session.sessionId}
                    </Link>
                  </td>
                  <td>
                    <span className="skill-chip">{session.skill}</span>
                  </td>
                  <td>
                    <span className="mono muted">{session.model}</span>
                  </td>
                  <td>
                    <span className="mono muted">{session.storyId ?? "—"}</span>
                  </td>
                  <td>
                    <span className={`step-badge step-${session.status}`}>{session.status}</span>
                  </td>
                  <td className="muted">{formatDate(session.startedAt)}</td>
                  <td className="muted">{formatDate(session.endedAt)}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    No sessions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions",
  component: SessionsPage,
})
