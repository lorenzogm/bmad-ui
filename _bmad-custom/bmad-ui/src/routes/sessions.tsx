import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { StatusBadge } from "../app"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
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

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end)) return "—"
  const totalSeconds = Math.floor((end - start) / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
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
    refetch,
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

  if (isLoading) return <PageSkeleton />
  if (error) return <QueryErrorState message={String(error)} onRetry={refetch} />

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No sessions yet"
        description="Run the sync daemon to start tracking your agent sessions: npm run sync-sessions"
      />
    )
  }

  if (filteredSessions.length === 0) {
    return (
      <EmptyState
        icon="🔎"
        title="No sessions found"
        description={`No sessions match the "${statusFilter}" filter. Adjust the filter or run the sync daemon to collect more sessions.`}
        action={{ label: "Show all sessions", onClick: () => handleFilterChange(ALL_FILTER) }}
      />
    )
  }

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
                <th>Skill / Name</th>
                <th>Model</th>
                <th>Story</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>
                    <span className="skill-chip">{session.skill ?? "—"}</span>
                    <Link
                      className={`session-link-icon${session.status === "running" ? " session-link-running" : ""}${session.status === "failed" ? " session-link-failed" : ""}`}
                      params={{ sessionId: session.sessionId }}
                      title={`View session: ${session.sessionId}`}
                      to="/session/$sessionId"
                    >
                      ◉
                    </Link>
                  </td>
                  <td>
                    <span className="mono muted">{session.model}</span>
                  </td>
                  <td className="max-w-[12rem]">
                    <span className="mono muted block truncate">{session.storyId ?? "—"}</span>
                  </td>
                  <td>
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="muted">{formatDate(session.startedAt)}</td>
                  <td className="muted">{formatDuration(session.startedAt, session.endedAt)}</td>
                </tr>
              ))}
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
