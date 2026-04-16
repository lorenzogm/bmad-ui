import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createRoute, Link, useNavigate, useParams } from "@tanstack/react-router"
import { useCallback, useMemo, useState } from "react"
import type { WorkflowPhase, WorkflowStep } from "../app"
import { detectWorkflowStatus, storyStepLabel } from "../app"
import { IS_LOCAL_MODE, apiUrl } from "../lib/mode"
import type { OverviewResponse, RuntimeSession } from "../types"
import { workflowLayoutRoute } from "./workflow"

const HTTP_CONFLICT = 409

const VALID_PHASE_IDS = ["analysis", "planning", "solutioning", "implementation", "improvement"]

function WorkflowPhaseDetailPage() {
  const { phaseId } = useParams({ from: "/workflow/$phaseId" as const })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)
  const [pendingSkip, setPendingSkip] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<OverviewResponse>({
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

  const phase: WorkflowPhase | undefined = phases.find((p) => p.id === phaseId)
  const isValidPhase = VALID_PHASE_IDS.includes(phaseId)

  const sortedEpics = useMemo(
    () => [...(data?.sprintOverview.epics ?? [])].sort((a, b) => a.number - b.number),
    [data?.sprintOverview.epics]
  )

  const epicLabels = useMemo(
    () => new Map((data?.dependencyTree.nodes ?? []).map((n) => [n.id, n.label])),
    [data?.dependencyTree.nodes]
  )

  const handleRunSkill = useCallback(
    async (step: WorkflowStep) => {
      if (!IS_LOCAL_MODE) return
      setPendingSkill(step.skill)
      try {
        const response = await fetch("/api/workflow/run-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: step.skill }),
        })

        if (response.status === HTTP_CONFLICT) {
          throw new Error("Another workflow is already running.")
        }

        if (!response.ok) {
          throw new Error(`workflow request failed: ${response.status}`)
        }

        const result = (await response.json()) as { sessionId: string }
        if (result.sessionId) {
          void navigate({ to: "/session/$sessionId", params: { sessionId: result.sessionId } })
        }
      } catch (_err) {
        // ignore — server logs the error
      } finally {
        setPendingSkill(null)
      }
    },
    [navigate]
  )
  const handleSkipStep = useCallback(
    async (step: WorkflowStep) => {
      if (!IS_LOCAL_MODE) return
      setPendingSkip(step.id)
      try {
        const response = await fetch("/api/workflow/skip-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: step.id }),
        })
        if (!response.ok) {
          throw new Error(`skip request failed: ${response.status}`)
        }
        void queryClient.invalidateQueries({ queryKey: ["overview"] })
      } catch (_err) {
        // ignore — server logs the error
      } finally {
        setPendingSkip(null)
      }
    },
    [queryClient]
  )
  const handleUnskipStep = useCallback(
    async (step: WorkflowStep) => {
      if (!IS_LOCAL_MODE) return
      setPendingSkip(step.id)
      try {
        const response = await fetch("/api/workflow/unskip-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: step.id }),
        })
        if (!response.ok) {
          throw new Error(`unskip request failed: ${response.status}`)
        }
        void queryClient.invalidateQueries({ queryKey: ["overview"] })
      } catch (_err) {
        // ignore — server logs the error
      } finally {
        setPendingSkip(null)
      }
    },
    [queryClient]
  )
  if (isLoading) {
    return <main className="screen loading">Loading...</main>
  }

  if (error) {
    return <main className="screen loading">{String(error)}</main>
  }

  if (!isValidPhase || !phase) {
    return (
      <main className="screen">
        <section className="panel reveal">
          <Link className="epic-back-link" to="/workflow">
            ← Workflow
          </Link>
          <h1>Phase not found</h1>
          <p className="subtitle">
            Unknown workflow phase: <code>{phaseId}</code>
          </p>
        </section>
      </main>
    )
  }

  const effectiveActiveSkill = data?.activeWorkflowSkill ?? pendingSkill
  const doneCount = phase.steps.filter((s) => s.isCompleted).length
  const skippedCount = phase.steps.filter((s) => s.isSkipped).length
  const activeStepCount = phase.steps.length - skippedCount
  const isImplementation = phaseId === "implementation"

  return (
    <main className="screen">
      <section className="panel reveal">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/workflow">
            ← Workflow
          </Link>
        </div>
        <p className="eyebrow">
          Phase {phase.number}
          {phase.isOptional ? " · optional" : ""}
        </p>
        <h1 className="epic-title">{phase.name}</h1>
        <p className="epic-description">{phase.description}</p>
        <div className="epic-stats">
          <div className="epic-stat">
            <span className="epic-stat-value">{activeStepCount}</span>
            <span className="epic-stat-label">Steps</span>
          </div>
          <div className="epic-stat">
            <span className="epic-stat-value epic-stat-done">{doneCount}</span>
            <span className="epic-stat-label">Done</span>
          </div>
          {skippedCount > 0 && (
            <div className="epic-stat">
              <span className="epic-stat-value" style={{ color: "var(--muted)" }}>
                {skippedCount}
              </span>
              <span className="epic-stat-label">Skipped</span>
            </div>
          )}
          <div className="epic-stat">
            <span className="epic-stat-value">
              {activeStepCount > 0 ? Math.round((doneCount / activeStepCount) * 100) : 0}%
            </span>
            <span className="epic-stat-label">Complete</span>
          </div>
        </div>
        <div className="epic-progress-bar">
          <div
            className="epic-progress-fill"
            style={{
              width: `${activeStepCount > 0 ? Math.round((doneCount / activeStepCount) * 100) : 0}%`,
            }}
          />
        </div>
      </section>

      <section className="panel reveal delay-1">
        <h2>Steps</h2>
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
                      <span
                        className={`step-badge step-${isRunning ? "running" : step.isSkipped ? "skipped" : step.isCompleted ? "done" : "not-started"}`}
                      >
                        {isRunning ? (
                          <>
                            <span aria-hidden="true" className="agent-icon">
                              ⬡
                            </span>
                            {" running"}
                          </>
                        ) : step.isSkipped ? (
                          "skipped"
                        ) : (
                          storyStepLabel(step.isCompleted ? "completed" : "not-started")
                        )}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div className="improvement-actions">
                        {!isRunning && !step.isSkipped && !step.isCompleted && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkill !== null}
                            onClick={() => void handleRunSkill(step)}
                            title={`Run ${step.skill}`}
                            type="button"
                          >
                            <span aria-hidden="true" className="icon-glyph">
                              ▶
                            </span>
                          </button>
                        )}
                        {step.isOptional && !step.isCompleted && !step.isSkipped && (
                          <button
                            className="icon-button icon-button-delete"
                            disabled={pendingSkip !== null}
                            onClick={() => void handleSkipStep(step)}
                            title={`Skip ${step.name}`}
                            type="button"
                          >
                            <span aria-hidden="true" className="icon-glyph">
                              ⏭
                            </span>
                          </button>
                        )}
                        {step.isOptional && step.isSkipped && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkip !== null}
                            onClick={() => void handleUnskipStep(step)}
                            title={`Unskip ${step.name}`}
                            type="button"
                          >
                            <span aria-hidden="true" className="icon-glyph">
                              ↩
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
              {phase.steps.length === 0 ? (
                <tr>
                  <td colSpan={7}>No steps in this phase</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isImplementation && (
        <section className="panel reveal delay-2">
          <h2>Epics</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Epic</th>
                  <th>Name</th>
                  <th>Planning</th>
                  <th>Status</th>
                  <th>Retrospective</th>
                  <th>Stories</th>
                </tr>
              </thead>
              <tbody>
                {sortedEpics.map((epic) => (
                  <tr key={epic.id}>
                    <td>
                      <Link params={{ epicId: epic.id }} to="/epic/$epicId">
                        {epic.id}
                      </Link>
                    </td>
                    <td>{epicLabels.get(epic.id) ?? "-"}</td>
                    <td>
                      <span
                        className={`step-badge step-${epic.lifecycleSteps["bmad-sprint-planning"]}`}
                      >
                        {storyStepLabel(epic.lifecycleSteps["bmad-sprint-planning"])}
                      </span>
                    </td>
                    <td>
                      <span className={`step-badge step-${epic.status}`}>{epic.status}</span>
                    </td>
                    <td>
                      <span
                        className={`step-badge step-${epic.lifecycleSteps["bmad-retrospective"]}`}
                      >
                        {storyStepLabel(epic.lifecycleSteps["bmad-retrospective"])}
                      </span>
                    </td>
                    <td>{epic.storyCount}</td>
                  </tr>
                ))}
                {sortedEpics.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No epics found in sprint status</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

export const workflowPhaseRoute = createRoute({
  getParentRoute: () => workflowLayoutRoute,
  path: "$phaseId",
  component: WorkflowPhaseDetailPage,
})
