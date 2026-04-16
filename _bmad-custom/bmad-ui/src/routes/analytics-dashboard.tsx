import { createRoute } from "@tanstack/react-router"
import { analyticsLayoutRoute } from "./analytics"
import {
  AnalyticsCostBanner,
  buildActivityHeatmapOption,
  buildRequestsByEpicOption,
  buildRequestsOverTimeOption,
  buildSessionsBySkillOption,
  buildTokensByModelOption,
  EChart,
  formatNumber,
  formatUsd,
  StatCard,
  useAnalyticsData,
} from "./analytics-utils"

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

  const hasSessions = data.sessions.length > 0
  const hasEpics = data.epics.length > 0

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
          <StatCard
            label="Estimated Cost"
            sub={
              data.costing.estimatedCostUsd.fromPremiumRequests !== null
                ? `${formatUsd(data.costing.estimatedCostUsd.fromPremiumRequests)} from requests`
                : undefined
            }
            value={formatUsd(data.costing.estimatedCostUsd.totalWithKnownRates)}
          />
        </div>
      </section>

      {hasSessions && (
        <section className="panel reveal delay-1">
          <h3>Requests Over Time</h3>
          <EChart option={buildRequestsOverTimeOption(data.sessions)} />
        </section>
      )}

      <div className="chart-grid">
        {hasSessions && (
          <section className="panel reveal delay-2">
            <h3>Token Usage by Model</h3>
            <EChart option={buildTokensByModelOption(data.sessions)} />
          </section>
        )}

        {hasSessions && (
          <section className="panel reveal delay-2">
            <h3>Sessions by Skill</h3>
            <EChart option={buildSessionsBySkillOption(data.sessions)} />
          </section>
        )}
      </div>

      {hasSessions && (
        <section className="panel reveal delay-3">
          <h3>Activity Heatmap</h3>
          <EChart option={buildActivityHeatmapOption(data.sessions)} />
        </section>
      )}

      {hasEpics && (
        <section className="panel reveal delay-3">
          <h3>Requests by Epic</h3>
          <EChart option={buildRequestsByEpicOption(data.epics)} />
        </section>
      )}
    </main>
  )
}

export const analyticsDashboardRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "/",
  component: AnalyticsDashboardPage,
})
