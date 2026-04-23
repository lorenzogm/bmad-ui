import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { StatusBadge } from "../app"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { OverviewResponse, StoryWorkflowStepSkill, WorkflowStepState } from "../types"
import { rootRoute } from "./__root"

function storyEpicNumber(storyId: string): number {
  return Number.parseInt(storyId.split("-")[0], 10)
}

function storyLabel(storyId: string): string {
  return storyId.toUpperCase().replace("-", ".")
}

const STEP_STATE_ICON: Record<WorkflowStepState, { symbol: string; color: string }> = {
  completed: { symbol: "✓", color: "var(--status-done)" },
  running: { symbol: "●", color: "var(--status-progress)" },
  failed: { symbol: "✕", color: "var(--highlight-2)" },
  "not-started": { symbol: "○", color: "var(--muted)" },
}

function StepIcon(props: { state: WorkflowStepState }) {
  const { symbol, color } = STEP_STATE_ICON[props.state]
  return (
    <span style={{ color, fontSize: "0.85rem", fontWeight: 700 }} title={props.state}>
      {symbol}
    </span>
  )
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

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  const stories = overview?.sprintOverview.stories ?? []
  const epics = overview?.sprintOverview.epics ?? []
  const stepDefs = overview?.steps ?? []

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
  const epicNumbers = [...new Set(stories.map((s) => storyEpicNumber(s.id)))].sort((a, b) => a - b)

  function toggleEpic(epicNum: number) {
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

  let rowIndex = 0

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

      <div className="table-wrap">
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: "2rem", textAlign: "center" }}>#</th>
              <th>Story</th>
              <th>Status</th>
              {stepDefs.map((step) => (
                <th key={step.skill} style={{ textAlign: "center" }}>
                  {step.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {epicNumbers.map((epicNum) => {
              const epicStories = stories.filter((s) => storyEpicNumber(s.id) === epicNum)
              const epicName = epicNameMap.get(epicNum)
              const isCollapsed = collapsed.has(epicNum)
              return [
                <tr
                  key={`epic-${String(epicNum)}`}
                  onClick={() => toggleEpic(epicNum)}
                  style={{ cursor: "pointer" }}
                >
                  <td
                    colSpan={3 + stepDefs.length}
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
                          transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        }}
                      >
                        ▾
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>
                        {epicName ?? `Epic ${String(epicNum)}`}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          background: "rgba(151, 177, 205, 0.12)",
                          borderRadius: "9999px",
                          padding: "0.05rem 0.5rem",
                          fontWeight: 600,
                        }}
                      >
                        {epicStories.length}
                      </span>
                    </div>
                  </td>
                </tr>,
                ...(!isCollapsed
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
                          {stepDefs.map((step) => (
                            <td key={step.skill} style={{ textAlign: "center" }}>
                              <StepIcon
                                state={
                                  story.steps[step.skill as StoryWorkflowStepSkill] ?? "not-started"
                                }
                              />
                            </td>
                          ))}
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
