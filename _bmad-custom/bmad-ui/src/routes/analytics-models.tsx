import { Link, createRoute } from "@tanstack/react-router"
import type { TokenUsage } from "../types"
import { analyticsLayoutRoute } from "./analytics"
import {
  AnalyticsCostBanner,
  UsageBar,
  UsageCell,
  formatNumber,
  useAnalyticsData,
} from "./analytics-utils"

type ModelAggregate = {
  model: string
  sessionCount: number
  usage: TokenUsage
}

function AnalyticsModelsPage() {
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

  const modelMap = new Map<string, ModelAggregate>()
  for (const session of data.sessions) {
    const key = session.model || "unknown"
    const existing = modelMap.get(key)
    if (existing) {
      existing.sessionCount += 1
      existing.usage.requests += session.usage.requests
      existing.usage.tokensIn += session.usage.tokensIn
      existing.usage.tokensOut += session.usage.tokensOut
      existing.usage.tokensCached += session.usage.tokensCached
      existing.usage.totalTokens += session.usage.totalTokens
    } else {
      modelMap.set(key, {
        model: key,
        sessionCount: 1,
        usage: { ...session.usage },
      })
    }
  }

  const models = [...modelMap.values()].sort((a, b) => b.usage.totalTokens - a.usage.totalTokens)
  const maxTotal = Math.max(...models.map((m) => m.usage.totalTokens), 1)

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>By Model</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th className="num-col">Sessions</th>
                <th className="num-col">Requests</th>
                <th className="num-col">Total Tokens</th>
                <th className="num-col">Tokens Breakdown</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.model}>
                  <td>
                    <Link
                      className="mono"
                      params={{ modelId: model.model }}
                      to="/analytics/model/$modelId"
                    >
                      {model.model}
                    </Link>
                  </td>
                  <td className="num-col">{model.sessionCount}</td>
                  <td className="num-col">{formatNumber(model.usage.requests, 2)}</td>
                  <td className="num-col bold">{formatNumber(model.usage.totalTokens)}</td>
                  <td className="num-col">
                    <UsageCell usage={model.usage} />
                  </td>
                  <td>
                    <UsageBar maxTotal={maxTotal} usage={model.usage} />
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    No model data yet
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

export const analyticsModelsRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "models",
  component: AnalyticsModelsPage,
})
