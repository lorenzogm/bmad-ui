import { createRoute, Link } from "@tanstack/react-router";
import { analyticsLayoutRoute } from "./analytics";
import {
  AnalyticsCostBanner,
  formatNumber,
  StatCard,
  UsageBar,
  UsageCell,
  useAnalyticsData,
} from "./analytics-utils";

function AnalyticsEpicDetailPage() {
  const { epicId } = analyticsEpicDetailRoute.useParams();
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

  const epic = data.epics.find((e) => e.epicId === epicId);
  const epicStories = data.stories.filter((s) => s.epicId === epicId);
  const epicSessions = data.sessions.filter((s) => s.epicId === epicId);

  const maxStoryTotal = Math.max(
    ...epicStories.map((s) => s.usage.totalTokens),
    1
  );
  const maxSessionTotal = Math.max(
    ...epicSessions.map((s) => s.usage.totalTokens),
    1
  );

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Epic Analytics</p>
        <h2>{epicId}</h2>
        <AnalyticsCostBanner costing={data.costing} />
        {epic && (
          <div className="stat-grid">
            <StatCard
              label="Requests"
              value={formatNumber(epic.usage.requests, 2)}
            />
            <StatCard
              label="Total Tokens"
              sub={`↑${formatNumber(epic.usage.tokensIn)} ↓${formatNumber(epic.usage.tokensOut)}`}
              value={formatNumber(epic.usage.totalTokens)}
            />
            <StatCard
              label="Cached Tokens"
              value={formatNumber(epic.usage.tokensCached)}
            />
            <StatCard label="Stories" value={String(epic.storyCount)} />
            <StatCard label="Sessions" value={String(epic.sessionCount)} />
          </div>
        )}
        {!epic && <p className="muted">No data found for this epic.</p>}
      </section>

      {epicStories.length > 0 && (
        <section className="panel reveal delay-1">
          <h2>Stories</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Story</th>
                  <th className="num-col">Requests</th>
                  <th className="num-col">Total Tokens</th>
                  <th className="num-col">Tokens Breakdown</th>
                  <th className="num-col">Sessions</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {epicStories.map((story) => (
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
                    <td className="num-col">
                      {formatNumber(story.usage.requests, 2)}
                    </td>
                    <td className="num-col bold">
                      {formatNumber(story.usage.totalTokens)}
                    </td>
                    <td className="num-col">
                      <UsageCell usage={story.usage} />
                    </td>
                    <td className="num-col">{story.sessionCount}</td>
                    <td>
                      <UsageBar maxTotal={maxStoryTotal} usage={story.usage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {epicSessions.length > 0 && (
        <section className="panel reveal delay-2">
          <h2>Sessions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Skill</th>
                  <th>Model</th>
                  <th className="num-col">Requests</th>
                  <th className="num-col">Total Tokens</th>
                  <th className="num-col">Tokens Breakdown</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {epicSessions.map((session) => (
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
                    <td className="num-col">
                      {formatNumber(session.usage.requests, 2)}
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

export const analyticsEpicDetailRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "epic/$epicId",
  component: AnalyticsEpicDetailPage,
});
