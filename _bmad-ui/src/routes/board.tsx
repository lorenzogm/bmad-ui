import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { StatusBadge } from "../app"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { EpicStatus, OverviewResponse } from "../types"
import { rootRoute } from "./__root"

const DONE_STATUS = "done"

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

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [hideDone, setHideDone] = useState(false)
  const [expandedDone, setExpandedDone] = useState<Set<number>>(new Set())

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

  const epicMap = new Map(epics.map((e) => [e.number, e]))
  const epicNumbers = [...new Set(stories.map((s) => storyEpicNumber(s.id)))].sort((a, b) => a - b)

  function isEpicCollapsed(epicNum: number): boolean {
    if (collapsed.has(epicNum)) return true
    // Done epics default to collapsed unless user explicitly expanded
    const epic = epicMap.get(epicNum)
    return epic?.status === DONE_STATUS && !expandedDone.has(epicNum)
  }

  function toggleEpic(epicNum: number) {
    const epic = epicMap.get(epicNum)
    if (epic?.status === DONE_STATUS) {
      setExpandedDone((prev) => {
        const next = new Set(prev)
        if (next.has(epicNum)) {
          next.delete(epicNum)
        } else {
          next.add(epicNum)
        }
        return next
      })
    } else {
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(epicNum)) {
          next.delete(epicNum)
        } else {
          next.add(epicNum)
        }
        return next
      })
    }
  }

  const visibleEpics = hideDone
    ? epicNumbers.filter((n) => epicMap.get(n)?.status !== DONE_STATUS)
    : epicNumbers
  const doneEpicCount = epicNumbers.filter((n) => epicMap.get(n)?.status === DONE_STATUS).length

  let rowIndex = 0

  return (
    <main className="screen">
      <section className="panel reveal" style={{ marginBottom: "1.5rem" }}>
        <p className="eyebrow">Develop &amp; Deliver</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Sprint Board
        </h1>
        <div className="flex items-center justify-between">
          <p className="subtitle" style={{ margin: 0 }}>
            {stories.length} {stories.length === 1 ? "story" : "stories"} across {epics.length}{" "}
            {epics.length === 1 ? "epic" : "epics"}
          </p>
          {doneEpicCount > 0 ? (
            <label
              className="flex items-center gap-2"
              style={{ fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer" }}
            >
              <input
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
                type="checkbox"
              />
              Hide done epics ({doneEpicCount})
            </label>
          ) : null}
        </div>
      </section>

      <div className="table-wrap">
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: "2rem", textAlign: "center" }}>#</th>
              <th>Story</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleEpics.map((epicNum) => {
              const epicStories = stories.filter((s) => storyEpicNumber(s.id) === epicNum)
              const epic = epicMap.get(epicNum)
              const epicCollapsed = isEpicCollapsed(epicNum)
              return [
                <tr
                  key={`epic-${String(epicNum)}`}
                  onClick={() => toggleEpic(epicNum)}
                  style={{ cursor: "pointer" }}
                >
                  <td
                    colSpan={2}
                    style={{
                      background: "rgba(2, 10, 16, 0.44)",
                      borderBottom: "1px solid var(--panel-border)",
                      padding: "0.6rem 0.75rem",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.7rem",
                          display: "inline-block",
                          width: "1rem",
                          transition: "transform 0.15s",
                          transform: epicCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        }}
                      >
                        ▾
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          fontWeight: 600,
                          fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
                        }}
                      >
                        {String(epicNum)}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>
                        {epic?.name ?? `Epic ${String(epicNum)}`}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          background: "rgba(151, 177, 205, 0.12)",
                          borderRadius: "9999px",
                          padding: "0.05rem 0.5rem",
                          fontWeight: 600,
                          marginLeft: "auto",
                        }}
                      >
                        {epicStories.length}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      background: "rgba(2, 10, 16, 0.44)",
                      borderBottom: "1px solid var(--panel-border)",
                    }}
                  >
                    {epic ? <StatusBadge status={epic.status as EpicStatus} /> : null}
                  </td>
                </tr>,
                ...(!epicCollapsed
                  ? epicStories.map((story) => {
                      rowIndex += 1
                      return (
                        <tr key={story.id}>
                          <td
                            style={{
                              textAlign: "center",
                              color: "var(--muted)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {rowIndex}
                          </td>
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
                      )
                    })
                  : []),
              ]
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}

export const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  component: BoardPage,
})
