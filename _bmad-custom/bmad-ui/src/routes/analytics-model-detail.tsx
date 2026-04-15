import { createRoute } from "@tanstack/react-router"
import { analyticsLayoutRoute } from "./analytics"
import {
  AnalyticsCostBanner,
  formatNumber,
  StatCard,
  UsageBar,
  UsageCell,
  useAnalyticsData,
} from "./analytics-utils"

function AnalyticsModelDetailPage() {
  const { modelId } = analyticsModelDetailRoute.useParams()
  const { data, loading, error } = useAnalyticsData()

  if (loading) {
    return <main className="screen loading">Loading analytics...</main>
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Failed to load analytics"}</p>
      </main>
    )
  }

  const modelSessions = data.sessions.filter((s) => (s.model || "unknown") === modelId)

  const totals = modelSessions.reduce(
    (acc, s) => ({
      requests: acc.requests + s.usage.requests,
      tokensIn: acc.tokensIn + s.usage.tokensIn,
      tokensOut: acc.tokensOut + s.usage.tokensOut,
      tokensCached: acc.tokensCached + s.usage.tokensCached,
      totalTokens: acc.totalTokens + s.usage.totalTokens,
    }),
    {
      requests: 0,
      tokensIn: 0,
      tokensOut: 0,
      tokensCached: 0,
      totalTokens: 0,
    }
  )

  const maxSessionTotal = Math.max(...modelSessions.map((s) => s.usage.totalTokens), 1)

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Model Analytics</p>
        <h2>{modelId}</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="stat-grid">
          <StatCard label="Sessions" value={String(modelSessions.length)} />
          <StatCard label="Requests" value={formatNumber(totals.requests, 2)} />
          <StatCard
            label="Total Tokens"
            sub={`↑${formatNumber(totals.tokensIn)} ↓${formatNumber(totals.tokensOut)}`}
            value={formatNumber(totals.totalTokens)}
          />
          <StatCard label="Cached Tokens" value={formatNumber(totals.tokensCached)} />
        </div>
      </section>

      {modelSessions.length > 0 && (
        <section className="panel reveal delay-1">
          <h2>Sessions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Skill</th>
                  <th>Story</th>
                  <th>Status</th>
                  <th className="num-col">Requests</th>
                  <th className="num-col">Total Tokens</th>
                  <th className="num-col">Tokens Breakdown</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {modelSessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td>
                      <span className="mono session-id" title={session.sessionId}>
                        {session.sessionId.length > 28
                          ? `${session.sessionId.slice(0, 28)}…`
                          : session.sessionId}
                      </span>
                    </td>
                    <td>
                      <span className="skill-chip">{session.skill}</span>
                    </td>
                    <td>
                      <span className="mono muted">{session.storyId ?? "—"}</span>
                    </td>
                    <td>
                      <span className={`step-badge step-${session.status}`}>{session.status}</span>
                    </td>
                    <td className="num-col">{formatNumber(session.usage.requests, 2)}</td>
                    <td className="num-col bold">{formatNumber(session.usage.totalTokens)}</td>
                    <td className="num-col">
                      <UsageCell usage={session.usage} />
                    </td>
                    <td>
                      <UsageBar maxTotal={maxSessionTotal} usage={session.usage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

export const analyticsModelDetailRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "model/$modelId",
  component: AnalyticsModelDetailPage,
})
