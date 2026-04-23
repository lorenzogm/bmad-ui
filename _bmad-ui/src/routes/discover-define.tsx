import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import type { WorkflowPhase } from "../app"
import { detectWorkflowStatus, StatusBadge } from "../app"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import type { OverviewResponse, RuntimeSession } from "../types"
import { rootRoute } from "./__root"

const DISCOVER_DEFINE_PHASE_IDS = ["analysis", "planning", "solutioning"] as const

const HTTP_CONFLICT = 409

function PhaseStepsTable(props: {
  phase: WorkflowPhase
  runtimeSessions: RuntimeSession[]
  activeSkill: string | null
  pendingSkill: string | null
  onRunSkill: (skill: string) => void
}) {
  const { phase, runtimeSessions, activeSkill, pendingSkill, onRunSkill } = props
  const effectiveActiveSkill = activeSkill ?? pendingSkill

  if (phase.steps.length === 0) {
    return (
      <p className="text-sm py-2" style={{ color: "var(--muted)" }}>
        No steps in this phase.
      </p>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Description</th>
            <th>Skill</th>
            <th>Optional</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {phase.steps.map((step, index) => {
            const isRunning = step.skill === effectiveActiveSkill
            const matchingSession = runtimeSessions.find(
              (s) => s.skill === step.skill && s.status !== "planned"
            )
            return (
              <tr key={step.id}>
                <td>
                  <span
                    className={`improvement-step-number${step.isCompleted ? " improvement-step-number-done" : ""}`}
                  >
                    {index + 1}
                  </span>
                </td>
                <td>
                  <strong>{step.name}</strong>
                </td>
                <td>{step.description}</td>
                <td>
                  <code className="improvement-step-skill">{step.skill}</code>
                </td>
                <td>{step.isOptional ? "Yes" : "No"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isRunning ? (
                    <span className="step-badge step-running">
                      <span aria-hidden="true" className="agent-icon">
                        ⬡
                      </span>
                      {" running"}
                    </span>
                  ) : step.isSkipped ? (
                    <StatusBadge status="skipped" />
                  ) : (
                    <StatusBadge status={step.isCompleted ? "completed" : "not-started"} />
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div className="improvement-actions">
                    {!isRunning && !step.isSkipped && !step.isCompleted && (
                      <button
                        className="icon-button icon-button-play"
                        disabled={!IS_LOCAL_MODE || pendingSkill !== null}
                        onClick={() => onRunSkill(step.skill)}
                        title={IS_LOCAL_MODE ? `Run ${step.skill}` : PROD_DISABLED_TITLE}
                        type="button"
                      >
                        <span aria-hidden="true" className="icon-glyph">
                          ▶
                        </span>
                      </button>
                    )}
                    {matchingSession ? (
                      <Link
                        className={`session-link-icon${matchingSession.status === "running" ? " session-link-running" : ""}${matchingSession.status === "failed" || matchingSession.status === "cancelled" ? " session-link-failed" : ""}`}
                        params={{ sessionId: matchingSession.id }}
                        title={`View session: ${matchingSession.id}`}
                        to="/session/$sessionId"
                      >
                        ◉
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PhaseAccordion(props: {
  phase: WorkflowPhase
  runtimeSessions: RuntimeSession[]
  activeSkill: string | null
  pendingSkill: string | null
  onRunSkill: (skill: string) => void
}) {
  const { phase, runtimeSessions, activeSkill, pendingSkill, onRunSkill } = props
  const nonSkippedSteps = phase.steps.filter((s) => !s.isSkipped)
  const doneCount = nonSkippedSteps.filter((s) => s.isCompleted).length
  const totalCount = nonSkippedSteps.length

  return (
    <details
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(151, 177, 205, 0.22)" }}
    >
      <summary
        className="flex items-center justify-between cursor-pointer px-5 py-4"
        style={{
          background: "rgba(2, 10, 16, 0.66)",
          listStyle: "none",
          userSelect: "none",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold" style={{ color: "var(--text)" }}>
            {phase.name}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {totalCount > 0 ? `${doneCount}/${totalCount} steps done` : "All skipped"}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          ▸
        </span>
      </summary>
      <div className="px-5 py-4" style={{ background: "rgba(10, 19, 29, 0.6)" }}>
        <p className="text-sm mb-4" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          {phase.description}
        </p>
        <PhaseStepsTable
          phase={phase}
          runtimeSessions={runtimeSessions}
          activeSkill={activeSkill}
          pendingSkill={pendingSkill}
          onRunSkill={onRunSkill}
        />
      </div>
    </details>
  )
}

function DiscoverDefinePage() {
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

  const runtimeSessions: RuntimeSession[] = data?.runtimeState?.sessions ?? []
  const { phases } = detectWorkflowStatus(
    data?.planningArtifactFiles ?? [],
    data?.implementationArtifactFiles ?? [],
    runtimeSessions
  )

  const discoverDefinePhases = phases.filter((p) =>
    (DISCOVER_DEFINE_PHASE_IDS as readonly string[]).includes(p.id)
  )

  const handleRunSkill = async (skill: string) => {
    if (!IS_LOCAL_MODE) return
    try {
      const response = await fetch("/api/workflow/run-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill }),
      })
      if (response.status === HTTP_CONFLICT) {
        throw new Error("Another workflow is already running.")
      }
      if (!response.ok) {
        throw new Error(`workflow request failed: ${response.status}`)
      }
    } catch (_err) {
      // ignore — server logs the error
    }
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Discover &amp; Define</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Research &amp; Planning
        </h1>
        <p className="subtitle mb-6">
          Explore the three phases that shape your product before development begins.
        </p>
        <div className="flex flex-col gap-3">
          {discoverDefinePhases.map((phase) => (
            <PhaseAccordion
              key={phase.id}
              phase={phase}
              runtimeSessions={runtimeSessions}
              activeSkill={data?.activeWorkflowSkill ?? null}
              pendingSkill={null}
              onRunSkill={(skill) => void handleRunSkill(skill)}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

export const discoverDefineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover-define",
  component: DiscoverDefinePage,
})
