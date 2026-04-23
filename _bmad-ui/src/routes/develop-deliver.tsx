import { useQuery } from "@tanstack/react-query"
import { createRoute } from "@tanstack/react-router"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import { ActiveSprintSummary, EpicsProgressList } from "../lib/sprint-summary"
import type { AnalyticsResponse, OverviewResponse } from "../types"
import { rootRoute } from "./__root"

function DevelopDeliverPage() {
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
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

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/analytics"))
      if (!response.ok) {
        throw new Error(`analytics request failed: ${response.status}`)
      }
      return (await response.json()) as AnalyticsResponse
    },
  })

  if (overviewLoading || analyticsLoading) {
    return <PageSkeleton />
  }

  if (overviewError || analyticsError) {
    return (
      <QueryErrorState
        message={String(overviewError || analyticsError)}
        onRetry={() => {
          void refetchOverview()
          void refetchAnalytics()
        }}
      />
    )
  }

  const epics = overview?.sprintOverview.epics ?? []
  const stories = overview?.sprintOverview.stories ?? []
  const sessions = analytics?.sessions ?? []

  const inProgressStoriesCount = stories.filter((s) => s.status === "in-progress").length
  const runningSessionsCount = sessions.filter((s) => s.status === "running").length

  if (epics.length === 0 && stories.length === 0) {
    return (
      <EmptyState
        icon="🚀"
        title="No active sprint"
        description="Run bmad sprint-planning to set up your sprint and start tracking epics and stories."
      />
    )
  }

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Develop &amp; Deliver</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Sprint Status
        </h1>
        <ActiveSprintSummary
          epics={epics}
          inProgressStoriesCount={inProgressStoriesCount}
          runningSessionsCount={runningSessionsCount}
        />
      </section>

      <section className="panel reveal delay-1">
        <p className="eyebrow">Epics</p>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
          Progress by Epic
        </h2>
        <EpicsProgressList epics={epics} />
      </section>
    </main>
  )
}

export const developDeliverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/develop-deliver",
  component: DevelopDeliverPage,
})
