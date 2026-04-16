import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { apiUrl } from "../lib/mode"
import type { AnalyticsResponse, SessionAnalytics } from "../types"
import { rootRoute } from "./__root"

const SESSION_STATUS_FILTER_STORAGE_KEY = "bmad-session-status-filter"
const ALL_FILTER = "all"
const KNOWN_STATUSES = ["running", "completed", "failed"] as const

function getTimestamp(iso: string | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try {
      return localStorage.getItem(SESSION_STATUS_FILTER_STORAGE_KEY) ?? ALL_FILTER
    } catch {
      return ALL_FILTER
    }
  })

  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery<SessionAnalytics[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/analytics"))
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const payload = (await response.json()) as AnalyticsResponse
      if (!Array.isArray(payload.sessions)) return []
      return [...payload.sessions].sort(
        (a, b) => getTimestamp(b.startedAt) - getTimestamp(a.startedAt)
      )
    },
  })

  const uniqueStatuses = [...new Set(sessions.map((s) => s.status))].sort()
  const filteredSessions =
    statusFilter === ALL_FILTER ? sessions : sessions.filter((s) => s.status === statusFilter)

  function handleFilterChange(value: string) {
    setStatusFilter(value)
    try {
      localStorage.setItem(SESSION_STATUS_FILTER_STORAGE_KEY, value)
    } catch {
      // localStorage unavailable
    }
  }

  if (isLoading) return <main className="screen loading">Loading sessions...</main>
  if (error)
    return (
      <main className="screen loading">
        <p>{String(error)}</p>
      </main>
    )

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Workspace</p>
        <h2>Sessions</h2>

        <div className="sessions-filter-bar">
          <label className="sessions-filter-label" htmlFor="session-status-filter">
            Status
          </label>
          <select
            className="sessions-filter-select"
            id="session-status-filter"
            onChange={(e) => handleFilterChange(e.target.value)}
            value={statusFilter}
          >
            <option value={ALL_FILTER}>All ({sessions.length})</option>
            {KNOWN_STATUSES.map((status) => {
              const count = sessions.filter((s) => s.status === status).length
              if (count === 0) return null
              return (
                <option key={status} value={status}>
                  {status} ({count})
                </option>
              )
            })}
            {uniqueStatuses
              .filter((s) => !(KNOWN_STATUSES as readonly string[]).includes(s))
              .map((status) => {
                const count = sessions.filter((s) => s.status === status).length
                return (
                  <option key={status} value={status}>
                    {status} ({count})
                  </option>
                )
              })}
          </select>
        </div>

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
              {filteredSessions.map((session) => (
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
              {filteredSessions.length === 0 && (
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
