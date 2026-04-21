import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useMemo } from "react"
import { detectWorkflowStatus } from "../app"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { OverviewResponse } from "../types"
import { workflowLayoutRoute } from "./workflow"

function WorkflowIndexPage() {
  const { data, isLoading, error, refetch } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/overview"))
      if (!response.ok) {
        throw new Error(`overview request failed: ${response.status}`)
      }
      return (await response.json()) as OverviewResponse
    },
  })

  const runtimeSessions = data?.runtimeState?.sessions ?? []
  const sortedEpics = useMemo(
    () => [...(data?.sprintOverview.epics ?? [])].sort((a, b) => a.number - b.number),
    [data?.sprintOverview.epics]
  )

  const { phases } = detectWorkflowStatus(
    data?.planningArtifactFiles ?? [],
    data?.implementationArtifactFiles ?? [],
    runtimeSessions
  )

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  return (
    <main className="screen">
      <section className="hero panel reveal">
        <h1>Workflow</h1>
        <p className="subtitle">
          The BMAD Method guides your project from idea to shipped product through four phases. Each
          phase produces artifacts that feed the next.
        </p>
      </section>

      <div className="workflow-phases-list reveal delay-1">
        {phases
          .filter((phase) => phase.id !== "improvement")
          .map((phase) => {
            const isImplementation = phase.id === "implementation"
            const epicsDoneCount = sortedEpics.filter((e) => e.status === "done").length
            const epicsTotal = sortedEpics.length
            const stepsDone = phase.steps.filter((s) => s.isCompleted).length
            const stepsSkipped = phase.steps.filter((s) => s.isSkipped).length
            const activeStepCount = phase.steps.length - stepsSkipped

            const progressDone =
              isImplementation && epicsTotal > 0 ? stepsDone + epicsDoneCount : stepsDone
            const progressTotal =
              isImplementation && epicsTotal > 0 ? activeStepCount + epicsTotal : activeStepCount

            const allSkipped = activeStepCount === 0 && stepsSkipped > 0
            const allDone = progressTotal > 0 && progressDone === progressTotal
            const anyDone = progressDone > 0
            const status = allSkipped
              ? "skipped"
              : allDone
                ? "done"
                : anyDone
                  ? "in-progress"
                  : "pending"

            return (
              <Link
                className="workflow-phase-card panel"
                key={phase.id}
                to="/workflow/$phaseId"
                params={{ phaseId: phase.id }}
              >
                <div className="workflow-phase-card-header">
                  <span className="workflow-phase-number">{phase.number}</span>
                  <span className="workflow-phase-name">{phase.name}</span>
                  {phase.isOptional && <span className="workflow-step-optional">optional</span>}
                </div>
                <p className="workflow-phase-card-description">{phase.description}</p>
                <div className="workflow-phase-card-footer">
                  <span className="workflow-phase-progress">
                    {progressDone}/{progressTotal}
                  </span>
                  <span className={`step-badge step-${status}`}>{status}</span>
                </div>
              </Link>
            )
          })}
      </div>

      <p className="mt-4 text-sm reveal delay-2" style={{ color: "var(--muted)" }}>
        Testing phase coming soon via{" "}
        <a
          className="underline"
          href="https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/"
          rel="noopener noreferrer"
          style={{ color: "var(--highlight)" }}
          target="_blank"
        >
          TEA (Test Engineering Agent)
        </a>
        .
      </p>
    </main>
  )
}

export const workflowIndexRoute = createRoute({
  getParentRoute: () => workflowLayoutRoute,
  path: "/",
  component: WorkflowIndexPage,
})
