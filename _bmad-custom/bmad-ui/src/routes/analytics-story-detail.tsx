import { createRoute } from "@tanstack/react-router";
import { analyticsLayoutRoute } from "./analytics";
import {
  AnalyticsCostBanner,
  StatCard,
  UsageBar,
  UsageCell,
  formatNumber,
  useAnalyticsData,
} from "./analytics-utils";

function AnalyticsStoryDetailPage() {
  const { storyId } = analyticsStoryDetailRoute.useParams();
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

  const story = data.stories.find((s) => s.storyId === storyId);
  const storySessions = data.sessions.filter((s) => s.storyId === storyId);
  const maxSessionTotal = Math.max(
    ...storySessions.map((s) => s.usage.totalTokens),
    1,
  );

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Story Analytics</p>
        <h2>{storyId}</h2>
        <AnalyticsCostBanner costing={data.costing} />
        {story && (
          <div className="stat-grid">
            <StatCard
              label="Requests"
              value={formatNumber(story.usage.requests)}
            />
            <StatCard
              label="Total Tokens"
              sub={`↑${formatNumber(story.usage.tokensIn)} ↓${formatNumber(story.usage.tokensOut)}`}
              value={formatNumber(story.usage.totalTokens)}
            />
            <StatCard
              label="Cached Tokens"
              value={formatNumber(story.usage.tokensCached)}
            />
            <StatCard label="Epic" value={story.epicId ?? "—"} />
            <StatCard label="Sessions" value={String(story.sessionCount)} />
          </div>
        )}
        {!story && <p className="muted">No data found for this story.</p>}
      </section>

      {storySessions.length > 0 && (
        <section className="panel reveal delay-1">
          <h2>Sessions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Skill</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th className="num-col">Requests</th>
                  <th className="num-col">Total Tokens</th>
                  <th className="num-col">Tokens Breakdown</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {storySessions.map((session) => (
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
                      <span
                        className={`step-badge step-${session.status}`}
                      >
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
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export const analyticsStoryDetailRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "story/$storyId",
  component: AnalyticsStoryDetailPage,
});
