import { createRoute, Link } from "@tanstack/react-router"
import { analyticsLayoutRoute } from "./analytics"
import {
  AnalyticsCostBanner,
  formatNumber,
  UsageBar,
  UsageCell,
  useAnalyticsData,
} from "./analytics-utils"

function AnalyticsStoriesPage() {
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

  const maxStoryTotal = Math.max(...data.stories.map((s) => s.usage.totalTokens), 1)

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>By Story</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Story</th>
                <th>Epic</th>
                <th className="num-col">Requests</th>
                <th className="num-col">Total Tokens</th>
                <th className="num-col">Tokens Breakdown</th>
                <th className="num-col">Sessions</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {data.stories.map((story) => (
                <tr key={story.storyId}>
                  <td>
                    <Link
                      className="mono"
                      params={{ storyId: story.storyId }}
                      to="/analytics/story/$storyId"
                    >
                      {story.storyId}
                    </Link>
                  </td>
                  <td>
                    <span className="mono muted">{story.epicId ?? "—"}</span>
                  </td>
                  <td className="num-col">{formatNumber(story.usage.requests, 2)}</td>
                  <td className="num-col bold">{formatNumber(story.usage.totalTokens)}</td>
                  <td className="num-col">
                    <UsageCell usage={story.usage} />
                  </td>
                  <td className="num-col">{story.sessionCount}</td>
                  <td>
                    <UsageBar maxTotal={maxStoryTotal} usage={story.usage} />
                  </td>
                </tr>
              ))}
              {data.stories.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    No story data yet
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

export const analyticsStoriesRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "stories",
  component: AnalyticsStoriesPage,
})
