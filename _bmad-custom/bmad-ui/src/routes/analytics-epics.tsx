import { createRoute, Link } from "@tanstack/react-router";
import { analyticsLayoutRoute } from "./analytics";
import {
  AnalyticsCostBanner,
  formatNumber,
  UsageBar,
  UsageCell,
  useAnalyticsData,
} from "./analytics-utils";

function AnalyticsEpicsPage() {
  const { data, loading, error } = useAnalyticsData();

  if (loading) {
    return <main className="screen loading">Loading analytics...</main>;
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Failed to load analytics"}</p>
      </main>
    );
  }

  const maxEpicTotal = Math.max(
    ...data.epics.map((e) => e.usage.totalTokens),
    1
  );

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>By Epic</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Epic</th>
                <th className="num-col">Requests</th>
                <th className="num-col">Total Tokens</th>
                <th className="num-col">Tokens Breakdown</th>
                <th className="num-col">Stories</th>
                <th className="num-col">Sessions</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {data.epics.map((epic) => (
                <tr key={epic.epicId}>
                  <td>
                    <Link
                      className="mono"
                      params={{ epicId: epic.epicId }}
                      to="/analytics/epic/$epicId"
                    >
                      {epic.epicId}
                    </Link>
                  </td>
                  <td className="num-col">
                    {formatNumber(epic.usage.requests)}
                  </td>
                  <td className="num-col bold">
                    {formatNumber(epic.usage.totalTokens)}
                  </td>
                  <td className="num-col">
                    <UsageCell usage={epic.usage} />
                  </td>
                  <td className="num-col">{epic.storyCount}</td>
                  <td className="num-col">{epic.sessionCount}</td>
                  <td>
                    <UsageBar maxTotal={maxEpicTotal} usage={epic.usage} />
                  </td>
                </tr>
              ))}
              {data.epics.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    No epic data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export const analyticsEpicsRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "epics",
  component: AnalyticsEpicsPage,
});
