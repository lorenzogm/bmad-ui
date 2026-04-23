import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { StatusBadge } from "../app"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { OverviewResponse } from "../types"
import { rootRoute } from "./__root"

function storyEpicNumber(storyId: string): number {
  return Number.parseInt(storyId.split("-")[0], 10)
}

function storyLabel(storyId: string): string {
  return storyId.toUpperCase().replace("-", ".")
}

function BoardPage() {
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/overview"))
      if (!response.ok) {
        throw new Error(`overview request failed: ${response.status}`)
      }
      return (await response.json()) as OverviewResponse
    },
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  const stories = overview?.sprintOverview.stories ?? []
  const epics = overview?.sprintOverview.epics ?? []

  if (stories.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No stories yet"
        description="Run sprint planning to create stories and populate the board."
      />
    )
  }

  const epicNameMap = new Map(epics.map((e) => [e.number, e.name]))

  // Group stories by epic number, preserving epic order
  const epicNumbers = [...new Set(stories.map((s) => storyEpicNumber(s.id)))].sort((a, b) => a - b)

  return (
    <main className="screen">
      <section className="panel reveal" style={{ marginBottom: "1.5rem" }}>
        <p className="eyebrow">Develop &amp; Deliver</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Sprint Board
        </h1>
        <p className="subtitle">
          {stories.length} {stories.length === 1 ? "story" : "stories"} across {epics.length}{" "}
          {epics.length === 1 ? "epic" : "epics"}
        </p>
      </section>

      {epicNumbers.map((epicNum) => {
        const epicStories = stories.filter((s) => storyEpicNumber(s.id) === epicNum)
        const epicName = epicNameMap.get(epicNum)
        const doneCount = epicStories.filter((s) => s.status === "done").length
        return (
          <section className="panel reveal" key={epicNum} style={{ marginBottom: "1rem" }}>
            <details open>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="eyebrow" style={{ margin: 0 }}>
                    Epic {String(epicNum)}
                  </span>
                  <span style={{ color: "var(--text)", fontWeight: 700, fontSize: "1rem" }}>
                    {epicName ?? `Epic ${String(epicNum)}`}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      marginLeft: "auto",
                    }}
                  >
                    {doneCount}/{epicStories.length} done
                  </span>
                </div>
              </summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Story</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epicStories.map((story) => (
                      <tr key={story.id}>
                        <td>
                          <Link
                            params={{ storyId: story.id }}
                            style={{ color: "var(--highlight)", textDecoration: "none" }}
                            to="/story/$storyId"
                          >
                            {storyLabel(story.id)}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={story.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )
      })}
    </main>
  )
}

export const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: BoardPage,
})
