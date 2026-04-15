import { createRoute } from "@tanstack/react-router";
import { analyticsLayoutRoute } from "./analytics";
import {
  AnalyticsCostBanner,
  UsageBar,
  UsageCell,
  formatNumber,
  useAnalyticsData,
} from "./analytics-utils";

function AnalyticsSessionsPage() {
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

  const maxSessionTotal = Math.max(
    ...data.sessions.map((s) => s.usage.totalTokens),
    1,
  );

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>Sessions</h2>
        <AnalyticsCostBanner costing={data.costing} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Skill</th>
                <th>Model</th>
                <th>Story</th>
                <th>Status</th>
                <th className="num-col">Requests</th>
                <th className="num-col">Total Tokens</th>
                <th className="num-col">Tokens Breakdown</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>
                    <span
                      className="mono session-id"
                      title={session.sessionId}
                    >
                      {session.sessionId.length > 28
                        ? `${session.sessionId.slice(0, 28)}…`
                        : session.sessionId}
                    </span>
                  </td>
                  <td>
                    <span className="skill-chip">{session.skill}</span>
                  </td>
                  <td>
                    <span className="mono muted">{session.model}</span>
                  </td>
                  <td>
                    <span className="mono muted">
                      {session.storyId ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`step-badge step-${session.status}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="num-col">
                    {formatNumber(session.usage.requests)}
                  </td>
                  <td className="num-col bold">
                    {formatNumber(session.usage.totalTokens)}
                  </td>
                  <td className="num-col">
                    <UsageCell usage={session.usage} />
                  </td>
                  <td>
                    <UsageBar
                      maxTotal={maxSessionTotal}
                      usage={session.usage}
                    />
                  </td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={9}>
                    No session data yet
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

export const analyticsSessionsRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "sessions",
  component: AnalyticsSessionsPage,
});
