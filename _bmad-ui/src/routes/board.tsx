import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { OverviewResponse, StoryStatus } from "../types"
import { rootRoute } from "./__root"

type BoardColumn = {
  status: StoryStatus
  label: string
  cssVar: string
}

const BOARD_COLUMNS: BoardColumn[] = [
  { status: "backlog", label: "To Do", cssVar: "var(--status-backlog)" },
  { status: "ready-for-dev", label: "Ready", cssVar: "var(--status-ready)" },
  { status: "in-progress", label: "In Progress", cssVar: "var(--status-progress)" },
  { status: "review", label: "In Review", cssVar: "var(--status-review)" },
  { status: "done", label: "Done", cssVar: "var(--status-done)" },
]

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${String(BOARD_COLUMNS.length)}, minmax(200px, 1fr))`,
          gap: "1rem",
          overflowX: "auto",
          paddingBottom: "1rem",
        }}
      >
        {BOARD_COLUMNS.map((column) => {
          const columnStories = stories.filter((s) => s.status === column.status)
          return (
            <div key={column.status}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderBottom: `2px solid ${column.cssVar}`,
                }}
              >
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: column.cssVar,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {column.label}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    background: "rgba(151, 177, 205, 0.12)",
                    borderRadius: "9999px",
                    padding: "0.1rem 0.5rem",
                    fontWeight: 600,
                  }}
                >
                  {columnStories.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {columnStories.map((story) => {
                  const epicNum = storyEpicNumber(story.id)
                  const epicName = epicNameMap.get(epicNum)
                  return (
                    <Link
                      key={story.id}
                      params={{ storyId: story.id }}
                      style={{
                        display: "block",
                        padding: "0.75rem",
                        background: "rgba(2, 10, 16, 0.66)",
                        border: "1px solid rgba(151, 177, 205, 0.22)",
                        borderRadius: "0.375rem",
                        textDecoration: "none",
                        color: "var(--text)",
                        transition: "border-color 0.15s",
                      }}
                      to="/story/$storyId"
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--highlight)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {storyLabel(story.id)}
                      </div>
                      {epicName ? (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Epic {String(epicNum)}: {epicName}
                        </div>
                      ) : null}
                    </Link>
                  )
                })}
                {columnStories.length === 0 ? (
                  <div
                    style={{
                      padding: "1rem 0.75rem",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "0.75rem",
                      opacity: 0.5,
                    }}
                  >
                    No stories
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

export const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: BoardPage,
})
