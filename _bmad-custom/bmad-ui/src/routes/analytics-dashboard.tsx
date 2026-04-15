import { createRoute } from "@tanstack/react-router"
import { analyticsLayoutRoute } from "./analytics"
import { AnalyticsCostBanner, formatNumber, StatCard, useAnalyticsData } from "./analytics-utils"

function AnalyticsDashboardPage() {
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

  const sessionsWithUsage = data.sessions.filter(
    (s) => s.usage.totalTokens > 0 || s.usage.requests > 0
  )

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>Project Usage</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="stat-grid">
          <StatCard label="Total Requests" value={formatNumber(data.project.requests, 2)} />
          <StatCard
            label="Total Tokens"
            sub={`↑${formatNumber(data.project.tokensIn)} ↓${formatNumber(data.project.tokensOut)}`}
            value={formatNumber(data.project.totalTokens)}
          />
          <StatCard
            label="Cached Tokens"
            sub={
              data.project.tokensIn > 0
                ? `${Math.round((data.project.tokensCached / data.project.tokensIn) * 100)}% cache hit`
                : undefined
            }
            value={formatNumber(data.project.tokensCached)}
          />
          <StatCard
            label="Sessions Tracked"
            sub={`${sessionsWithUsage.length} with usage data`}
            value={String(data.sessions.length)}
          />
          <StatCard label="Stories Tracked" value={String(data.stories.length)} />
          <StatCard label="Epics Tracked" value={String(data.epics.length)} />
        </div>
      </section>
    </main>
  )
}

export const analyticsDashboardRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "/",
  component: AnalyticsDashboardPage,
})
