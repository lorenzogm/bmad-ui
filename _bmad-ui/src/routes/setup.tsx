import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import type { WorkflowPhase } from "../app"
import { detectWorkflowStatus, StatusBadge } from "../app"
import { EmptyState, PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import { ActiveSprintSummary, EpicsProgressList } from "../lib/sprint-summary"
import type { AnalyticsResponse, OverviewResponse, RuntimeSession } from "../types"
import { rootRoute } from "./__root"

const DISCOVER_DEFINE_PHASE_IDS = ["analysis", "planning", "solutioning"] as const
const IMPLEMENTATION_PHASE_ID = "implementation"
const HTTP_CONFLICT = 409

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
      </div>
    </details>
  )
}

function ImplementationStepsTable(props: {
  phase: WorkflowPhase
  runtimeSessions: RuntimeSession[]
  activeSkill: string | null
  onRunSkill: (skill: string) => void
}) {
  const { phase, runtimeSessions, activeSkill, onRunSkill } = props

  if (phase.steps.length === 0) {
    return (
      <p className="text-sm py-2" style={{ color: "var(--muted)" }}>
        No steps in this phase.
      </p>
    )
  }

  const nonSkippedSteps = phase.steps.filter((s) => !s.isSkipped)
  const doneCount = nonSkippedSteps.filter((s) => s.isCompleted).length
  const totalCount = nonSkippedSteps.length

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {totalCount > 0 ? `${doneCount}/${totalCount} steps done` : "All skipped"}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Skill</th>
              <th>Optional</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {phase.steps.map((step, index) => {
              const isRunning = step.skill === activeSkill
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
                          disabled={!IS_LOCAL_MODE}
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
    </div>
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

  const runtimeSessions: RuntimeSession[] = overview?.runtimeState?.sessions ?? []
  const { phases } = detectWorkflowStatus(
    overview?.planningArtifactFiles ?? [],
    overview?.implementationArtifactFiles ?? [],
    runtimeSessions
  )

  const discoverDefinePhases = phases.filter((p) =>
    (DISCOVER_DEFINE_PHASE_IDS as readonly string[]).includes(p.id)
  )
  const implementationPhase = phases.find((p) => p.id === IMPLEMENTATION_PHASE_ID)

  const epics = overview?.sprintOverview.epics ?? []
  const stories = overview?.sprintOverview.stories ?? []
  const sessions = analytics?.sessions ?? []

  const inProgressStoriesCount = stories.filter((s) => s.status === "in-progress").length
  const runningSessionsCount = sessions.filter((s) => s.status === "running").length

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

  const hasSprintData = epics.length > 0 || stories.length > 0

  return (
    <main className="screen">
      {/* Discover & Define section */}
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
              activeSkill={overview?.activeWorkflowSkill ?? null}
              pendingSkill={null}
              onRunSkill={(skill) => void handleRunSkill(skill)}
            />
          ))}
        </div>
      </section>

      {/* Develop & Deliver section */}
      {hasSprintData ? (
        <>
          <section className="panel reveal delay-1">
            <p className="eyebrow">Develop &amp; Deliver</p>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              Sprint Status
            </h2>
            <ActiveSprintSummary
              epics={epics}
              inProgressStoriesCount={inProgressStoriesCount}
              runningSessionsCount={runningSessionsCount}
            />
          </section>

          {implementationPhase && (
            <section className="panel reveal delay-2">
              <details open>
                <summary>
                  <p className="eyebrow" style={{ display: "inline" }}>
                    {`Phase ${String(implementationPhase.number)}: ${implementationPhase.name}`}
                  </p>
                </summary>
                <ImplementationStepsTable
                  activeSkill={overview?.activeWorkflowSkill ?? null}
                  onRunSkill={(skill) => void handleRunSkill(skill)}
                  phase={implementationPhase}
                  runtimeSessions={runtimeSessions}
                />
              </details>
            </section>
          )}

          <section className="panel reveal delay-3">
            <p className="eyebrow">Per-Story Lifecycle</p>
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
          </section>

          <section className="panel reveal delay-3">
            <p className="eyebrow">Epics</p>
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
              Progress by Epic
            </h2>
            <EpicsProgressList epics={epics} />
          </section>
        </>
      ) : (
        <section className="panel reveal delay-1">
          <EmptyState
            icon="🚀"
            title="No active sprint"
            description="Run bmad sprint-planning to set up your sprint and start tracking epics and stories."
          />
        </section>
      )}
    </main>
  )
}

export const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage,
})
