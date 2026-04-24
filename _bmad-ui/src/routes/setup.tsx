import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import type { WorkflowPhase } from "../app"
import { detectWorkflowStatus, StatusBadge } from "../app"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import type { OverviewResponse, RuntimeSession } from "../types"
import { rootRoute } from "./__root"

const HTTP_CONFLICT = 409
const IMPLEMENTATION_PHASE_ID = "implementation"

const STORY_LIFECYCLE_STEPS = [
  {
    name: "Create Story",
    skill: "bmad-create-story",
    description: "Generate a detailed story spec with all context needed for implementation.",
  },
  {
    name: "Acceptance Tests (ATDD)",
    skill: "bmad-testarch-atdd",
    description: "Generate red-phase acceptance test scaffolds from story acceptance criteria.",
  },
  {
    name: "Dev Story",
    skill: "bmad-dev-story",
    description: "Implement the story following the spec — code, tests, and documentation.",
  },
  {
    name: "Code Review",
    skill: "bmad-code-review",
    description: "Adversarial code review with structured triage into actionable categories.",
  },
  {
    name: "Test Automation",
    skill: "bmad-testarch-automate",
    description: "Expand test coverage — fill gaps identified by test design and traceability.",
  },
  {
    name: "Test Review",
    skill: "bmad-testarch-test-review",
    description: "Audit test quality against best practices — target score >80 per story.",
  },
]

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
            {`Phase ${String(phase.number)}: ${phase.name}`}
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
        {phase.id === IMPLEMENTATION_PHASE_ID && (
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(151, 177, 205, 0.15)" }}>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--highlight)" }}
            >
              Per-Story Lifecycle
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
              The recommended sequence of skills to run for each story.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Skill</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {STORY_LIFECYCLE_STEPS.map((step, index) => (
                    <tr key={step.skill}>
                      <td>
                        <span className="improvement-step-number">{index + 1}</span>
                      </td>
                      <td>
                        <strong>{step.name}</strong>
                      </td>
                      <td>
                        <code className="improvement-step-skill">{step.skill}</code>
                      </td>
                      <td>{step.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

function SetupPage() {
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

  if (overviewLoading) {
    return <PageSkeleton />
  }

  if (overviewError) {
    return <QueryErrorState message={String(overviewError)} onRetry={refetchOverview} />
  }

  const runtimeSessions: RuntimeSession[] = overview?.runtimeState?.sessions ?? []
  const { phases } = detectWorkflowStatus(
    overview?.planningArtifactFiles ?? [],
    overview?.implementationArtifactFiles ?? [],
    runtimeSessions
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

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Setup</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          BMAD Workflow
        </h1>
        <p className="subtitle mb-6">
          Configure and run the four BMAD phases — from analysis and planning through
          implementation.
        </p>
        <div className="flex flex-col gap-3">
          {phases.map((phase) => (
            <PhaseAccordion
              key={phase.id}
              phase={phase}
              runtimeSessions={runtimeSessions}
              activeSkill={overview?.activeWorkflowSkill ?? null}
              pendingSkill={null}
              onRunSkill={(skill) => void handleRunSkill(skill)}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

export const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage,
})
